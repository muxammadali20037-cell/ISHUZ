"use server";

import { revalidatePath } from "next/cache";
import { safeFilterValue } from "@/lib/security/postgrest";
import { prefCookie } from "@/lib/security/cookies";
import { after } from "next/server";
import { runBackgroundTickSafe } from "@/features/notifications/tick";
import { cookies } from "next/headers";
import { createClient, type SupabaseServerClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/features/auth/actions";
import { getSession, type SessionContext } from "@/features/auth/session";
import { errorCode } from "@/lib/utils";
import { AVATAR_MIME, customSkillSlug, reorderItems, THEME_COOKIE } from "./pure";
import {
  aboutSchema,
  avatarPathSchema,
  categorySchema,
  customSkillSchema,
  educationSchema,
  experienceSchema,
  idSchema,
  languagesSchema,
  locationSchema,
  moveSchema,
  personalSchema,
  phoneVisibilitySchema,
  portfolioItemSchema,
  preferencesSchema,
  revokeGrantSchema,
  skillsSchema,
  themeSchema,
  visibilitySchema,
  workerStatusSchema,
} from "./schema";

// ---------- yordamchilar ----------

type Ctx = { ok: true; session: SessionContext; supabase: SupabaseServerClient };
type WorkerCtx = Ctx & { workerId: string };
type Fail = { ok: false; error: string };

async function ctx(): Promise<Ctx | Fail> {
  const session = await getSession();
  if (!session) return { ok: false, error: "not_authenticated" };
  if (session.profile.is_blocked) return { ok: false, error: "blocked" };
  return { ok: true, session, supabase: await createClient() };
}

async function workerCtx(): Promise<WorkerCtx | Fail> {
  const c = await ctx();
  if (!c.ok) return c;
  if (!c.session.workerId) return { ok: false, error: "forbidden" };
  return { ...c, workerId: c.session.workerId };
}

/** DB check-constraint nomlari → foydalanuvchi uchun xato kodi */
function dbError(error: unknown): string {
  const msg = typeof error === "object" && error && "message" in error ? String((error as { message: unknown }).message) : "";
  if (/profiles_birth_date_check/.test(msg)) return "invalid_birth_date";
  if (/worker_experience_dates_check|worker_experience_current_check|worker_education_years_check/.test(msg)) return "invalid_dates";
  if (/worker_preferences_salary_check/.test(msg)) return "salary_range";
  if (/worker_portfolio_link_check/.test(msg)) return "invalid_url";
  if (/worker_portfolio_media_limit/.test(msg)) return "too_many_files";
  const code = errorCode(error);
  return code === "unknown" ? "generic" : code;
}

function revalidateProfile() {
  for (const p of ["/profile", "/profile/edit", "/profile/cv", "/profile/portfolio", "/settings"]) revalidatePath(p);
  revalidatePath("/profile", "layout");
}

async function afterWorkerSave(supabase: SupabaseServerClient, workerId: string, opts: { matches?: boolean } = {}) {
  await supabase.rpc("refresh_worker_completeness", { p_worker_id: workerId });
  if (opts.matches) await supabase.rpc("refresh_matches_for_worker", { p_worker_id: workerId });
  revalidateProfile();
}

const AVATAR_EXTS = Object.values(AVATAR_MIME);

// ---------- holat ----------

export async function updateWorkerStatus(input: unknown): Promise<ActionResult> {
  const parsed = workerStatusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const c = await workerCtx();
  if (!c.ok) return c;
  const { error } = await c.supabase.from("worker_profiles").update({ status: parsed.data.status }).eq("id", c.workerId);
  if (error) return { ok: false, error: dbError(error) };
  revalidateProfile();
  return { ok: true };
}

// ---------- shaxsiy ----------

export async function updatePersonal(input: unknown): Promise<ActionResult> {
  const parsed = personalSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.some((i) => i.message === "invalid_birth_date") ? "invalid_birth_date" : "validation" };
  const c = await ctx();
  if (!c.ok) return c;
  const { error } = await c.supabase
    .from("profiles")
    .update({ first_name: parsed.data.first_name, last_name: parsed.data.last_name, birth_date: parsed.data.birth_date, gender: parsed.data.gender })
    .eq("id", c.session.userId);
  if (error) return { ok: false, error: dbError(error) };
  if (c.session.workerId) await afterWorkerSave(c.supabase, c.session.workerId);
  else revalidateProfile();
  return { ok: true };
}

