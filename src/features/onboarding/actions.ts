"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { runBackgroundTickSafe } from "@/features/notifications/tick";
import { createClient, type SupabaseServerClient } from "@/lib/supabase/server";
import { getSession, type SessionContext } from "@/features/auth/session";
import type { ActionResult } from "@/features/auth/actions";
import { errorCode } from "@/lib/utils";
import { normalizePhone } from "@/lib/format";
import { publicEnv } from "@/lib/env";
import type { Enums, TablesInsert, TablesUpdate } from "@/types/database.types";
import {
  avatarSchema,
  customSkillSchema,
  educationSchema,
  experienceSchema,
  geoSchema,
  locationSchema,
  onboardingPersonalSchema,
  phoneCodeSchema,
  phoneSchema,
  portfolioSchema,
  preferencesSchema,
  professionSchema,
  skillsSchema,
  skipStepSchema,
} from "./schema";
import { REVIEW_STEP, WIZARD_PATH, type SkillOption } from "./types";
import { customSkillSlug, isOwnPublicUrl, isOwnStoragePath, monthToDate, nextStepAfter, normalizeTelegramUsername } from "./utils";

export type StepResult = ActionResult<{ nextStep: number }>;

type Ctx = { supabase: SupabaseServerClient; session: SessionContext; workerId: string; savedStep: number };
type CtxResult = { ok: true; ctx: Ctx } | { ok: false; error: string };

/**
 * Sessiya + worker_profiles yozuvi. `create` bo'lsa yozuv yo'q holda yaratadi
 * (RLS: profile_id = auth.uid(); trigger user_roles + active_role ni qo'shadi).
 * Insert RETURNING ishlatilmaydi — can_view_worker() yangi qatorni shu statement ichida ko'rmaydi.
 */
async function getWorkerCtx(opts: { create: boolean }): Promise<CtxResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "not_authenticated" };
  if (session.profile.is_blocked) return { ok: false, error: "blocked" };
  const supabase = await createClient();

  const { data: existing, error } = await supabase.from("worker_profiles").select("id, onboarding_step").eq("profile_id", session.userId).maybeSingle();
  if (error) return { ok: false, error: errorCode(error) };
  if (existing) return { ok: true, ctx: { supabase, session, workerId: existing.id, savedStep: existing.onboarding_step } };
  if (!opts.create) return { ok: false, error: "no_worker" };

  const { error: insertError } = await supabase.from("worker_profiles").insert({ profile_id: session.userId });
  if (insertError) return { ok: false, error: errorCode(insertError) };
  const { data: created, error: selectError } = await supabase.from("worker_profiles").select("id, onboarding_step").eq("profile_id", session.userId).single();
  if (selectError || !created) return { ok: false, error: errorCode(selectError) };
  return { ok: true, ctx: { supabase, session, workerId: created.id, savedStep: created.onboarding_step } };
}

/** Qadam tugagach onboarding_step ni oldinga suradi (hech qachon orqaga emas) */
async function advance(ctx: Ctx, completedStep: number, alreadyWritten = false): Promise<StepResult> {
  const nextStep = nextStepAfter(ctx.savedStep, completedStep);
  if (!alreadyWritten && nextStep !== ctx.savedStep) {
    const { error } = await ctx.supabase.from("worker_profiles").update({ onboarding_step: nextStep }).eq("id", ctx.workerId);
    if (error) return { ok: false, error: errorCode(error) };
  }
  revalidatePath(WIZARD_PATH);
  return { ok: true, data: { nextStep } };
}

