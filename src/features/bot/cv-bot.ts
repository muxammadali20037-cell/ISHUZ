import "server-only";

import type { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database.types";
import type { Locale } from "@/lib/i18n/config";
import type { TFunction } from "@/lib/i18n/translate";
import { localizedName, makeT, makeTEnum } from "@/lib/i18n/translate";
import { formatMoney, formatMoneyShort, formatSalaryRange } from "@/lib/format";
import {
  answerCallback,
  editBotKeyboard,
  editBotMessage,
  escapeHtml,
  removeKeyboard,
  sendBotDocument,
  sendBotMessage,
  sendChatAction,
  webAppUrl,
  type InlineButton,
  type InlineKeyboard,
  type ReplyKeyboard,
} from "@/lib/telegram/bot";
import { ensureTelegramProfile, type TelegramIdentity } from "@/features/auth/telegram-session";
import { buildCvData, cvFileName } from "@/features/cv/data";
import { renderCvPdf } from "@/features/cv/pdf";
import { matchLevel } from "@/features/matching/level";
import { serializeJobsSearchParams } from "@/features/jobs/search-params";
import {
  AVAILABILITY_CHOICES,
  EMPLOYMENT_CHOICES,
  EXPERIENCE_LEVELS,
  LANGUAGE_CHOICES,
  SALARY_PRESETS,
  aboutText,
  cleanText,
  emptyDraft,
  nextStep,
  parseBirthDate,
  parseFullName,
  parseSalary,
  progress,
  toggle,
  type CvDraft,
  type CvStep,
  type FlowContext,
} from "./cv-flow";

/**
 * Telegram bot ichida CV: savol-javob (tugmalar bilan) → profil saqlanadi → PDF yuboriladi → mos ishlar.
 * Hamma yozuv service role orqali, lekin faqat shu Telegram foydalanuvchisining o'z profiliga
 * (telegram_user_id → profile_id bog'lanishi serverda aniqlanadi, mijozdan kelgan id ishlatilmaydi).
 */

type Admin = ReturnType<typeof createAdminClient>;

export interface BotCtx {
  admin: Admin;
  from: TelegramIdentity;
  chatId: number;
  locale: Locale;
  t: TFunction;
}

interface SessionData {
  draft: CvDraft;
  flow: FlowContext;
  /** Joriy savol xabari (javobdan keyin tahrirlanadi) */
  msg: number | null;
  /** Ko'nikma variantlari (tugmalar) — id va nom */
  skillOptions: { id: string; name: string }[];
}

interface Session {
  step: CvStep;
  profileId: string;
  data: SessionData;
}

const JOBS_PAGE = 5;
const TWO = 2;

const b = (ctx: BotCtx, key: string, params?: Record<string, string | number>) => escapeHtml(ctx.t(`bot.${key}`, params));
const nm = (ctx: BotCtx, r: { name_uz: string; name_ru: string; name_en?: string | null } | null | undefined) => localizedName(ctx.locale, r);

function rows(buttons: InlineButton[], perRow: number): InlineButton[][] {
  const out: InlineButton[][] = [];
  for (let i = 0; i < buttons.length; i += perRow) out.push(buttons.slice(i, i + perRow));
  return out;
}

/** Bosh menyu tugmalari (salomlashishda va /start da) */
export function botMenuKeyboard(t: TFunction): InlineKeyboard {
  return {
    inline_keyboard: [
      [
        { text: t("bot.menu.cv"), callback_data: "menu:cv" },
        { text: t("bot.menu.jobs"), callback_data: "menu:jobs" },
      ],
      [
        { text: t("bot.menu.pdf"), callback_data: "menu:pdf" },
        { text: t("bot.menu.app"), web_app: { url: webAppUrl("/") } },
      ],
      [{ text: t("bot.menu.lang"), callback_data: "menu:lang" }],
    ],
  };
}

// ---------------------------------------------------------------------------
// Sessiya
// ---------------------------------------------------------------------------

async function loadSession(ctx: BotCtx): Promise<Session | null> {
  const { data } = await ctx.admin.from("bot_sessions").select("profile_id, step, data").eq("telegram_user_id", ctx.from.id).maybeSingle();
  if (!data?.profile_id) return null;
  const raw = data.data as unknown as Partial<SessionData> | null;
  if (!raw?.draft || !raw.flow) return null;
  return {
    step: data.step as CvStep,
    profileId: data.profile_id,
    data: { draft: { ...emptyDraft(), ...raw.draft }, flow: raw.flow, msg: raw.msg ?? null, skillOptions: raw.skillOptions ?? [] },
  };
}

async function saveSession(ctx: BotCtx, s: Session) {
  const { error } = await ctx.admin
    .from("bot_sessions")
    .upsert(
      { telegram_user_id: ctx.from.id, profile_id: s.profileId, flow: "cv", step: s.step, data: s.data as unknown as NonNullable<Json>, updated_at: new Date().toISOString() },
      { onConflict: "telegram_user_id" },
    );
  if (error) throw new Error(`bot_sessions upsert: ${error.message}`);
}

async function clearSession(ctx: BotCtx) {
  await ctx.admin.from("bot_sessions").delete().eq("telegram_user_id", ctx.from.id);
}

export async function hasActiveSession(ctx: BotCtx): Promise<boolean> {
  const { data } = await ctx.admin.from("bot_sessions").select("step").eq("telegram_user_id", ctx.from.id).maybeSingle();
  return !!data;
}

async function workerOf(ctx: BotCtx, profileId: string) {
  const { data } = await ctx.admin.from("worker_profiles").select("id, onboarding_completed_at").eq("profile_id", profileId).maybeSingle();
  return data;
}

async function hasPhone(ctx: BotCtx, profileId: string): Promise<boolean> {
  const [{ data: tg }, { data: pc }] = await Promise.all([
    ctx.admin.from("telegram_accounts").select("phone").eq("telegram_user_id", ctx.from.id).maybeSingle(),
    ctx.admin.from("profile_contacts").select("phone").eq("profile_id", profileId).maybeSingle(),
  ]);
  return !!(tg?.phone || pc?.phone);
}

/** Kasbga mos ko'nikma variantlari: avval kasb savollaridan, bo'lmasa soha bo'yicha eng ko'p ishlatilganlari */
async function loadSkillOptions(ctx: BotCtx, d: CvDraft): Promise<{ id: string; name: string }[]> {
  if (!d.category_id) return [];
  const sub = d.subcategory_id ? (await ctx.admin.from("subcategories").select("slug").eq("id", d.subcategory_id).maybeSingle()).data : null;
  const { data: questions } = await ctx.admin
    .from("skill_questions")
    .select("subcategory_slugs, sort_order, options:skill_question_options(sort_order, skill:skills(id, name_uz, name_ru))")
    .eq("category_id", d.category_id)
    .eq("is_active", true)
    .order("sort_order");
  const seen = new Set<string>();
  const out: { id: string; name: string }[] = [];
  for (const q of questions ?? []) {
    if (q.subcategory_slugs.length && !(sub?.slug && q.subcategory_slugs.includes(sub.slug))) continue;
    for (const o of [...q.options].sort((x, y) => x.sort_order - y.sort_order)) {
      if (o.skill && !seen.has(o.skill.id)) {
        seen.add(o.skill.id);
        out.push({ id: o.skill.id, name: nm(ctx, o.skill) });
      }
    }
  }
  if (out.length < 6) {
    const { data: top } = await ctx.admin
      .from("skills")
      .select("id, name_uz, name_ru")
      .eq("category_id", d.category_id)
      .eq("is_approved", true)
      .order("usage_count", { ascending: false })
      .limit(12);
    for (const s of top ?? []) {
      if (!seen.has(s.id)) {
        seen.add(s.id);
        out.push({ id: s.id, name: nm(ctx, s) });
      }
    }
  }
  return out.slice(0, 14);
}

// ---------------------------------------------------------------------------
// Savollar
// ---------------------------------------------------------------------------

function header(ctx: BotCtx, s: Session, question: string, hint?: string) {
  const p = progress(s.step, s.data.draft, s.data.flow);
  return `<b>${p.index}/${p.total}.</b> ${question}${hint ? `\n<i>${hint}</i>` : ""}`;
}

function withNav(ctx: BotCtx, s: Session, kb: InlineButton[][], opts: { skip?: boolean } = {}): InlineKeyboard {
  const nav: InlineButton[] = [];
  if (s.data.draft.history.length) nav.push({ text: ctx.t("bot.cv.back"), callback_data: "cv:back" });
  if (opts.skip) nav.push({ text: ctx.t("bot.cv.skip"), callback_data: `cv:skip:${s.step}` });
  return { inline_keyboard: nav.length ? [...kb, nav] : kb };
}

const choice = (text: string, step: CvStep, value: string): InlineButton => ({ text, callback_data: `cv:v:${step}:${value}` });

async function askStep(ctx: BotCtx, s: Session) {
  const d = s.data.draft;
  const tEnum = makeTEnum(ctx.t);
  let text: string;
  let kb: InlineKeyboard | ReplyKeyboard;

  switch (s.step) {
    case "name": {
      text = header(ctx, s, b(ctx, "cv.q_name"), b(ctx, "cv.h_name"));
      const tgName = parseFullName(`${ctx.from.first_name ?? ""} ${ctx.from.last_name ?? ""}`);
      const suggestion = tgName ? `${tgName.first_name} ${tgName.last_name}` : null;
      kb = withNav(ctx, s, suggestion ? [[{ text: ctx.t("bot.cv.use_tg_name", { name: suggestion }), callback_data: "cv:v:name:tg" }]] : []);
      break;
    }
    case "birth":
      text = header(ctx, s, b(ctx, "cv.q_birth"), b(ctx, "cv.h_birth"));
      kb = withNav(ctx, s, []);
      break;
    case "gender":
      text = header(ctx, s, b(ctx, "cv.q_gender"));
      kb = withNav(ctx, s, [[choice(tEnum("gender", "male"), "gender", "male"), choice(tEnum("gender", "female"), "gender", "female")]]);
      break;
    case "category": {
      const { data } = await ctx.admin.from("categories").select("id, name_uz, name_ru").eq("is_active", true).order("sort_order");
      text = header(ctx, s, b(ctx, "cv.q_category"));
      kb = withNav(ctx, s, rows((data ?? []).map((c) => choice(nm(ctx, c), "category", c.id)), TWO));
      break;
    }
    case "subcategory": {
      const { data } = await ctx.admin.from("subcategories").select("id, name_uz, name_ru").eq("category_id", d.category_id ?? "").eq("is_active", true).order("sort_order").limit(40);
      text = header(ctx, s, b(ctx, "cv.q_subcategory"));
      kb = withNav(ctx, s, rows((data ?? []).map((c) => choice(nm(ctx, c), "subcategory", c.id)), TWO), { skip: true });
      break;
    }
    case "region": {
      const { data } = await ctx.admin.from("regions").select("id, name_uz, name_ru").eq("is_active", true).order("sort_order");
      text = header(ctx, s, b(ctx, "cv.q_region"));
      kb = withNav(ctx, s, rows((data ?? []).map((c) => choice(nm(ctx, c), "region", c.id)), TWO));
      break;
    }
    case "district": {
      const { data } = await ctx.admin.from("districts").select("id, name_uz, name_ru").eq("region_id", d.region_id ?? "").eq("is_active", true).order("sort_order").limit(40);
      text = header(ctx, s, b(ctx, "cv.q_district"));
      kb = withNav(ctx, s, rows((data ?? []).map((c) => choice(nm(ctx, c), "district", c.id)), TWO), { skip: true });
      break;
    }
    case "experience":
      text = header(ctx, s, b(ctx, "cv.q_experience"));
      kb = withNav(ctx, s, rows(EXPERIENCE_LEVELS.map((v) => choice(tEnum("experience_level", v), "experience", v)), TWO));
      break;
    case "prev_job":
      text = header(ctx, s, b(ctx, "cv.q_prev_job"), b(ctx, "cv.h_prev_job"));
      kb = withNav(ctx, s, [], { skip: true });
      break;
    case "skills":
      text = header(ctx, s, b(ctx, "cv.q_skills"));
      kb = skillsKeyboard(ctx, s);
      break;
    case "russian":
    case "english":
      text = header(ctx, s, b(ctx, s.step === "russian" ? "cv.q_russian" : "cv.q_english"));
      kb = withNav(ctx, s, rows(LANGUAGE_CHOICES.map((v) => choice(ctx.t(`bot.cv.lang_${v}`), s.step, v)), 3));
      break;
    case "salary":
      text = header(ctx, s, b(ctx, "cv.q_salary"), b(ctx, "cv.h_salary"));
      kb = withNav(ctx, s, [...rows(SALARY_PRESETS.map((v) => choice(formatMoneyShort(v, ctx.locale), "salary", String(v))), 3), [choice(ctx.t("bot.cv.negotiable"), "salary", "0")]]);
      break;
    case "employment":
      text = header(ctx, s, b(ctx, "cv.q_employment"));
      kb = employmentKeyboard(ctx, s);
      break;
    case "availability":
      text = header(ctx, s, b(ctx, "cv.q_availability"));
      kb = withNav(ctx, s, rows(AVAILABILITY_CHOICES.map((v) => choice(tEnum("availability", v), "availability", v)), TWO));
      break;
    case "about":
      text = header(ctx, s, b(ctx, "cv.q_about"), b(ctx, "cv.h_about"));
      kb = withNav(ctx, s, [], { skip: true });
      break;
    case "phone":
      text = header(ctx, s, b(ctx, "cv.q_phone"));
      kb = {
        keyboard: [[{ text: ctx.t("bot.cv.share_phone"), request_contact: true }], [{ text: ctx.t("bot.cv.skip") }]],
        resize_keyboard: true,
        one_time_keyboard: true,
      };
      break;
  }

  s.data.msg = await sendBotMessage(ctx.chatId, text, kb);
  await saveSession(ctx, s);
}

function skillsKeyboard(ctx: BotCtx, s: Session): InlineKeyboard {
  const picked = new Set(s.data.draft.skills);
  const buttons = s.data.skillOptions.map((o) => ({ text: `${picked.has(o.id) ? "✅ " : ""}${o.name}`, callback_data: `cv:t:skills:${o.id}` }));
  return withNav(ctx, s, [...rows(buttons, TWO), [{ text: ctx.t("bot.cv.done"), callback_data: "cv:done:skills" }]]);
}

function employmentKeyboard(ctx: BotCtx, s: Session): InlineKeyboard {
  const tEnum = makeTEnum(ctx.t);
  const picked = new Set<string>(s.data.draft.employment);
  const buttons = EMPLOYMENT_CHOICES.map((v) => ({ text: `${picked.has(v) ? "✅ " : ""}${tEnum("employment_type", v)}`, callback_data: `cv:t:employment:${v}` }));
  return withNav(ctx, s, [...rows(buttons, TWO), [{ text: ctx.t("bot.cv.done"), callback_data: "cv:done:employment" }]]);
}

/** Savol xabarini "✅ javob" ko'rinishiga keltiradi (tugmalar olib tashlanadi) */
async function markAnswered(ctx: BotCtx, s: Session, answer: string, question = header(ctx, s, questionText(ctx, s.step))) {
  if (!s.data.msg) return;
  await editBotMessage(ctx.chatId, s.data.msg, `${question}\n${b(ctx, "cv.answer", { answer })}`);
}

function questionText(ctx: BotCtx, step: CvStep): string {
  return b(ctx, `cv.q_${step}`);
}

/** Joriy savoldan keyingisiga o'tadi yoki tugatadi */
async function advance(ctx: BotCtx, s: Session) {
  const next = nextStep(s.step, s.data.draft, s.data.flow);
  s.data.draft.history = [...s.data.draft.history, s.step].slice(-30);
  if (!next) {
    await finish(ctx, s);
    return;
  }
  s.step = next;
  s.data.msg = null;
  await askStep(ctx, s);
}

// ---------------------------------------------------------------------------
// Boshlash
// ---------------------------------------------------------------------------

/** /cv yoki "CV tuzish": mavjud CV bo'lsa — tanlov, bo'lmasa savollar */
export async function startCv(ctx: BotCtx, opts: { force?: boolean; langChosen?: boolean } = {}) {
  const profileId = await ensureTelegramProfile(ctx.admin, ctx.from, ctx.locale);
  const worker = await workerOf(ctx, profileId);
  if (worker?.onboarding_completed_at && !opts.force && !opts.langChosen) {
    await sendBotMessage(ctx.chatId, b(ctx, "cv.exists"), {
      inline_keyboard: [
        [{ text: ctx.t("bot.menu.pdf"), callback_data: "menu:pdf" }],
        [{ text: ctx.t("bot.menu.jobs"), callback_data: "menu:jobs" }],
        [{ text: ctx.t("bot.cv.refill"), callback_data: "cv:restart" }],
      ],
    });
    return;
  }
  // savol-javob til tanlashdan boshlanadi (CV ham shu tilda tuziladi)
  if (!opts.langChosen) {
    await sendLanguagePicker(ctx, opts.force ? "cvr" : "cv");
    return;
  }
  const s: Session = {
    step: "name",
    profileId,
    data: {
      draft: emptyDraft(),
      flow: { hasPhone: await hasPhone(ctx, profileId), hasSkillOptions: false, hasDistricts: false, hasSubcategories: false },
      msg: null,
      skillOptions: [],
    },
  };
  await sendBotMessage(ctx.chatId, b(ctx, "cv.intro"));
  await askStep(ctx, s);
}

// ---------------------------------------------------------------------------
// Til
// ---------------------------------------------------------------------------

type LangTarget = "cv" | "cvr" | "menu";
const LOCALES = [
  ["uz", "🇺🇿 O'zbekcha"],
  ["ru", "🇷🇺 Русский"],
  ["en", "🇬🇧 English"],
] as const;

/** "Tilni tanlang / Выберите язык" — ikki tilda, joriy til ✅ bilan */
export async function sendLanguagePicker(ctx: BotCtx, target: LangTarget) {
  await sendBotMessage(ctx.chatId, escapeHtml(ctx.t("bot.lang.title")), {
    inline_keyboard: [LOCALES.map(([code, label]) => ({ text: `${code === ctx.locale ? "✅ " : ""}${label}`, callback_data: `lang:${code}:${target}` }))],
  });
}

/** Tanlangan til profilga yoziladi (keyingi xabarlar, CV va PDF shu tilda) */
async function applyLanguage(ctx: BotCtx, locale: Locale, target: LangTarget, messageId: number | null) {
  const profileId = await ensureTelegramProfile(ctx.admin, ctx.from, locale);
  const { error } = await ctx.admin.from("profiles").update({ locale }).eq("id", profileId);
  if (error) console.error("[bot] locale", error.message);
  const next: BotCtx = { ...ctx, locale, t: makeT(locale) };
  if (messageId) await editBotMessage(ctx.chatId, messageId, escapeHtml(next.t("bot.lang.changed")));
  if (target === "menu") {
    await sendBotMessage(ctx.chatId, b(next, "menu.title"), botMenuKeyboard(next.t));
    return;
  }
  await startCv(next, { force: target === "cvr", langChosen: true });
}

// ---------------------------------------------------------------------------
// Javoblar
// ---------------------------------------------------------------------------

/** Tugma bilan tanlangan qiymatni qo'llaydi; javob matnini qaytaradi (null — noto'g'ri qiymat) */
async function applyChoice(ctx: BotCtx, s: Session, value: string): Promise<string | null> {
  const d = s.data.draft;
  const tEnum = makeTEnum(ctx.t);
  switch (s.step) {
    case "name": {
      const n = parseFullName(`${ctx.from.first_name ?? ""} ${ctx.from.last_name ?? ""}`);
      if (!n) return null;
      Object.assign(d, n);
      return `${n.first_name} ${n.last_name}`;
    }
    case "gender":
      if (value !== "male" && value !== "female") return null;
      d.gender = value;
      return tEnum("gender", value);
    case "category": {
      const { data } = await ctx.admin.from("categories").select("id, slug, name_uz, name_ru").eq("id", value).eq("is_active", true).maybeSingle();
      if (!data) return null;
      if (d.category_id !== data.id) {
        d.subcategory_id = null;
        d.skills = [];
      }
      d.category_id = data.id;
      d.category_slug = data.slug;
      const { count } = await ctx.admin.from("subcategories").select("id", { count: "exact", head: true }).eq("category_id", data.id).eq("is_active", true);
      s.data.flow.hasSubcategories = (count ?? 0) > 0;
      s.data.skillOptions = await loadSkillOptions(ctx, d);
      s.data.flow.hasSkillOptions = s.data.skillOptions.length > 0;
      return nm(ctx, data);
    }
    case "subcategory": {
      const { data } = await ctx.admin.from("subcategories").select("id, name_uz, name_ru").eq("id", value).eq("category_id", d.category_id ?? "").maybeSingle();
      if (!data) return null;
      d.subcategory_id = data.id;
      s.data.skillOptions = await loadSkillOptions(ctx, d);
      s.data.flow.hasSkillOptions = s.data.skillOptions.length > 0;
      d.skills = d.skills.filter((id) => s.data.skillOptions.some((o) => o.id === id));
      return nm(ctx, data);
    }
    case "region": {
      const { data } = await ctx.admin.from("regions").select("id, name_uz, name_ru").eq("id", value).maybeSingle();
      if (!data) return null;
      if (d.region_id !== data.id) d.district_id = null;
      d.region_id = data.id;
      const { count } = await ctx.admin.from("districts").select("id", { count: "exact", head: true }).eq("region_id", data.id).eq("is_active", true);
      s.data.flow.hasDistricts = (count ?? 0) > 0;
      return nm(ctx, data);
    }
    case "district": {
      const { data } = await ctx.admin.from("districts").select("id, name_uz, name_ru").eq("id", value).eq("region_id", d.region_id ?? "").maybeSingle();
      if (!data) return null;
      d.district_id = data.id;
      return nm(ctx, data);
    }
    case "experience": {
      const v = EXPERIENCE_LEVELS.find((x) => x === value);
      if (!v) return null;
      d.experience = v;
      if (v === "none") d.prev_job = null;
      return tEnum("experience_level", v);
    }
    case "russian":
    case "english": {
      const v = LANGUAGE_CHOICES.find((x) => x === value);
      if (!v) return null;
      d[s.step] = v;
      return ctx.t(`bot.cv.lang_${v}`);
    }
    case "salary": {
      const n = Number(value);
      if (n === 0) {
        d.salary = null;
        return ctx.t("bot.cv.negotiable");
      }
      if (!SALARY_PRESETS.some((p) => p === n)) return null;
      d.salary = n;
      return formatMoney(n, ctx.locale);
    }
    case "availability": {
      const v = AVAILABILITY_CHOICES.find((x) => x === value);
      if (!v) return null;
      d.availability = v;
      return tEnum("availability", v);
    }
    default:
      return null;
  }
}

/** Inline tugma bosildi. Har doim answerCallback chaqiriladi (Telegram "soat" belgisini o'chiradi). */
export async function handleBotCallback(ctx: BotCtx, callbackId: string, data: string, messageId: number | null) {
  try {
    if (data === "menu:cv") return await startCv(ctx);
    if (data === "cv:restart") return await startCv(ctx, { force: true });
    if (data === "menu:jobs") return await sendMatchingJobs(ctx, 0);
    if (data === "menu:pdf") return await sendCvPdf(ctx);
    if (data === "menu:lang") return await sendLanguagePicker(ctx, "menu");
    const lang = /^lang:(uz|ru|en):(cv|cvr|menu)$/.exec(data);
    if (lang) return await applyLanguage(ctx, lang[1] as Locale, lang[2] as LangTarget, messageId);
    if (data === "jobs:alert") return await createJobAlert(ctx);
    const jobs = /^jobs:(\d{1,3})$/.exec(data);
    if (jobs) return await sendMatchingJobs(ctx, Number(jobs[1]));
    if (data.startsWith("cv:")) return await handleCvCallback(ctx, data, messageId);
  } finally {
    await answerCallback(callbackId);
  }
}

async function handleCvCallback(ctx: BotCtx, data: string, messageId: number | null) {
  const s = await loadSession(ctx);
  if (!s) {
    // eski xabardagi tugma: sessiya tugagan
    if (messageId) await editBotKeyboard(ctx.chatId, messageId, { inline_keyboard: [] });
    return;
  }
  // faqat joriy savol xabaridagi tugmalar ishlaydi
  if (messageId && s.data.msg && messageId !== s.data.msg) return;

  if (data === "cv:back") {
    const prev = s.data.draft.history.at(-1);
    if (!prev) return;
    s.data.draft.history = s.data.draft.history.slice(0, -1);
    if (s.data.msg) await editBotMessage(ctx.chatId, s.data.msg, header(ctx, s, questionText(ctx, s.step)));
    s.step = prev;
    s.data.msg = null;
    await askStep(ctx, s);
    return;
  }

  const [, kind, step, value = ""] = data.split(":");
  if (step !== s.step) return;

  if (kind === "v") {
    // savol raqami javobdan oldin olinadi (soha tanlangach jami savollar soni o'zgarishi mumkin)
    const question = header(ctx, s, questionText(ctx, s.step));
    const answer = await applyChoice(ctx, s, value);
    if (answer === null) return;
    await markAnswered(ctx, s, escapeHtml(answer), question);
    await advance(ctx, s);
  } else if (kind === "t" && (step === "skills" || step === "employment")) {
    if (step === "skills") {
      if (!s.data.skillOptions.some((o) => o.id === value)) return;
      s.data.draft.skills = toggle(s.data.draft.skills, value, 20);
    } else {
      const v = EMPLOYMENT_CHOICES.find((x) => x === value);
      if (!v) return;
      s.data.draft.employment = toggle(s.data.draft.employment, v);
    }
    await saveSession(ctx, s);
    if (s.data.msg) await editBotKeyboard(ctx.chatId, s.data.msg, step === "skills" ? skillsKeyboard(ctx, s) : employmentKeyboard(ctx, s));
  } else if (kind === "done" && (step === "skills" || step === "employment")) {
    const tEnum = makeTEnum(ctx.t);
    if (step === "employment" && !s.data.draft.employment.length) s.data.draft.employment = ["full_time"];
    const names =
      step === "skills"
        ? s.data.skillOptions.filter((o) => s.data.draft.skills.includes(o.id)).map((o) => o.name)
        : s.data.draft.employment.map((v) => tEnum("employment_type", v));
    await markAnswered(ctx, s, escapeHtml(names.join(", ") || "—"));
    await advance(ctx, s);
  } else if (kind === "skip" && (step === "subcategory" || step === "district" || step === "prev_job" || step === "about")) {
    if (step === "subcategory") s.data.draft.subcategory_id = null;
    if (step === "district") s.data.draft.district_id = null;
    if (step === "prev_job") s.data.draft.prev_job = null;
    if (step === "about") s.data.draft.about = null;
    await markAnswered(ctx, s, "—");
    await advance(ctx, s);
  }
}

/** Matnli xabar (sessiya faol bo'lsa). true — xabar CV oqimiga tegishli edi. */
export async function handleBotText(ctx: BotCtx, text: string): Promise<boolean> {
  const s = await loadSession(ctx);
  if (!s) return false;
  const d = s.data.draft;
  const input = text.trim();

  const reject = async (key: string) => {
    await sendBotMessage(ctx.chatId, b(ctx, key));
    return true;
  };

  switch (s.step) {
    case "name": {
      const n = parseFullName(input);
      if (!n) return reject("cv.invalid_name");
      Object.assign(d, n);
      await markAnswered(ctx, s, escapeHtml(`${n.first_name} ${n.last_name}`));
      break;
    }
    case "birth": {
      const date = parseBirthDate(input);
      if (!date) return reject("cv.invalid_birth");
      d.birth_date = date;
      await markAnswered(ctx, s, escapeHtml(input));
      break;
    }
    case "prev_job":
    case "about": {
      const v = cleanText(input, s.step === "about" ? 500 : 120);
      if (!v) return reject("cv.invalid_text");
      d[s.step] = v;
      await markAnswered(ctx, s, escapeHtml(v.length > 80 ? `${v.slice(0, 80)}…` : v));
      break;
    }
    case "salary": {
      const n = parseSalary(input);
      if (!n) return reject("cv.invalid_salary");
      d.salary = n;
      await markAnswered(ctx, s, escapeHtml(formatMoney(n, ctx.locale)));
      break;
    }
    case "phone": {
      if (input !== ctx.t("bot.cv.skip")) {
        await sendBotMessage(ctx.chatId, b(ctx, "cv.q_phone"));
        return true;
      }
      await sendBotMessage(ctx.chatId, "—", removeKeyboard);
      break;
    }
    default:
      return reject("cv.use_buttons");
  }
  await advance(ctx, s);
  return true;
}

/** Kontakt ulangandan keyin: CV oxirgi savolda (telefon) turgan bo'lsa — tugatiladi */
export async function continueAfterPhone(ctx: BotCtx): Promise<boolean> {
  const s = await loadSession(ctx);
  if (!s || s.step !== "phone") return false;
  s.data.flow.hasPhone = true;
  await advance(ctx, s);
  return true;
}

// ---------------------------------------------------------------------------
// Saqlash + PDF
// ---------------------------------------------------------------------------

async function saveProfile(ctx: BotCtx, s: Session): Promise<string> {
  const { admin } = ctx;
  const d = s.data.draft;
  if (!d.first_name || !d.last_name || !d.category_id || !d.region_id) throw new Error("incomplete draft");

  const { data: profile } = await admin.from("profiles").select("active_role").eq("id", s.profileId).single();
  const { error: pErr } = await admin
    .from("profiles")
    .update({
      first_name: d.first_name,
      last_name: d.last_name,
      ...(d.birth_date ? { birth_date: d.birth_date } : {}),
      ...(d.gender ? { gender: d.gender } : {}),
      // ish beruvchi hisobining ko'rinishi o'zgartirilmaydi — rol faqat bo'sh bo'lsa qo'yiladi
      ...(profile?.active_role ? {} : { active_role: "worker" as const }),
    })
    .eq("id", s.profileId);
  if (pErr) throw new Error(`profiles: ${pErr.message}`);

  let worker = await workerOf(ctx, s.profileId);
  if (!worker) {
    const { error } = await admin.from("worker_profiles").insert({ profile_id: s.profileId });
    if (error) throw new Error(`worker insert: ${error.message}`);
    worker = await workerOf(ctx, s.profileId);
    if (!worker) throw new Error("worker missing");
  }
  const workerId = worker.id;

  const [{ data: current }, sub, cat] = await Promise.all([
    admin.from("worker_profiles").select("headline, about").eq("id", workerId).single(),
    d.subcategory_id ? admin.from("subcategories").select("name_uz, name_ru").eq("id", d.subcategory_id).maybeSingle() : Promise.resolve({ data: null }),
    admin.from("categories").select("name_uz, name_ru").eq("id", d.category_id).maybeSingle(),
  ]);
  const about = aboutText(d, { prevJob: (job) => ctx.t("bot.cv.prev_job_about", { job }) });
  const { error: wErr } = await admin
    .from("worker_profiles")
    .update({
      category_id: d.category_id,
      subcategory_id: d.subcategory_id ?? null,
      region_id: d.region_id,
      district_id: d.district_id ?? null,
      experience_level: d.experience ?? "none",
      headline: (nm(ctx, sub.data) || nm(ctx, cat.data)).slice(0, 80) || current?.headline || null,
      about: about ?? current?.about ?? null,
      onboarding_completed_at: new Date().toISOString(),
      status: "active",
      is_public: true,
      onboarding_step: 9,
    })
    .eq("id", workerId);
  if (wErr) throw new Error(`worker update: ${wErr.message}`);

  const writes = [];
  if (d.district_id) writes.push(admin.from("worker_locations").upsert({ worker_id: workerId, district_id: d.district_id }, { onConflict: "worker_id,district_id", ignoreDuplicates: true }));
  if (d.skills.length) {
    writes.push(
      admin.from("worker_skills").upsert(
        d.skills.map((skill_id) => ({ worker_id: workerId, skill_id, level: "good" as const })),
        { onConflict: "worker_id,skill_id", ignoreDuplicates: true },
      ),
    );
  }
  writes.push(admin.from("worker_languages").upsert({ worker_id: workerId, language_code: "uz", level: "native" }, { onConflict: "worker_id,language_code", ignoreDuplicates: true }));
  for (const [code, v] of [
    ["ru", d.russian],
    ["en", d.english],
  ] as const) {
    if (v && v !== "no") writes.push(admin.from("worker_languages").upsert({ worker_id: workerId, language_code: code, level: v }, { onConflict: "worker_id,language_code" }));
  }
  writes.push(
    admin.from("worker_preferences").upsert(
      {
        worker_id: workerId,
        employment_types: d.employment.length ? d.employment : ["full_time"],
        salary_expected: d.salary ?? null,
        salary_type: d.salary ? "monthly" : "negotiable",
        availability: d.availability ?? "negotiable",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "worker_id" },
    ),
  );
  if (ctx.from.username) {
    writes.push(admin.from("profile_contacts").update({ telegram_username: ctx.from.username }).eq("profile_id", s.profileId).is("telegram_username", null));
  }
  const results = await Promise.all(writes);
  for (const r of results) if (r.error) console.error("[bot cv] write", r.error.message);

  const [completeness, matches] = await Promise.all([
    admin.rpc("refresh_worker_completeness", { p_worker_id: workerId }),
    admin.rpc("refresh_matches_for_worker", { p_worker_id: workerId }),
  ]);
  if (completeness.error) console.error("[bot cv] completeness", completeness.error.message);
  if (matches.error) console.error("[bot cv] matches", matches.error.message);
  return workerId;
}

async function finish(ctx: BotCtx, s: Session) {
  await saveSession(ctx, s);
  await sendChatAction(ctx.chatId, "upload_document");
  let workerId: string;
  try {
    workerId = await saveProfile(ctx, s);
  } catch (e) {
    console.error("[bot cv] save", e instanceof Error ? e.message : e);
    await sendBotMessage(ctx.chatId, b(ctx, "cv.save_failed"), { inline_keyboard: [[{ text: ctx.t("bot.menu.app"), web_app: { url: webAppUrl("/onboarding/worker") } }]] });
    return;
  }
  await clearSession(ctx);
  await sendPdfFor(ctx, workerId, b(ctx, "cv.ready"));
}

async function sendPdfFor(ctx: BotCtx, workerId: string, caption: string) {
  const data = await buildCvData(ctx.admin, workerId, ctx.locale, { includePhone: true });
  if (!data) return;
  const pdf = await renderCvPdf(data);
  await sendBotDocument(ctx.chatId, pdf, cvFileName(data.name), caption, {
    inline_keyboard: [
      [{ text: ctx.t("bot.menu.jobs"), callback_data: "jobs:0" }],
      [{ text: ctx.t("bot.cv.edit_in_app"), web_app: { url: webAppUrl("/profile") } }],
    ],
  });
}

/** /pdf: tayyor CV'ni PDF qilib yuboradi (soatiga 10 ta) */
export async function sendCvPdf(ctx: BotCtx) {
  const profileId = await ensureTelegramProfile(ctx.admin, ctx.from, ctx.locale);
  const worker = await workerOf(ctx, profileId);
  if (!worker?.onboarding_completed_at) {
    await sendBotMessage(ctx.chatId, b(ctx, "cv.no_cv"), { inline_keyboard: [[{ text: ctx.t("bot.menu.cv"), callback_data: "cv:restart" }]] });
    return;
  }
  const { data: allowed } = await ctx.admin.rpc("check_rate_limit", { p_key: `botpdf:${ctx.from.id}`, p_limit: 10, p_window_seconds: 3600 });
  if (allowed === false) {
    await sendBotMessage(ctx.chatId, b(ctx, "cv.pdf_limit"));
    return;
  }
  await sendChatAction(ctx.chatId, "upload_document");
  await sendPdfFor(ctx, worker.id, "📄");
}

// ---------------------------------------------------------------------------
// Mos ishlar
// ---------------------------------------------------------------------------

export async function sendMatchingJobs(ctx: BotCtx, offset: number) {
  const profileId = await ensureTelegramProfile(ctx.admin, ctx.from, ctx.locale);
  const worker = await workerOf(ctx, profileId);
  if (!worker?.onboarding_completed_at) {
    await sendBotMessage(ctx.chatId, b(ctx, "cv.no_cv"), { inline_keyboard: [[{ text: ctx.t("bot.menu.cv"), callback_data: "cv:restart" }]] });
    return;
  }
  const { data, error } = await ctx.admin.rpc("bot_matching_vacancies", { p_worker_id: worker.id, p_limit: JOBS_PAGE, p_offset: offset });
  if (error) throw new Error(`bot_matching_vacancies: ${error.message}`);
  const list = data ?? [];
  if (!list.length) {
    await sendBotMessage(ctx.chatId, b(ctx, "jobs.empty"), { inline_keyboard: [[{ text: ctx.t("bot.jobs.alert"), callback_data: "jobs:alert" }]] });
    return;
  }

  const total = Number(list[0]?.total ?? list.length);
  const labels = { negotiable: ctx.t("bot.jobs.negotiable"), from: ctx.t("common.labels.from"), to: ctx.t("common.labels.to") };
  const lines = list.map((v, i) => {
    const place = v.is_remote ? ctx.t("bot.jobs.remote") : [ctx.locale === "ru" ? v.district_name_ru : v.district_name_uz, ctx.locale === "ru" ? v.region_name_ru : v.region_name_uz].filter(Boolean).join(", ");
    const salary = v.salary_negotiable ? labels.negotiable : formatSalaryRange(v.salary_from, v.salary_to, ctx.locale, labels);
    return [
      `<b>${offset + i + 1}. ${escapeHtml(v.title)}</b>`,
      v.company_name ? `🏢 ${escapeHtml(v.company_name)}` : null,
      `💰 ${escapeHtml(salary)}`,
      place ? `📍 ${escapeHtml(place)}` : null,
      `⭐ ${escapeHtml(ctx.t(`common.labels.match_level.${matchLevel(v.score)}`))}`,
    ]
      .filter(Boolean)
      .join("\n");
  });
  const text = `${b(ctx, "jobs.title", { from: offset + 1, to: offset + list.length, total })}\n\n${lines.join("\n\n")}`;
  const kb: InlineButton[][] = list.map((v, i) => [{ text: ctx.t("bot.jobs.open", { n: offset + i + 1 }), web_app: { url: webAppUrl(`/jobs/${v.slug}`) } }]);
  const nav: InlineButton[] = [];
  if (offset + list.length < total && offset + JOBS_PAGE < 200) nav.push({ text: ctx.t("bot.jobs.more"), callback_data: `jobs:${offset + JOBS_PAGE}` });
  kb.push(nav.length ? nav : []);
  kb.push([{ text: ctx.t("bot.jobs.alert"), callback_data: "jobs:alert" }]);
  await sendBotMessage(ctx.chatId, text, { inline_keyboard: kb.filter((r) => r.length) });
}

/** "🔔 Xabar berish": kasb + viloyat bo'yicha saqlangan qidiruv (kunlik xabar mavjud cron orqali) */
async function createJobAlert(ctx: BotCtx) {
  const profileId = await ensureTelegramProfile(ctx.admin, ctx.from, ctx.locale);
  const { data: w } = await ctx.admin
    .from("worker_profiles")
    .select("category_id, subcategory_id, region_id, category:categories(slug, name_uz, name_ru), subcategory:subcategories(slug, name_uz, name_ru), region:regions(slug, name_uz, name_ru)")
    .eq("profile_id", profileId)
    .maybeSingle();
  if (!w?.category) {
    await sendBotMessage(ctx.chatId, b(ctx, "cv.no_cv"), { inline_keyboard: [[{ text: ctx.t("bot.menu.cv"), callback_data: "cv:restart" }]] });
    return;
  }
  const query = serializeJobsSearchParams({ category: w.category.slug, subcategory: w.subcategory?.slug ?? null, region: w.region?.slug ?? null });
  const { data: existing } = await ctx.admin.from("saved_searches").select("id").eq("profile_id", profileId).eq("query_string", query).maybeSingle();
  if (existing) {
    await ctx.admin.from("saved_searches").update({ notify: true }).eq("id", existing.id);
    await sendBotMessage(ctx.chatId, b(ctx, "jobs.alert_exists"));
    return;
  }
  const label = [nm(ctx, w.subcategory) || nm(ctx, w.category), nm(ctx, w.region)].filter(Boolean).join(" · ").slice(0, 160);
  const { error } = await ctx.admin.from("saved_searches").insert({
    profile_id: profileId,
    label,
    query_string: query,
    category_id: w.category_id,
    subcategory_id: w.subcategory_id,
    region_id: w.region_id,
    notify: true,
  });
  if (error) {
    console.error("[bot] saved search", error.message);
    await sendBotMessage(ctx.chatId, b(ctx, "cv.save_failed"));
    return;
  }
  await sendBotMessage(ctx.chatId, b(ctx, "jobs.alert_done"));
}