/** Client storage'ga yuklagandan so'ng: yo'lni tekshirib profiles.avatar_url ga public URL yoziladi */
export async function setAvatar(input: unknown): Promise<ActionResult<{ url: string }>> {
  const parsed = avatarPathSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const c = await ctx();
  if (!c.ok) return c;
  const path = parsed.data.path;
  const m = new RegExp(`^${c.session.userId}/avatar\\.(${AVATAR_EXTS.join("|")})$`).exec(path);
  if (!m) return { ok: false, error: "validation" };
  const base = c.supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
  const url = `${base}?v=${Date.now()}`;
  const { error } = await c.supabase.from("profiles").update({ avatar_url: url }).eq("id", c.session.userId);
  if (error) return { ok: false, error: dbError(error) };
  // eski kengaytmadagi rasmni tozalash (xato bo'lsa e'tiborsiz)
  const stale = AVATAR_EXTS.filter((e) => e !== m[1]).map((e) => `${c.session.userId}/avatar.${e}`);
  await c.supabase.storage.from("avatars").remove(stale);
  if (c.session.workerId) await afterWorkerSave(c.supabase, c.session.workerId);
  else revalidateProfile();
  return { ok: true, data: { url } };
}

export async function removeAvatar(): Promise<ActionResult> {
  const c = await ctx();
  if (!c.ok) return c;
  const { error } = await c.supabase.from("profiles").update({ avatar_url: null }).eq("id", c.session.userId);
  if (error) return { ok: false, error: dbError(error) };
  await c.supabase.storage.from("avatars").remove(AVATAR_EXTS.map((e) => `${c.session.userId}/avatar.${e}`));
  if (c.session.workerId) await afterWorkerSave(c.supabase, c.session.workerId);
  else revalidateProfile();
  return { ok: true };
}

// ---------- men haqimda ----------

export async function updateAbout(input: unknown): Promise<ActionResult> {
  const parsed = aboutSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const c = await workerCtx();
  if (!c.ok) return c;
  const { error } = await c.supabase
    .from("worker_profiles")
    .update({ headline: parsed.data.headline || null, about: parsed.data.about || null })
    .eq("id", c.workerId);
  if (error) return { ok: false, error: dbError(error) };
  await afterWorkerSave(c.supabase, c.workerId);
  return { ok: true };
}

// ---------- joylashuv ----------

export async function updateLocation(input: unknown): Promise<ActionResult> {
  const parsed = locationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const c = await workerCtx();
  if (!c.ok) return c;
  const d = parsed.data;

  let regionId = d.region_id;
  let districtId = d.district_id;
  if (districtId) {
    const { data: district } = await c.supabase.from("districts").select("id, region_id").eq("id", districtId).maybeSingle();
    if (!district) districtId = null;
    else regionId = district.region_id;
  }

  const { error } = await c.supabase
    .from("worker_profiles")
    .update({ region_id: regionId, district_id: districtId, area_hint: d.area_hint || null, remote_preference: d.remote_preference })
    .eq("id", c.workerId);
  if (error) return { ok: false, error: dbError(error) };

  // ishlash tumanlari: to'liq almashtirish
  const ids = [...new Set(d.work_district_ids)];
  const del = await c.supabase.from("worker_locations").delete().eq("worker_id", c.workerId);
  if (del.error) return { ok: false, error: dbError(del.error) };
  if (ids.length) {
    const ins = await c.supabase.from("worker_locations").insert(ids.map((district_id) => ({ worker_id: c.workerId, district_id })));
    if (ins.error) return { ok: false, error: dbError(ins.error) };
  }

  // aniq joylashuv (faqat masofa uchun)
  const geoRes = d.geo
    ? await c.supabase.from("worker_geo").upsert({ worker_id: c.workerId, lat: d.geo.lat, lng: d.geo.lng }, { onConflict: "worker_id" })
    : await c.supabase.from("worker_geo").delete().eq("worker_id", c.workerId);
  if (geoRes.error) return { ok: false, error: dbError(geoRes.error) };

  await afterWorkerSave(c.supabase, c.workerId, { matches: true });
  return { ok: true };
}

// ---------- kasb ----------

export async function updateCategory(input: unknown): Promise<ActionResult> {
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const c = await workerCtx();
  if (!c.ok) return c;
  let subcategoryId = parsed.data.subcategory_id;
  if (subcategoryId) {
    const { data: sub } = await c.supabase.from("subcategories").select("id, category_id").eq("id", subcategoryId).maybeSingle();
    if (!sub || sub.category_id !== parsed.data.category_id) subcategoryId = null;
  }
  const { error } = await c.supabase
    .from("worker_profiles")
    .update({ category_id: parsed.data.category_id, subcategory_id: subcategoryId, experience_level: parsed.data.experience_level })
    .eq("id", c.workerId);
  if (error) return { ok: false, error: dbError(error) };
  await afterWorkerSave(c.supabase, c.workerId, { matches: true });
  return { ok: true };
}

