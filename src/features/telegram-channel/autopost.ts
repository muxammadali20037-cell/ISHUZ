import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { getServerEnv } from "@/lib/env";
import { makeT } from "@/lib/i18n/translate";
import { miniAppBaseUrl } from "@/lib/telegram/bot";
import { miniAppLink } from "@/lib/telegram/start-param";
import { channelChatId, editChannelPhoto, sendChannelMessage } from "./channel";
import { channelChatIdFrom } from "./media";
import { AUTOPOST_KEY, parseAutopost } from "./autopost-settings";
import { sanitizeLine, vacancyPost, workerPost, type ChannelPost, type LinkFn } from "./autopost-format";

/**
 * Kanal postidagi tugma havolasi. Kanalda web_app tugmasi ishlamaydi, shuning uchun BotFather'da asosiy Mini App yoqilgan
 * bo'lsa (Vercel: TELEGRAM_MAIN_APP=1) — t.me/<bot>?startapp=… : e'lon ilovaning o'zida, Telegram ichida, avtomatik kirish
 * bilan ochiladi (ega, 2026-11-18: "1-o'rinda Telegram mini app va kanal"). Yoqilmagan bo'lsa — avvalgidek sayt havolasi.
 */
export function channelLink(base: string): LinkFn {
  const { TELEGRAM_MAIN_APP, TELEGRAM_BOT_USERNAME } = getServerEnv();
  const on = TELEGRAM_MAIN_APP === "1" || TELEGRAM_MAIN_APP === "true";
  return (path) => (on ? miniAppLink(path, TELEGRAM_BOT_USERNAME) : null) ?? `${base}${path}`;
}
import { resolveTelegramLocale } from "@/features/notifications/telegram";

/**
 * Telegram kanalga avtomatik e'lon (0079): yangi chiqqan vakansiya — "ISH", ishchi e'loni (rezyume) — "ISHCHI".
 * Ega (2026-11-14): "har bir joylangan rezyume kanalga tashlansin; ish beruvchilar kanaliga — ishchi".
 *
 *  · Faqat oxirgi 24 soatda chiqqan/yangilangan va hozir ommaviy e'lonlar (eski e'lonlar to'plami kanalni to'ldirib
 *    yubormasin); har biri har kanalga BIR marta (channel_posts — unique).
 *  · Bir qadamda ko'pi bilan 4 ta post (Telegram cheklovi: kanalga daqiqasiga ~20); qolgani keyingi qadamda.
 *  · Muallifi bloklangan e'lon yuborilmaydi. Rasm (ish nomi, maosh, joylashuv, kompaniya, turi) va ostida to'liq matn
 *    (autopost-format.ts). Telefon — bosilsa qo'ng'iroq, faqat egasi kanal uchun rozi bo'lgani (vacancyChannelPhones,
 *    workerChannelPhones); ishchi e'lonida ism yo'q.
 *  · Xato: 3 marta qayta urinadi; kanal darajasidagi xato (bot admin emas, kanal yo'q) — qadam to'xtaydi.
 * Ishga tushiruvchilar: fon navbati (tick) va sayt trafigi (moderation/sweep-trigger.ts).
 */
const FRESH_MS = 24 * 60 * 60 * 1000;
const PER_RUN = 4;
const MAX_ATTEMPTS = 3;
const STALE_CLAIM_MS = 10 * 60 * 1000;

type Db = ReturnType<typeof createAdminClient>;
type Entity = "vacancy" | "worker";

const one = <T,>(x: T | T[] | null | undefined): T | null => (Array.isArray(x) ? (x[0] ?? null) : (x ?? null));
const join = (...xs: (string | null | undefined)[]) => xs.filter((x): x is string => !!x).join(", ") || null;

export interface AutopostResult {
  posted: number;
  failed: number;
  stopped?: string;
  /** e'lon egalariga "E'loningiz joylandi" (rasm bilan) — yuborilganlar soni */
  notified?: number;
}