// =====================================================================
// 1. Shaxsiy ma'lumot
// =====================================================================
export async function savePersonal(input: unknown): Promise<StepResult> {
  const parsed = onboardingPersonalSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const res = await getWorkerCtx({ create: true });
  if (!res.ok) return res;
  const { supabase, session } = res.ctx;
  const d = parsed.data;

  // Telefon majburiy: ish beruvchi nomzod bilan shu raqam orqali bog'lanadi
  const { data: contact } = await supabase.from("profile_contacts").select("phone").eq("profile_id", session.userId).maybeSingle();
  if (!contact?.phone) return { ok: false, error: "phone_required" };

  // Faqat ism/familiya; tug'ilgan sana, jins va boshqalar — keyin profilda (ixtiyoriy)
  const { error: profileError } = await supabase.from("profiles").update({ first_name: d.first_name, last_name: d.last_name }).eq("id", session.userId);
  if (profileError) return { ok: false, error: errorCode(profileError) };

  // Telegram ichidan kirgan bo'lsa — username avtomatik (foydalanuvchi qo'lda yozmaydi)
  const { data: tg } = await supabase.from("telegram_accounts").select("username").eq("profile_id", session.userId).maybeSingle();
  const username = normalizeTelegramUsername(tg?.username ?? "");
  if (username) {
    const { error: contactError } = await supabase.from("profile_contacts").update({ telegram_username: username }).eq("profile_id", session.userId).is("telegram_username", null);
    if (contactError) console.error("[onboarding] telegram username", contactError.message);
  }

  revalidatePath("/", "layout");
  return advance(res.ctx, 1);
}

/** Avatar: client "avatars/<userId>/avatar.<ext>" ga yuklaydi, bu yerda faqat URL saqlanadi */
export async function saveAvatar(input: unknown): Promise<ActionResult<{ url: string | null }>> {
  const parsed = avatarSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const session = await getSession();
  if (!session) return { ok: false, error: "not_authenticated" };
  const url = parsed.data.url;
  if (url && !isOwnPublicUrl(url, publicEnv.NEXT_PUBLIC_SUPABASE_URL, "avatars", session.userId)) return { ok: false, error: "validation" };
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", session.userId);
  if (error) return { ok: false, error: errorCode(error) };
  revalidatePath("/", "layout");
  return { ok: true, data: { url } };
}

/**
 * Telefon raqam qo'shish (Telegram orqali kirganlar uchun). profile_contacts.phone ni RLS to'g'ridan-to'g'ri
 * o'zgartirishga ruxsat bermaydi — Supabase Auth "phone change" OTP orqali: tasdiqlangach
 * on_auth_user_updated trigger'i phone + phone_verified_at ni yozadi.
 */
export async function sendPhoneChangeCode(input: unknown): Promise<ActionResult<{ phone: string }>> {
  const parsed = phoneSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_phone" };
  const phone = normalizePhone(parsed.data.phone);
  if (!phone) return { ok: false, error: "invalid_phone" };
  const session = await getSession();
  if (!session) return { ok: false, error: "not_authenticated" };
  const supabase = await createClient();
  const { data: contacts } = await supabase.from("profile_contacts").select("phone").eq("profile_id", session.userId).maybeSingle();
  if (contacts?.phone) return { ok: false, error: "phone_locked" };

  const { error } = await supabase.auth.updateUser({ phone });
  if (error) {
    console.error("[onboarding] sendPhoneChangeCode", error.message);
    if (/rate/i.test(error.message)) return { ok: false, error: "rate_limited" };
    if (/already|exists|registered/i.test(error.message)) return { ok: false, error: "phone_taken" };
    return { ok: false, error: "otp_send_failed" };
  }
  return { ok: true, data: { phone } };
}

export async function verifyPhoneChangeCode(input: unknown): Promise<ActionResult> {
  const parsed = phoneCodeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_code" };
  const phone = normalizePhone(parsed.data.phone);
  if (!phone) return { ok: false, error: "invalid_phone" };
  const session = await getSession();
  if (!session) return { ok: false, error: "not_authenticated" };
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ phone, token: parsed.data.token, type: "phone_change" });
  if (error) {
    console.error("[onboarding] verifyPhoneChangeCode", error.message);
    return { ok: false, error: /expired/i.test(error.message) ? "code_expired" : "invalid_code" };
  }
  revalidatePath(WIZARD_PATH);
  return { ok: true };
}