// ---------- tajriba ----------

export async function saveExperience(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = experienceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.some((i) => i.message === "invalid_dates") ? "invalid_dates" : "validation" };
  const c = await workerCtx();
  if (!c.ok) return c;
  const d = parsed.data;
  const row = {
    company_name: d.company_name,
    position: d.position,
    started_on: d.started_on,
    ended_on: d.is_current ? null : d.ended_on,
    is_current: d.is_current,
    responsibilities: d.responsibilities || null,
    achievements: d.achievements || null,
  };
  const res = d.id
    ? await c.supabase.from("worker_experience").update(row).eq("id", d.id).eq("worker_id", c.workerId).select("id").maybeSingle()
    : await c.supabase.from("worker_experience").insert({ ...row, worker_id: c.workerId }).select("id").single();
  if (res.error) return { ok: false, error: dbError(res.error) };
  if (!res.data) return { ok: false, error: "not_found" };
  await afterWorkerSave(c.supabase, c.workerId, { matches: true });
  return { ok: true, data: { id: res.data.id } };
}

export async function deleteExperience(input: unknown): Promise<ActionResult> {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const c = await workerCtx();
  if (!c.ok) return c;
  const { error } = await c.supabase.from("worker_experience").delete().eq("id", parsed.data.id).eq("worker_id", c.workerId);
  if (error) return { ok: false, error: dbError(error) };
  await afterWorkerSave(c.supabase, c.workerId);
  return { ok: true };
}

// ---------- ko'nikmalar ----------

export async function updateSkills(input: unknown): Promise<ActionResult> {
  const parsed = skillsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const c = await workerCtx();
  if (!c.ok) return c;
  const next = new Map(parsed.data.skills.map((s) => [s.skill_id, s.level]));
  const { data: current, error: readErr } = await c.supabase.from("worker_skills").select("skill_id").eq("worker_id", c.workerId);
  if (readErr) return { ok: false, error: dbError(readErr) };
  const removed = (current ?? []).map((r) => r.skill_id).filter((id) => !next.has(id));
  if (removed.length) {
    const { error } = await c.supabase.from("worker_skills").delete().eq("worker_id", c.workerId).in("skill_id", removed);
    if (error) return { ok: false, error: dbError(error) };
  }
  if (next.size) {
    const rows = [...next.entries()].map(([skill_id, level]) => ({ worker_id: c.workerId, skill_id, level }));
    const { error } = await c.supabase.from("worker_skills").upsert(rows, { onConflict: "worker_id,skill_id" });
    if (error) return { ok: false, error: dbError(error) };
  }
  await afterWorkerSave(c.supabase, c.workerId, { matches: true });
  return { ok: true };
}

/** Ro'yxatda yo'q ko'nikma: is_custom, moderatsiyagacha faqat egasiga ko'rinadi */
export async function createCustomSkill(input: unknown): Promise<ActionResult<{ id: string; name_uz: string; name_ru: string; slug: string }>> {
  const parsed = customSkillSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const c = await ctx();
  if (!c.ok) return c;
  const name = parsed.data.name;
  // mavjud tasdiqlangan ko'nikma bo'lsa — o'shani qaytaramiz
  const { data: existing } = await c.supabase
    .from("skills")
    .select("id, name_uz, name_ru, slug")
    .or(`name_uz.ilike.${safeFilterValue(name)},name_ru.ilike.${safeFilterValue(name)}`)
    .limit(1)
    .maybeSingle();
  if (existing) return { ok: true, data: existing };
  const { data, error } = await c.supabase
    .from("skills")
    .insert({
      slug: customSkillSlug(name),
      name_uz: name,
      name_ru: name,
      category_id: parsed.data.category_id ?? null,
      is_custom: true,
      is_approved: false,
      created_by: c.session.userId,
    })
    .select("id, name_uz, name_ru, slug")
    .single();
  if (error) return { ok: false, error: dbError(error) };
  return { ok: true, data };
}

// ---------- tillar ----------