/** bir qadamda ko'pi bilan nechta egaga xabar (har biri boshqa chat — kanal cheklovi yo'q, lekin qadam qisqa bo'lsin) */
const OWNER_PER_RUN = 8;
const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);

/**
 * E'lon egasiga Telegram bot orqali "✅ E'loningiz joylandi!" — e'lonning rasmi bilan (kanaldagi bilan bir xil rasm) va
 * "E'lonlarimni ko'rish" tugmasi (ega, 2026-11-17: "e'lon joylandimi — shunaqa rasm bo'lib kelsin… ikkalasi ham").
 * Faqat oxirgi 24 soatda ommaga chiqqan e'lonlar; har biri egasiga BIR marta (channel_posts, chat_id = "dm:<telegram id>");
 * egasi botni ishga tushirmagan yoki bloklangan bo'lsa — yuborilmaydi. Xato bo'lsa qayta urinilmaydi (shaxsiy xabar — muhim
 * emas, takror xabardan yaxshiroq).
 */
async function runOwnerNotices(db: Db, res: AutopostResult): Promise<void> {
  const since = new Date(Date.now() - FRESH_MS).toISOString();
  const base = miniAppBaseUrl();
  const [vacs, workers] = await Promise.all([
    db
      .from("vacancies")
      .select("id, slug, title, owner_profile_id, owner:profiles!vacancies_owner_profile_id_fkey(is_blocked)")
      .eq("status", "active")
      .gte("published_at", since)
      .order("published_at", { ascending: false })
      .limit(30),
    db
      .from("worker_profiles")
      .select("id, profile_id, custom_profession, profession:profession_nodes!worker_profiles_profession_node_id_fkey(name_uz), owner:profiles!worker_profiles_profile_id_fkey(is_blocked)")
      .eq("is_public", true)
      .gte("onboarding_completed_at", since)
      .order("onboarding_completed_at", { ascending: false })
      .limit(30),
  ]);
  type Item = { entity: Entity; id: string; owner: string; title: string; photo: string };
  const items: Item[] = [];
  for (const v of vacs.data ?? []) {
    if (!v.owner_profile_id || one(v.owner)?.is_blocked) continue;
    items.push({ entity: "vacancy", id: v.id, owner: v.owner_profile_id, title: sanitizeLine(v.title, 80), photo: `${base}/api/promo/vacancy/${encodeURIComponent(v.slug)}?f=post` });
  }
  for (const w of workers.data ?? []) {
    const title = sanitizeLine(w.custom_profession ?? one(w.profession)?.name_uz ?? null, 80);
    if (!title || one(w.owner)?.is_blocked) continue;
    items.push({ entity: "worker", id: w.id, owner: w.profile_id, title, photo: `${base}/api/promo/worker/${w.id}` });
  }
  if (!items.length) return;
  const owners = [...new Set(items.map((i) => i.owner))];
  const [{ data: accounts }, { data: profs }] = await Promise.all([
    db.from("telegram_accounts").select("profile_id, telegram_user_id, bot_started, language_code").in("profile_id", owners),
    db.from("profiles").select("id, locale").in("id", owners),
  ]);
  let sent = 0;
  for (const item of items) {
    if (sent >= OWNER_PER_RUN) break;
    const tg = (accounts ?? []).find((a) => a.profile_id === item.owner);
    if (!tg?.bot_started) continue;
    const key = `dm:${tg.telegram_user_id}`;
    const { data: claimed, error } = await db
      .from("channel_posts")
      .insert({ entity_type: item.entity, entity_id: item.id, chat_id: key, status: "claimed", attempts: 1 })
      .select("id")
      .maybeSingle();
    if (error || !claimed) continue; // allaqachon yuborilgan (unique)
    sent += 1;
    const t = makeT(resolveTelegramLocale([(profs ?? []).find((p) => p.id === item.owner)?.locale, tg.language_code]));
    const caption = t(`bot.owner_post.${item.entity}`, { title: escapeHtml(item.title) });
    const r = await sendChannelMessage({
      chatId: String(tg.telegram_user_id),
      html: caption,
      caption,
      photo: item.photo,
      button: { text: t("bot.owner_post.button"), url: `${base}/cabinet/elonlar` },
      webApp: true,
    });
    await db
      .from("channel_posts")
      .update(r.ok ? { status: "posted", message_id: r.messageId, posted_at: new Date().toISOString() } : { status: "failed", attempts: MAX_ATTEMPTS, error: r.description.slice(0, 300) })
      .eq("id", claimed.id);
    if (r.ok) res.notified = (res.notified ?? 0) + 1;
  }
}