// =====================================================================
// 2. Joylashuv
// =====================================================================
export async function saveLocation(input: unknown): Promise<StepResult> {
  const parsed = locationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const res = await getWorkerCtx({ create: true });
  if (!res.ok) return res;
  const { supabase, workerId } = res.ctx;
  const d = parsed.data;

  const { data: district } = await supabase.from("districts").select("id, region_id").eq("id", d.district_id).maybeSingle();
  if (!district || district.region_id !== d.region_id) return { ok: false, error: "validation" };

  const nextStep = nextStepAfter(res.ctx.savedStep, 2);
  const { error: updateError } = await supabase
    .from("worker_profiles")
    .update({ region_id: d.region_id, district_id: d.district_id, area_hint: d.area_hint || null, remote_preference: d.remote_preference, onboarding_step: nextStep })
    .eq("id", workerId);
  if (updateError) return { ok: false, error: errorCode(updateError) };

  const districtIds = [...new Set([d.district_id, ...d.work_districts])];
  const { error: delError } = await supabase.from("worker_locations").delete().eq("worker_id", workerId);
  if (delError) return { ok: false, error: errorCode(delError) };
  const { error: insError } = await supabase.from("worker_locations").insert(districtIds.map((district_id) => ({ worker_id: workerId, district_id })));
  if (insError) return { ok: false, error: errorCode(insError) };

  return advance(res.ctx, 2, true);
}

/** Aniq koordinata (faqat masofa uchun; RLS — faqat egasi ko'radi) */
export async function saveWorkerGeo(input: unknown): Promise<ActionResult> {
  const parsed = geoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const res = await getWorkerCtx({ create: true });
  if (!res.ok) return res;
  const { supabase, workerId } = res.ctx;
  const { error } = await supabase.from("worker_geo").upsert({ worker_id: workerId, lat: parsed.data.lat, lng: parsed.data.lng }, { onConflict: "worker_id" });
  if (error) return { ok: false, error: errorCode(error) };
  revalidatePath(WIZARD_PATH);
  return { ok: true };
}

// =====================================================================
// 3. Kasb
// =====================================================================
export async function saveProfession(input: unknown): Promise<StepResult> {
  const parsed = professionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const res = await getWorkerCtx({ create: true });
  if (!res.ok) return res;
  const { supabase, workerId } = res.ctx;
  const d = parsed.data;

  const nextStep = nextStepAfter(res.ctx.savedStep, 3);
  let patch: TablesUpdate<"worker_profiles">;
  if (d.profession_node_id) {
    // soha va yo'nalish bazadagi trigger orqali tugundan olinadi (mijozga ishonilmaydi)
    const { data: node } = await supabase.from("profession_nodes").select("id, is_active").eq("id", d.profession_node_id).maybeSingle();
    if (!node?.is_active) return { ok: false, error: "validation" };
    patch = { profession_node_id: node.id, headline: d.headline, onboarding_step: nextStep };
  } else {
    if (d.subcategory_id) {
      const { data: sub } = await supabase.from("subcategories").select("id, category_id").eq("id", d.subcategory_id).maybeSingle();
      if (!sub || sub.category_id !== d.category_id) return { ok: false, error: "validation" };
    }
    patch = {
      category_id: d.category_id,
      subcategory_id: d.subcategory_id,
      headline: d.headline,
      onboarding_step: nextStep,
      ...(d.custom_profession ? { profession_node_id: null, custom_profession: d.custom_profession } : {}),
    };
  }
  const { error } = await supabase.from("worker_profiles").update(patch).eq("id", workerId);
  if (error) return { ok: false, error: errorCode(error) };
  if (!d.profession_node_id && d.custom_profession) {
    // katalogni boyitish navbati (takror yozilsa unique indeks — xato e'tiborsiz)
    const { error: reqErr } = await supabase
      .from("custom_occupation_requests")
      .insert({ raw_text: d.custom_profession, category_id: d.category_id, context: "worker", worker_id: workerId });
    if (reqErr && reqErr.code !== "23505") console.error("[onboarding] custom occupation", reqErr.message);
  }
  return advance(res.ctx, 3, true);
}