export async function updateLanguages(input: unknown): Promise<ActionResult> {
  const parsed = languagesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const c = await workerCtx();
  if (!c.ok) return c;
  const next = new Map(parsed.data.languages.map((l) => [l.code, l.level]));
  const { data: current, error: readErr } = await c.supabase.from("worker_languages").select("language_code").eq("worker_id", c.workerId);
  if (readErr) return { ok: false, error: dbError(readErr) };
  const removed = (current ?? []).map((r) => r.language_code).filter((code) => !next.has(code));
  if (removed.length) {
    const { error } = await c.supabase.from("worker_languages").delete().eq("worker_id", c.workerId).in("language_code", removed);
    if (error) return { ok: false, error: dbError(error) };
  }
  if (next.size) {
    const rows = [...next.entries()].map(([language_code, level]) => ({ worker_id: c.workerId, language_code, level }));
    const { error } = await c.supabase.from("worker_languages").upsert(rows, { onConflict: "worker_id,language_code" });
    if (error) return { ok: false, error: dbError(error) };
  }
  await afterWorkerSave(c.supabase, c.workerId, { matches: true });
  return { ok: true };
}

// ---------- ta'lim ----------

export async function saveEducation(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = educationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.some((i) => i.message === "invalid_dates") ? "invalid_dates" : "validation" };
  const c = await workerCtx();
  if (!c.ok) return c;
  const d = parsed.data;
  const row = { level: d.level, institution: d.institution || null, field: d.field || null, started_year: d.started_year, ended_year: d.ended_year };
  const res = d.id
    ? await c.supabase.from("worker_education").update(row).eq("id", d.id).eq("worker_id", c.workerId).select("id").maybeSingle()
    : await c.supabase.from("worker_education").insert({ ...row, worker_id: c.workerId }).select("id").single();
  if (res.error) return { ok: false, error: dbError(res.error) };
  if (!res.data) return { ok: false, error: "not_found" };
  await afterWorkerSave(c.supabase, c.workerId, { matches: true });
  return { ok: true, data: { id: res.data.id } };
}

export async function deleteEducation(input: unknown): Promise<ActionResult> {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const c = await workerCtx();
  if (!c.ok) return c;
  const { error } = await c.supabase.from("worker_education").delete().eq("id", parsed.data.id).eq("worker_id", c.workerId);
  if (error) return { ok: false, error: dbError(error) };
  await afterWorkerSave(c.supabase, c.workerId);
  return { ok: true };
}

// ---------- ish istaklari ----------

export async function updatePreferences(input: unknown): Promise<ActionResult> {
  const parsed = preferencesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.some((i) => i.message === "salary_range") ? "salary_range" : "validation" };
  const c = await workerCtx();
  if (!c.ok) return c;
  const d = parsed.data;
  const pref = await c.supabase.from("worker_preferences").upsert(
    {
      worker_id: c.workerId,
      employment_types: d.employment_types,
      schedules: d.schedules,
      work_time_from: d.work_time_from,
      work_time_to: d.work_time_to,
      salary_min: d.salary_min,
      salary_expected: d.salary_expected,
      salary_type: d.salary_type,
      availability: d.availability,
      official_terms: d.official_terms,
    },
    { onConflict: "worker_id" },
  );
  if (pref.error) return { ok: false, error: dbError(pref.error) };
  const wp = await c.supabase.from("worker_profiles").update({ work_format: d.work_format }).eq("id", c.workerId);
  if (wp.error) return { ok: false, error: dbError(wp.error) };
  await afterWorkerSave(c.supabase, c.workerId, { matches: true });
  return { ok: true };
}

// ---------- ko'rinish ----------

export async function updateVisibility(input: unknown): Promise<ActionResult> {
  const parsed = visibilitySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const c = await workerCtx();
  if (!c.ok) return c;
  const { error } = await c.supabase.from("worker_profiles").update({ is_public: parsed.data.is_public }).eq("id", c.workerId);
  if (error) return { ok: false, error: dbError(error) };
  // ochiq qilish so'rovi moderatsiyadan o'tgach qidiruvga chiqadi
  if (parsed.data.is_public) after(() => runBackgroundTickSafe({ moderation: 3, matchJobs: 10, telegram: 50, budgetMs: 25_000 }));
  revalidateProfile();
  return { ok: true };
}

// ---------- portfolio ----------