/**
 * Kanaldagi vakansiya raqami (ega, 2026-11-20: "telefon nomerlar 100% ko'rinsin, kanalga nomer kelmayapti"):
 *  · e'londa yozilgan raqam (vacancy_contacts) — ko'rsatilsin (show_phone) va kanal tilga olingan rozilik bilan
 *    saqlangan bo'lsa (channel_phone_at, 0083; hozirgi oddiy forma har saqlashda yozadi). Eski rozilik — raqamsiz;
 *  · e'londa raqam qatori yo'q (to'liq forma) — kompaniya / ish beruvchi aloqa raqami: onboarding'da majburiy va
 *    "E'lonlarda ko'rsatiladi" deb yoziladi; saytda ham shu raqam ochiq (0084 listing_phones_public).
 * 0083 qo'llanmagan bo'lsa (ustun yo'q) — xato yutiladi, e'lonlar raqamsiz ketadi.
 */
async function vacancyChannelPhones(db: Db, rows: { id: string; owner: string | null; companyPhone: string | null }[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!rows.length) return out;
  const { data, error } = await db.from("vacancy_contacts").select("vacancy_id, phone, show_phone, channel_phone_at").in("vacancy_id", rows.map((r) => r.id));
  if (error) return out;
  const own = new Map((data ?? []).map((c) => [c.vacancy_id, c]));
  for (const c of own.values()) if (c.show_phone && c.channel_phone_at && c.phone) out.set(c.vacancy_id, c.phone);
  const bare = rows.filter((r) => !own.has(r.id));
  if (!bare.length) return out;
  const owners = [...new Set(bare.map((r) => r.owner).filter((x): x is string => !!x))];
  const { data: emp } = owners.length ? await db.from("employer_profiles").select("profile_id, contact_phone").in("profile_id", owners) : { data: [] };
  for (const r of bare) {
    const phone = r.companyPhone ?? (emp ?? []).find((e) => e.profile_id === r.owner)?.contact_phone ?? null;
    if (phone) out.set(r.id, phone);
  }
  return out;
}

/**
 * Ishchi e'lonidagi raqam(lar) kanalga shu vaqtdan keyin saqlanganlari chiqadi: shu paytdan boshlab formada "raqam
 * Telegram kanalidagi postda ham chiqadi" deb yoziladi (easy.phone_public.worker). Undan oldin saqlanganlarga "kanalda
 * raqamingiz ko'rsatilmaydi" deb va'da berilgan — ular e'lonni qayta joylagach (yangi matn bilan) raqamli chiqadi.
 * worker_listing_phones.updated_at har saqlashda yangilanadi (0081 trigger).
 */
export const WORKER_CHANNEL_PHONES_FROM = "2026-11-20T07:30:00Z";

async function workerChannelPhones(db: Db, ids: string[]): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  if (!ids.length) return out;
  // 0088: ishchi raqami pullik bo'lsa (admin yoqqan) — kanalda raqamsiz (saytda "Raqamni ochish")
  const { data: paid } = await db.from("app_settings").select("value").eq("key", "contact_unlock_paid").maybeSingle();
  if (paid?.value === true) return out;
  const { data, error } = await db.from("worker_listing_phones").select("worker_id, phone, phone2, updated_at").in("worker_id", ids);
  if (error) return out;
  for (const p of data ?? []) {
    if (Date.parse(p.updated_at) < Date.parse(WORKER_CHANNEL_PHONES_FROM)) continue;
    out.set(p.worker_id, [p.phone, p.phone2].filter((x): x is string => !!x));
  }
  return out;
}