// =====================================================================
// 4. Tajriba
// =====================================================================
export async function saveExperience(input: unknown): Promise<StepResult> {
  const parsed = experienceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const res = await getWorkerCtx({ create: true });
  if (!res.ok) return res;
  const { supabase, workerId } = res.ctx;
  const d = parsed.data;

  const nextStep = nextStepAfter(res.ctx.savedStep, 4);
  const { error: updateError } = await supabase.from("worker_profiles").update({ experience_level: d.experience_level, onboarding_step: nextStep }).eq("id", workerId);
  if (updateError) return { ok: false, error: errorCode(updateError) };

  const { error: delError } = await supabase.from("worker_experience").delete().eq("worker_id", workerId);
  if (delError) return { ok: false, error: errorCode(delError) };
  const entries = d.experience_level === "none" ? [] : d.entries;
  if (entries.length) {
    const rows: TablesInsert<"worker_experience">[] = entries.map((e, i) => ({
      worker_id: workerId,
      company_name: e.company_name,
      position: e.position,
      started_on: monthToDate(e.started_on),
      ended_on: e.is_current || !e.ended_on ? null : monthToDate(e.ended_on),
      is_current: e.is_current,
      responsibilities: e.responsibilities || null,
      achievements: e.achievements || null,
      sort_order: i,
    }));
    const { error: insError } = await supabase.from("worker_experience").insert(rows);
    if (insError) return { ok: false, error: errorCode(insError) };
  }
  return advance(res.ctx, 4, true);
}

// =====================================================================
// 5. Ko'nikma va tillar
// =====================================================================
export async function saveSkills(input: unknown): Promise<StepResult> {
  const parsed = skillsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const res = await getWorkerCtx({ create: true });
  if (!res.ok) return res;
  const { supabase, workerId } = res.ctx;

  const skillRows = new Map<string, Enums<"skill_level">>();
  for (const s of parsed.data.skills) skillRows.set(s.skill_id, s.level);
  const langRows = new Map<string, Enums<"language_level">>();
  for (const l of parsed.data.languages) langRows.set(l.language_code, l.level);

  const { error: delSkills } = await supabase.from("worker_skills").delete().eq("worker_id", workerId);
  if (delSkills) return { ok: false, error: errorCode(delSkills) };
  const { error: insSkills } = await supabase.from("worker_skills").insert([...skillRows].map(([skill_id, level]) => ({ worker_id: workerId, skill_id, level })));
  if (insSkills) return { ok: false, error: errorCode(insSkills) };

  const { error: delLangs } = await supabase.from("worker_languages").delete().eq("worker_id", workerId);
  if (delLangs) return { ok: false, error: errorCode(delLangs) };
  const { error: insLangs } = await supabase.from("worker_languages").insert([...langRows].map(([language_code, level]) => ({ worker_id: workerId, language_code, level })));
  if (insLangs) return { ok: false, error: errorCode(insLangs) };

  return advance(res.ctx, 5);
}