export async function savePortfolioItem(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = portfolioItemSchema.safeParse(input);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message;
    return { ok: false, error: msg === "link_required" || msg === "media_required" ? msg : "validation" };
  }
  const c = await workerCtx();
  if (!c.ok) return c;
  const d = parsed.data;
  const prefix = `${c.session.userId}/`;
  if (d.media_paths.some((p) => !p.startsWith(prefix) || p.includes(".."))) return { ok: false, error: "validation" };
  const mediaPaths = d.type === "link" ? [] : [...new Set(d.media_paths)];
  const row = { title: d.title, description: d.description || null, type: d.type, media_paths: mediaPaths, link_url: d.link_url };

  if (d.id) {
    const { data: existing } = await c.supabase.from("worker_portfolio").select("id, media_paths").eq("id", d.id).eq("worker_id", c.workerId).maybeSingle();
    if (!existing) return { ok: false, error: "not_found" };
    const { error } = await c.supabase.from("worker_portfolio").update(row).eq("id", d.id).eq("worker_id", c.workerId);
    if (error) return { ok: false, error: dbError(error) };
    const removed = existing.media_paths.filter((p) => !mediaPaths.includes(p));
    if (removed.length) await c.supabase.storage.from("portfolio").remove(removed);
    await afterWorkerSave(c.supabase, c.workerId);
    return { ok: true, data: { id: d.id } };
  }

  const { count } = await c.supabase.from("worker_portfolio").select("id", { count: "exact", head: true }).eq("worker_id", c.workerId);
  const { data, error } = await c.supabase
    .from("worker_portfolio")
    .insert({ ...row, worker_id: c.workerId, sort_order: count ?? 0 })
    .select("id")
    .single();
  if (error) return { ok: false, error: dbError(error) };
  await afterWorkerSave(c.supabase, c.workerId);
  return { ok: true, data: { id: data.id } };
}

export async function deletePortfolioItem(input: unknown): Promise<ActionResult> {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const c = await workerCtx();
  if (!c.ok) return c;
  const { data: item } = await c.supabase.from("worker_portfolio").select("id, media_paths").eq("id", parsed.data.id).eq("worker_id", c.workerId).maybeSingle();
  if (!item) return { ok: false, error: "not_found" };
  const { error } = await c.supabase.from("worker_portfolio").delete().eq("id", item.id).eq("worker_id", c.workerId);
  if (error) return { ok: false, error: dbError(error) };
  if (item.media_paths.length) await c.supabase.storage.from("portfolio").remove(item.media_paths);
  await afterWorkerSave(c.supabase, c.workerId);
  return { ok: true };
}

export async function movePortfolioItem(input: unknown): Promise<ActionResult> {
  const parsed = moveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const c = await workerCtx();
  if (!c.ok) return c;
  const { data: items, error: readErr } = await c.supabase.from("worker_portfolio").select("id").eq("worker_id", c.workerId).order("sort_order").order("created_at");
  if (readErr) return { ok: false, error: dbError(readErr) };
  const next = reorderItems(items ?? [], parsed.data.id, parsed.data.direction);
  if (!next) return { ok: true };
  const results = await Promise.all(next.map((n) => c.supabase.from("worker_portfolio").update({ sort_order: n.sort_order }).eq("id", n.id).eq("worker_id", c.workerId)));
  const failed = results.find((r) => r.error);
  if (failed?.error) return { ok: false, error: dbError(failed.error) };
  revalidateProfile();
  return { ok: true };
}

// ---------- sozlamalar ----------

export async function updatePhoneVisibility(input: unknown): Promise<ActionResult> {
  const parsed = phoneVisibilitySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const c = await ctx();
  if (!c.ok) return c;
  const { error } = await c.supabase.from("profile_contacts").update({ phone_visibility: parsed.data.phone_visibility }).eq("profile_id", c.session.userId);
  if (error) return { ok: false, error: dbError(error) };
  revalidateProfile();
  return { ok: true };
}

export async function revokeContactGrant(input: unknown): Promise<ActionResult> {
  const parsed = revokeGrantSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const c = await ctx();
  if (!c.ok) return c;
  const { error } = await c.supabase.from("contact_grants").delete().eq("owner_profile_id", c.session.userId).eq("grantee_profile_id", parsed.data.grantee_profile_id);
  if (error) return { ok: false, error: dbError(error) };
  revalidatePath("/settings");
  return { ok: true };
}

/** Mavzu: cookie (system → cookie o'chiriladi, prefers-color-scheme ga ergashadi) */
export async function setTheme(input: unknown): Promise<ActionResult> {
  const parsed = themeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const store = await cookies();
  if (parsed.data.theme === "system") store.delete(THEME_COOKIE);
  else store.set(THEME_COOKIE, parsed.data.theme, prefCookie(60 * 60 * 24 * 365));
  return { ok: true };
}