async function vacancyPosts(db: Db, ids: string[] | null, since: string): Promise<Map<string, ChannelPost>> {
  let q = db
    .from("vacancies")
    .select(
      "id, slug, title, description, experience_min_months, salary_from, salary_to, salary_type, salary_negotiable, schedule, is_remote, custom_profession, owner_profile_id, company:companies!vacancies_company_id_fkey(name, phone), region:regions!vacancies_region_id_fkey(name_uz), district:districts!vacancies_district_id_fkey(name_uz), profession:profession_nodes!vacancies_profession_node_id_fkey(name_uz), owner:profiles!vacancies_owner_profile_id_fkey(is_blocked)",
    )
    .eq("status", "active");
  q = ids ? q.in("id", ids) : q.gte("published_at", since).order("published_at", { ascending: false }).limit(50);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const t = makeT("uz");
  const base = miniAppBaseUrl();
  const link = channelLink(base);
  const phones = await vacancyChannelPhones(db, (data ?? []).map((v) => ({ id: v.id, owner: v.owner_profile_id, companyPhone: one(v.company)?.phone ?? null })));
  const out = new Map<string, ChannelPost>();
  for (const v of data ?? []) {
    if (one(v.owner)?.is_blocked) continue;
    out.set(
      v.id,
      vacancyPost(
        {
          slug: v.slug,
          title: v.title,
          company: one(v.company)?.name ?? null,
          place: join(one(v.district)?.name_uz, one(v.region)?.name_uz),
          remote: v.is_remote,
          salaryFrom: v.salary_from,
          salaryTo: v.salary_to,
          salaryType: v.salary_type,
          negotiable: v.salary_negotiable,
          schedule: v.schedule && v.schedule !== "negotiable" ? t(`enums.work_schedule.${v.schedule}`) : null,
          profession: v.custom_profession ?? one(v.profession)?.name_uz ?? null,
          description: v.description,
          experienceMonths: v.experience_min_months,
          phone: phones.get(v.id) ?? null,
        },
        t,
        base,
        link,
      ),
    );
  }
  return out;
}

async function workerPosts(db: Db, ids: string[] | null, since: string): Promise<Map<string, ChannelPost>> {
  let q = db
    .from("worker_profiles")
    .select(
      "id, headline, custom_profession, experience_level, profession:profession_nodes!worker_profiles_profession_node_id_fkey(name_uz), region:regions!worker_profiles_region_id_fkey(name_uz), district:districts!worker_profiles_district_id_fkey(name_uz), prefs:worker_preferences(salary_expected, salary_min, salary_type, schedules), owner:profiles!worker_profiles_profile_id_fkey(is_blocked)",
    )
    .eq("is_public", true)
    .not("onboarding_completed_at", "is", null);
  q = ids ? q.in("id", ids) : q.gte("updated_at", since).order("updated_at", { ascending: false }).limit(50);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const t = makeT("uz");
  const base = miniAppBaseUrl();
  const link = channelLink(base);
  const phones = await workerChannelPhones(db, (data ?? []).map((w) => w.id));
  const out = new Map<string, ChannelPost>();
  for (const w of data ?? []) {
    if (one(w.owner)?.is_blocked) continue;
    const profession = w.custom_profession ?? one(w.profession)?.name_uz ?? null;
    // kasbi noma'lum e'lon — kanalda ma'nosiz ("ISHCHI" va bo'sh sarlavha)
    if (!profession) continue;
    const prefs = one(w.prefs);
    out.set(
      w.id,
      workerPost(
        {
          id: w.id,
          profession,
          headline: w.headline,
          place: join(one(w.district)?.name_uz, one(w.region)?.name_uz),
          experience: w.experience_level ? t(`enums.experience_level.${w.experience_level}`) : null,
          salary: prefs?.salary_expected ?? prefs?.salary_min ?? null,
          salaryType: prefs?.salary_type ?? null,
          schedules: (prefs?.schedules ?? []).filter((s) => s !== "negotiable").map((s) => t(`enums.work_schedule.${s}`)),
          phones: phones.get(w.id) ?? [],
        },
        t,
        base,
        link,
      ),
    );
  }
  return out;
}