/** Foydalanuvchi qo'shgan ko'nikma (moderatsiyagacha faqat o'ziga ko'rinadi). Mavjud bo'lsa — o'sha qaytadi */
export async function createCustomSkill(input: unknown): Promise<ActionResult<{ skill: SkillOption }>> {
  const parsed = customSkillSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const session = await getSession();
  if (!session) return { ok: false, error: "not_authenticated" };
  if (session.profile.is_blocked) return { ok: false, error: "blocked" };
  const supabase = await createClient();
  const name = parsed.data.name;

  const safe = name.replace(/["\\(),.%*_]/g, " ").replace(/\s+/g, " ").trim();
  if (safe.length >= 2 && safe === name) {
    const { data: existing } = await supabase
      .from("skills")
      .select("id, name_uz, name_ru, category_id")
      .or(`name_uz.ilike."${safe}",name_ru.ilike."${safe}"`)
      .or(`is_approved.eq.true,created_by.eq.${session.userId}`)
      .limit(1)
      .maybeSingle();
    if (existing) return { ok: true, data: { skill: existing } };
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    const { data, error } = await supabase
      .from("skills")
      .insert({
        slug: customSkillSlug(name),
        name_uz: name,
        name_ru: name,
        category_id: parsed.data.category_id,
        is_custom: true,
        is_approved: false,
        created_by: session.userId,
      })
      .select("id, name_uz, name_ru, category_id")
      .single();
    if (!error && data) return { ok: true, data: { skill: data } };
    if (error && error.code !== "23505") return { ok: false, error: errorCode(error) };
  }
  return { ok: false, error: "generic" };
}

// =====================================================================
// 6. Ta'lim
// =====================================================================
export async function saveEducation(input: unknown): Promise<StepResult> {
  const parsed = educationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const res = await getWorkerCtx({ create: true });
  if (!res.ok) return res;
  const { supabase, workerId } = res.ctx;
  const d = parsed.data;

  const { error: delError } = await supabase.from("worker_education").delete().eq("worker_id", workerId);
  if (delError) return { ok: false, error: errorCode(delError) };
  const rows: TablesInsert<"worker_education">[] = d.entries.length
    ? d.entries.map((e) => ({
        worker_id: workerId,
        level: d.level,
        institution: e.institution,
        field: e.field || null,
        started_year: e.started_year,
        ended_year: e.ended_year,
      }))
    : [{ worker_id: workerId, level: d.level }];
  const { error: insError } = await supabase.from("worker_education").insert(rows);
  if (insError) return { ok: false, error: errorCode(insError) };
  return advance(res.ctx, 6);
}

// =====================================================================
// 7. Portfolio
// =====================================================================
export async function savePortfolio(input: unknown): Promise<StepResult> {
  const parsed = portfolioSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const res = await getWorkerCtx({ create: true });
  if (!res.ok) return res;
  const { supabase, workerId, session } = res.ctx;

  for (const item of parsed.data.items) {
    for (const path of item.media_paths) if (!isOwnStoragePath(path, session.userId)) return { ok: false, error: "validation" };
  }
  const { error: delError } = await supabase.from("worker_portfolio").delete().eq("worker_id", workerId);
  if (delError) return { ok: false, error: errorCode(delError) };
  if (parsed.data.items.length) {
    const rows: TablesInsert<"worker_portfolio">[] = parsed.data.items.map((i, idx) => ({
      worker_id: workerId,
      title: i.title,
      description: i.description || null,
      type: i.type,
      media_paths: i.type === "link" ? [] : i.media_paths,
      link_url: i.link_url || null,
      sort_order: idx,
    }));
    const { error: insError } = await supabase.from("worker_portfolio").insert(rows);
    if (insError) return { ok: false, error: errorCode(insError) };
  }
  return advance(res.ctx, 7);
}

// =====================================================================
// 8. Ish istagi
// =====================================================================
export async function savePreferences(input: unknown): Promise<StepResult> {
  const parsed = preferencesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const res = await getWorkerCtx({ create: true });
  if (!res.ok) return res;
  const { supabase, workerId } = res.ctx;
  const d = parsed.data;

  let officialTerms: string[] = [];
  if (d.work_format === "official" && d.official_terms.length) {
    const { data: benefits } = await supabase.from("benefits").select("code").eq("kind", "official_term").eq("is_active", true);
    const allowed = new Set((benefits ?? []).map((b) => b.code));
    officialTerms = [...new Set(d.official_terms.filter((c) => allowed.has(c)))];
  }

  const { error: prefError } = await supabase.from("worker_preferences").upsert(
    {
      worker_id: workerId,
      employment_types: d.employment_types,
      schedules: d.schedules,
      work_time_from: d.work_time_from || null,
      work_time_to: d.work_time_to || null,
      salary_min: d.salary_min,
      salary_expected: d.salary_expected,
      salary_type: d.salary_type,
      availability: d.availability,
      official_terms: officialTerms,
    },
    { onConflict: "worker_id" },
  );
  if (prefError) return { ok: false, error: errorCode(prefError) };

  const nextStep = nextStepAfter(res.ctx.savedStep, 8);
  const { error: updateError } = await supabase.from("worker_profiles").update({ work_format: d.work_format, onboarding_step: nextStep }).eq("id", workerId);
  if (updateError) return { ok: false, error: errorCode(updateError) };
  return advance(res.ctx, 8, true);
}

// =====================================================================
// "Keyinroq" (6, 7) va yakunlash
// =====================================================================
export async function skipStep(input: unknown): Promise<StepResult> {
  const parsed = skipStepSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const res = await getWorkerCtx({ create: true });
  if (!res.ok) return res;
  return advance(res.ctx, parsed.data.step);
}

/**
 * Yakunlash: profil ochiq va faol bo'ladi, to'liqlik va mosliklar qayta hisoblanadi, active_role = worker.
 * Minimal talab: ism, kasb (category_id), hudud (region_id).
 */
export async function finishOnboarding(): Promise<ActionResult<{ redirect: string }>> {
  const res = await getWorkerCtx({ create: false });
  if (!res.ok) return res;
  const { supabase, workerId, session } = res.ctx;

  if (!session.profile.first_name.trim() || !session.profile.last_name?.trim()) return { ok: false, error: "incomplete_personal" };
  const { data: contact } = await supabase.from("profile_contacts").select("phone").eq("profile_id", session.userId).maybeSingle();
  if (!contact?.phone) return { ok: false, error: "phone_required" };
  const { data: worker, error: readError } = await supabase.from("worker_profiles").select("category_id, region_id").eq("id", workerId).single();
  if (readError || !worker) return { ok: false, error: errorCode(readError) };
  if (!worker.category_id) return { ok: false, error: "incomplete_profession" };
  if (!worker.region_id) return { ok: false, error: "incomplete_location" };

  const { error: updateError } = await supabase
    .from("worker_profiles")
    .update({ onboarding_completed_at: new Date().toISOString(), status: "active", is_public: true, onboarding_step: REVIEW_STEP })
    .eq("id", workerId);
  if (updateError) return { ok: false, error: errorCode(updateError) };

  const [completeness, matches] = await Promise.all([
    supabase.rpc("refresh_worker_completeness", { p_worker_id: workerId }),
    supabase.rpc("refresh_matches_for_worker", { p_worker_id: workerId }),
  ]);
  if (completeness.error) console.error("[onboarding] refresh_worker_completeness", completeness.error.message);
  if (matches.error) console.error("[onboarding] refresh_matches_for_worker", matches.error.message);

  const { error: roleError } = await supabase.from("profiles").update({ active_role: "worker" }).eq("id", session.userId);
  if (roleError) return { ok: false, error: errorCode(roleError) };

  // E'lon majburiy moderatsiyadan (va pullik rejimda to'lovdan) keyin qidiruvga chiqadi — haqiqiy holat kabinetda
  const { data: listed } = await supabase.from("worker_profiles").select("is_public, publish_requested, moderation_state").eq("id", workerId).single();
  after(() => runBackgroundTickSafe({ moderation: 3, matchJobs: 10, telegram: 50, budgetMs: 25_000 }));

  revalidatePath("/", "layout");
  const redirect = listed?.is_public ? "/" : listed?.publish_requested && listed.moderation_state !== "allowed" ? "/cabinet" : "/profile/listing";
  return { ok: true, data: { redirect } };
}