/** Bir turdagi e'lonlar: avval qayta urinishlar, keyin yangilari; har birini "band qilib" (unique) yuboradi */
async function runEntity(db: Db, entity: Entity, chatId: string, budget: number, res: AutopostResult): Promise<number> {
  const since = new Date(Date.now() - FRESH_MS).toISOString();
  const build = entity === "vacancy" ? vacancyPosts : workerPosts;

  // 1) qayta urinish: xato bo'lgan yoki "band qilingan"u yuborilmay qolgan (jarayon uzilgan) yozuvlar
  const { data: retry } = await db
    .from("channel_posts")
    .select("id, entity_id, status, attempts, created_at")
    .eq("entity_type", entity)
    .eq("chat_id", chatId)
    .in("status", ["failed", "claimed"])
    .lt("attempts", MAX_ATTEMPTS)
    .gte("created_at", since)
    .limit(10);
  const retriable = (retry ?? []).filter((r) => r.status === "failed" || Date.now() - new Date(r.created_at).getTime() > STALE_CLAIM_MS);

  // 2) yangilari: hali hech qachon yuborilmaganlar
  const fresh = await build(db, null, since);
  const known = fresh.size
    ? new Set(((await db.from("channel_posts").select("entity_id").eq("entity_type", entity).eq("chat_id", chatId).in("entity_id", [...fresh.keys()])).data ?? []).map((r) => r.entity_id))
    : new Set<string>();
  const queue: { id: string; post: ChannelPost; retryId?: number; attempts?: number }[] = [];
  if (retriable.length) {
    const again = await build(db, retriable.map((r) => r.entity_id), since);
    for (const r of retriable) {
      const post = again.get(r.entity_id);
      if (post) queue.push({ id: r.entity_id, post, retryId: r.id, attempts: r.attempts });
      // e'lon endi ommaviy emas (yopilgan, bloklangan) — qayta urinilmaydi
      else await db.from("channel_posts").update({ status: "failed", attempts: MAX_ATTEMPTS, error: "not_public" }).eq("id", r.id);
    }
  }
  for (const [id, post] of fresh) if (!known.has(id)) queue.push({ id, post });

  let used = 0;
  for (const item of queue) {
    if (used >= budget) break;
    let rowId = item.retryId;
    const attempts = (item.attempts ?? 0) + 1;
    if (rowId) {
      // boshqa server nusxasi ham shu yozuvni olmasin: holat va urinish soni bo'yicha shartli yangilash
      const { data: took } = await db
        .from("channel_posts")
        .update({ status: "claimed", attempts })
        .eq("id", rowId)
        .eq("attempts", item.attempts ?? 0)
        .select("id");
      if (!took?.length) continue;
    } else {
      const { data: claimed, error } = await db.from("channel_posts").insert({ entity_type: entity, entity_id: item.id, chat_id: chatId, status: "claimed", attempts }).select("id").maybeSingle();
      if (error || !claimed) continue; // allaqachon boshqa nusxa band qilgan (unique)
      rowId = claimed.id;
    }
    used += 1;
    // kanal sozlanmagan / bot huquqi yo'q — qolganlarini hozir urinmaymiz (admin "Telegram kanal" sahifasida ko'radi)
    if (await sendClaimed(db, rowId, chatId, item.post, res)) return budget;
  }
  return used;
}

/** Band qilingan yozuv bo'yicha kanalga yuborish va natijani yozish. true — kanal darajasidagi xato (qadam to'xtasin) */
async function sendClaimed(db: Db, rowId: number, chatId: string, post: ChannelPost, res: AutopostResult): Promise<boolean> {
  const sent = await sendChannelMessage({ chatId, html: post.html, button: post.button, photo: post.photo, caption: post.caption });
  if (sent.ok) {
    await db.from("channel_posts").update({ status: "posted", message_id: sent.messageId, posted_at: new Date().toISOString(), error: null }).eq("id", rowId);
    res.posted += 1;
    return false;
  }
  await db
    .from("channel_posts")
    .update({ status: "failed", error: sent.description.slice(0, 300) })
    .eq("id", rowId);
  res.failed += 1;
  if (sent.channelLevel) res.stopped = sent.description;
  return !!sent.channelLevel;
}

/**
 * Qayta joylangan e'lon kanalga yana chiqadigan oraliq: bitta e'lon kanalda kuniga ko'pi bilan bir marta (ketma-ket
 * qayta joylash kanalni to'ldirib yubormasin).
 */
export const REPOST_AFTER_MS = 24 * 60 * 60 * 1000;

/**
 * Bitta e'lon uchun kanaldagi "o'rin"ni band qilish: hali yuborilmagan — yangi yozuv; avval yuborilgan — oxirgi post
 * REPOST_AFTER_MS dan eski bo'lsa o'sha yozuv qayta band qilinadi; urinishlari tugab xato bilan qolgan — darhol. Shartli
 * yangilash (holat va vaqt bo'yicha) — ikki server nusxasi bir vaqtda ololmaydi. null — yaqinda yuborilgan, navbatdagi
 * qayta urinishda yoki boshqa nusxa band qildi.
 */
async function claimSlot(db: Db, entity: Entity, id: string, chatId: string): Promise<number | null> {
  const { data: row } = await db
    .from("channel_posts")
    .select("id, status, attempts, posted_at")
    .eq("entity_type", entity)
    .eq("entity_id", id)
    .eq("chat_id", chatId)
    .maybeSingle();
  if (!row) {
    const { data: claimed, error } = await db.from("channel_posts").insert({ entity_type: entity, entity_id: id, chat_id: chatId, status: "claimed", attempts: 1 }).select("id").maybeSingle();
    return error || !claimed ? null : claimed.id;
  }
  const cutoff = new Date(Date.now() - REPOST_AFTER_MS).toISOString();
  const reset = { status: "claimed", attempts: 1, created_at: new Date().toISOString(), posted_at: null, message_id: null, error: null };
  const base = db.from("channel_posts").update(reset).eq("id", row.id);
  let took: { id: number }[] | null = null;
  if (row.status === "posted" && row.posted_at && row.posted_at < cutoff) {
    ({ data: took } = await base.eq("status", "posted").lt("posted_at", cutoff).select("id"));
  } else if (row.status === "failed" && row.attempts >= MAX_ATTEMPTS) {
    ({ data: took } = await base.eq("status", "failed").gte("attempts", MAX_ATTEMPTS).select("id"));
  }
  return took?.length ? row.id : null;
}

/**
 * E'lon joylangan zahoti (joylash amali → after): shu e'lon kanalga darhol — fon navbatini kutmaydi (ega, 2026-11-20:
 * "e'lon joylagandan keyin srazu kanalga xabar bormayapti"). Qayta joylangan (yangilangan) e'lon ham yana chiqadi, oxirgi
 * postidan REPOST_AFTER_MS o'tgan bo'lsa. E'lon hozir ommaviy bo'lmasa (tekshiruvda, ish beruvchi tasdig'ini kutmoqda) —
 * hech narsa qilmaydi: tasdiqlangach oddiy navbat yuboradi. Kanal sozlamasi (o'chirilgan tur, alohida kanal) hisobga
 * olinadi. Hech qachon xato otmaydi.
 */
export async function postListingNow(entity: Entity, id: string): Promise<AutopostResult> {
  const res: AutopostResult = { posted: 0, failed: 0 };
  if (!getServerEnv().TELEGRAM_BOT_TOKEN || !process.env.SUPABASE_SERVICE_ROLE_KEY) return res;
  try {
    const db = createAdminClient();
    const { data: row } = await db.from("app_settings").select("value").eq("key", AUTOPOST_KEY).maybeSingle();
    const cfg = parseAutopost(row?.value);
    const on = entity === "vacancy" ? cfg.jobs : cfg.workers;
    const chatId = on ? (channelChatIdFrom(entity === "vacancy" ? cfg.jobsChat : cfg.workersChat) ?? channelChatId()) : null;
    if (!chatId) return res;
    const since = new Date(Date.now() - FRESH_MS).toISOString();
    const post = (await (entity === "vacancy" ? vacancyPosts : workerPosts)(db, [id], since)).get(id);
    if (!post) return res;
    const rowId = await claimSlot(db, entity, id, chatId);
    if (rowId) await sendClaimed(db, rowId, chatId, post, res);
  } catch (e) {
    console.error("[channel-autopost] now", e instanceof Error ? e.message : e);
  }
  if (res.posted || res.failed) console.info("[channel-autopost] now", entity, res);
  return res;
}

/**
 * E'lon rasmi (AI) tayyor bo'ldi — kanalda allaqachon chiqqan postlarning rasmi yangisiga almashtiriladi (matn va tugma
 * o'zgarmaydi). E'lon egasiga yuborilgan shaxsiy xabar (dm:) tegilmaydi. Hech qachon xato otmaydi; almashtirilganlar soni.
 */
export async function refreshChannelPhoto(entity: Entity, id: string, version: string): Promise<number> {
  if (!getServerEnv().TELEGRAM_BOT_TOKEN || !process.env.SUPABASE_SERVICE_ROLE_KEY) return 0;
  try {
    const db = createAdminClient();
    const { data: rows } = await db.from("channel_posts").select("chat_id, message_id").eq("entity_type", entity).eq("entity_id", id).eq("status", "posted").not("message_id", "is", null);
    const targets = (rows ?? []).filter((r) => r.message_id && !r.chat_id.startsWith("dm:"));
    if (!targets.length) return 0;
    const since = new Date(Date.now() - FRESH_MS).toISOString();
    const post = (await (entity === "vacancy" ? vacancyPosts : workerPosts)(db, [id], since)).get(id);
    if (!post?.photo) return 0;
    const photo = `${post.photo}${post.photo.includes("?") ? "&" : "?"}img=${encodeURIComponent(version)}`;
    let done = 0;
    for (const r of targets) {
      if (await editChannelPhoto({ chatId: r.chat_id, messageId: r.message_id!, photo, caption: post.caption ?? post.html, button: post.button })) done += 1;
    }
    return done;
  } catch (e) {
    console.error("[channel-autopost] photo", e instanceof Error ? e.message : e);
    return 0;
  }
}

/** Bir qadam: vakansiyalar va ishchi e'lonlari (sozlamaga ko'ra). Hech qachon xato otmaydi */
export async function runChannelAutopost(): Promise<AutopostResult> {
  const res: AutopostResult = { posted: 0, failed: 0 };
  if (!getServerEnv().TELEGRAM_BOT_TOKEN || !process.env.SUPABASE_SERVICE_ROLE_KEY) return res;
  try {
    const db = createAdminClient();
    const { data: row } = await db.from("app_settings").select("value").eq("key", AUTOPOST_KEY).maybeSingle();
    const cfg = parseAutopost(row?.value);
    const main = channelChatId();
    let budget = PER_RUN;
    const jobsChat = channelChatIdFrom(cfg.jobsChat) ?? main;
    if (cfg.jobs && jobsChat) budget -= await runEntity(db, "vacancy", jobsChat, budget, res);
    const workersChat = channelChatIdFrom(cfg.workersChat) ?? main;
    if (cfg.workers && workersChat && budget > 0 && !res.stopped) await runEntity(db, "worker", workersChat, budget, res);
    // e'lon egalariga — kanal sozlamasidan qat'i nazar
    await runOwnerNotices(db, res);
  } catch (e) {
    // 0079 qo'llanmagan (channel_posts yo'q) yoki tarmoq xatosi — keyingi qadamda yana
    console.error("[channel-autopost]", e instanceof Error ? e.message : e);
  }
  if (res.posted || res.failed || res.notified) console.info("[channel-autopost]", res);
  return res;
}
