import "server-only";

import { cache } from "react";
import { professionNodeIdBySlug } from "@/features/jobs/queries";
import { createClient } from "@/lib/supabase/server";
import { errorCode } from "@/lib/utils";
import { getCategories, getSubcategories, getRegions, getSkills } from "@/lib/reference";
import type { SessionContext } from "@/features/auth/session";
import type { WorkerCardData } from "@/components/shared/worker-card";
import type { MatchReason } from "@/components/shared/match-score";
import type { Database, Enums, Json } from "@/types/database.types";
import { PAGE_SIZE, isUuid, type WorkerSearchParams } from "./search-params";
import type {
  CandidateInteractions,
  CandidateMatch,
  CandidateProfile,
  CandidateRating,
  CandidateReview,
  DistanceOrigin,
  MyVacancy,
  SavedEntry,
  SavedWorkerItem,
  SkillOption,
  WorkerSearchResult,
} from "./types";

type SearchArgs = Database["public"]["Functions"]["search_workers_v2"]["Args"];

const VACANCY_COLS = "id, title, status, salary_from, salary_to, salary_type, salary_negotiable, lat, lng, published_at, created_at";

/** Men boshqaradigan vakansiyalar (egasi yoki kompaniya a'zosi). Faollari birinchi, keyin yangilari. */
export const getMyVacancies = cache(async (session: Pick<SessionContext, "userId" | "companyId">): Promise<MyVacancy[]> => {
  const supabase = await createClient();
  let q = supabase.from("vacancies").select(VACANCY_COLS).order("created_at", { ascending: false }).limit(100);
  q = session.companyId ? q.or(`owner_profile_id.eq.${session.userId},company_id.eq.${session.companyId}`) : q.eq("owner_profile_id", session.userId);
  const { data } = await q;
  const rows: MyVacancy[] = data ?? [];
  return rows.sort((a, b) => {
    if ((a.status === "active") !== (b.status === "active")) return a.status === "active" ? -1 : 1;
    return (b.published_at ?? b.created_at).localeCompare(a.published_at ?? a.created_at);
  });
});

export async function getMyActiveVacancies(session: Pick<SessionContext, "userId" | "companyId">): Promise<MyVacancy[]> {
  return (await getMyVacancies(session)).filter((v) => v.status === "active");
}

// ---------------------------------------------------------------------------
// Qidiruv
// ---------------------------------------------------------------------------

function asArray(json: Json | null | undefined): Record<string, Json | undefined>[] {
  if (!Array.isArray(json)) return [];
  return json.filter((x): x is Record<string, Json | undefined> => !!x && typeof x === "object" && !Array.isArray(x));
}

function str(v: Json | undefined): string | null {
  return typeof v === "string" ? v : null;
}

function parseSkills(json: Json | null | undefined): WorkerCardData["skills"] {
  return asArray(json).flatMap((s) => {
    const id = str(s.id);
    if (!id) return [];
    return [{ id, name_uz: str(s.name_uz) ?? "", name_ru: str(s.name_ru) ?? "", level: str(s.level) ?? "good" }];
  });
}

function parseLanguages(json: Json | null | undefined): WorkerCardData["languages"] {
  return asArray(json).flatMap((l) => {
    const code = str(l.code);
    return code ? [{ code, level: str(l.level) ?? "b1" }] : [];
  });
}

export function parseMatchReasons(json: Json | null | undefined): MatchReason[] {
  return asArray(json).flatMap((r) => {
    const key = str(r.key);
    if (!key) return [];
    const ok: MatchReason["ok"] = r.ok === true ? true : r.ok === "warn" ? "warn" : false;
    const rest: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(r)) if (k !== "key" && k !== "ok") rest[k] = v;
    return [{ ...rest, key, ok }];
  });
}

/** URL filtrlari → search_workers argumentlari (slug → id). Vakansiya va masofa nuqtasi ham hisoblanadi. */
export async function resolveSearch(params: WorkerSearchParams, session: Pick<SessionContext, "userId" | "companyId">) {
  const [categories, regions, myVacancies] = await Promise.all([getCategories(), getRegions(), getMyVacancies(session)]);
  const category = params.category ? (categories.find((c) => c.slug === params.category) ?? null) : null;
  const subcategories = category ? await getSubcategories(category.id) : [];
  const subcategory = category && params.subcategory ? (subcategories.find((s) => s.slug === params.subcategory) ?? null) : null;
  const region = params.region ? (regions.find((r) => r.slug === params.region) ?? null) : null;
  const vacancy = params.vacancy ? (myVacancies.find((v) => v.id === params.vacancy) ?? null) : null;

  let origin: DistanceOrigin | null = null;
  if (params.lat !== null && params.lng !== null) origin = { lat: params.lat, lng: params.lng, source: "me" };
  else if (vacancy?.lat != null && vacancy.lng != null) origin = { lat: vacancy.lat, lng: vacancy.lng, source: "vacancy" };

  const args: SearchArgs = {
    p_query: params.q ?? undefined,
    p_category_id: category?.id,
    p_subcategory_id: subcategory?.id,
    p_profession_node_id: params.profession ? ((await professionNodeIdBySlug(params.profession)) ?? undefined) : undefined,
    p_region_id: region?.id,
    p_district_ids: params.district.length ? params.district : undefined,
    p_experience_min_months: params.experience_min ?? undefined,
    p_salary_max: params.salary_max ?? undefined,
    p_schedules: params.schedule.length ? params.schedule : undefined,
    p_employment_types: params.employment.length ? params.employment : undefined,
    p_work_format: params.format ?? undefined,
    p_gender: params.gender ?? undefined,
    p_education_min: params.education_min ?? undefined,
    p_language_codes: params.languages.length ? params.languages : undefined,
    p_skill_ids: params.skills.length ? params.skills : undefined,
    p_statuses: params.status,
    p_availability: params.availability.length ? params.availability : undefined,
    p_has_portfolio: params.portfolio,
    p_verified_only: params.verified,
    p_remote: params.remote ?? undefined,
    p_vacancy_id: vacancy?.id,
    p_lat: origin?.lat,
    p_lng: origin?.lng,
    p_max_distance_km: origin && params.max_km !== null ? params.max_km : undefined,
    p_sort: params.sort === "distance" && !origin ? "relevant" : params.sort,
    p_limit: PAGE_SIZE,
    p_offset: (params.page - 1) * PAGE_SIZE,
  };
  return { args, category, subcategory, region, vacancy, origin, myVacancies };
}

/** search_workers_v2 (yo'nalish filtri bilan); baza eski bo'lsa — eski funksiya */
async function rpcWorkers(supabase: Awaited<ReturnType<typeof createClient>>, args: SearchArgs) {
  const res = await supabase.rpc("search_workers_v2", args);
  if (res.error?.code !== "PGRST202") return res;
  const v1 = { ...args };
  delete v1.p_profession_node_id;
  return supabase.rpc("search_workers", v1);
}

/** Faqat nomzodlar soni (bo'sh holat maslahatlari uchun). Xatoda 0. */
export async function countWorkers(params: WorkerSearchParams, session: Pick<SessionContext, "userId" | "companyId">): Promise<number> {
  const { args } = await resolveSearch({ ...params, page: 1 }, session);
  const supabase = await createClient();
  const { data, error } = await rpcWorkers(supabase, { ...args, p_limit: 1, p_offset: 0 });
  if (error) return 0;
  return Number(data?.[0]?.total_count ?? 0);
}

/** search_workers RPC → WorkerCardData ro'yxati + umumiy son */
export async function searchWorkers(args: SearchArgs): Promise<WorkerSearchResult> {
  const supabase = await createClient();
  const { data, error } = await rpcWorkers(supabase, args);
  if (error) return { rows: [], total: 0, error: errorCode(error) };
  const rows: WorkerCardData[] = (data ?? []).map((r) => ({
    id: r.id,
    first_name: r.first_name,
    last_initial: r.last_initial,
    avatar_url: r.avatar_url,
    headline: r.headline,
    category_name_uz: r.category_name_uz,
    category_name_ru: r.category_name_ru,
    region_name_uz: r.region_name_uz,
    region_name_ru: r.region_name_ru,
    district_name_uz: r.district_name_uz,
    district_name_ru: r.district_name_ru,
    experience_level: r.experience_level,
    status: r.status,
    salary_min: r.salary_min,
    salary_expected: r.salary_expected,
    employment_types: r.employment_types,
    skills: parseSkills(r.skills),
    languages: parseLanguages(r.languages),
    has_portfolio: r.has_portfolio,
    phone_verified: r.phone_verified,
    match_score: r.match_score,
    distance_km: r.distance_km,
    is_saved: r.is_saved,
  }));
  return { rows, total: Number(data?.[0]?.total_count ?? 0), error: null };
}

/** Ko'nikma tanlovi uchun: kategoriya bo'yicha + eng ko'p ishlatiladiganlar + tanlanganlar (nomi ko'rinishi uchun) */
export async function getSkillOptions(categoryId: string | null, selectedIds: string[]): Promise<SkillOption[]> {
  const supabase = await createClient();
  const [forCategory, all, selected] = await Promise.all([
    categoryId ? getSkills(categoryId) : Promise.resolve([]),
    getSkills(),
    selectedIds.length ? supabase.from("skills").select("id, name_uz, name_ru, category_id").in("id", selectedIds) : Promise.resolve({ data: [] as SkillOption[] }),
  ]);
  const seen = new Set<string>();
  const out: SkillOption[] = [];
  for (const s of [...forCategory, ...all, ...(selected.data ?? [])]) {
    if (seen.has(s.id)) continue;
    seen.add(s.id);
    out.push({ id: s.id, name_uz: s.name_uz, name_ru: s.name_ru, category_id: s.category_id });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Nomzod sahifasi
// ---------------------------------------------------------------------------

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

function publicUrl(supabase: SupabaseServer, bucket: "portfolio" | "avatars", path: string): string {
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

/** Vakansiya men boshqaradiganlar ichidami? Ro'yxatda bo'lmasa manages_vacancy RPC bilan tekshiriladi. */
export async function getManagedVacancy(vacancyId: string | null, session: Pick<SessionContext, "userId" | "companyId">): Promise<MyVacancy | null> {
  if (!vacancyId || !isUuid(vacancyId)) return null;
  const mine = (await getMyVacancies(session)).find((v) => v.id === vacancyId);
  if (mine) return mine;
  if (!(await managesVacancy(vacancyId))) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("vacancies").select(VACANCY_COLS).eq("id", vacancyId).maybeSingle();
  return data ?? null;
}

/** get_contact: telefon ko'rsatishga ruxsat bormi va tasdiqlanganmi (raqamning o'zi ContactCard'da) */
export async function getContactFlags(profileId: string): Promise<{ allowed: boolean; phoneVerified: boolean }> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_contact", { p_profile_id: profileId }).maybeSingle();
  return { allowed: data?.allowed === true, phoneVerified: data?.allowed === true && data.phone_verified === true };
}

/** worker_profiles.id bo'yicha to'liq profil. RLS yashirsa null. Koordinatalar hech qachon o'qilmaydi. */
export const getCandidate = cache(async (id: string): Promise<CandidateProfile | null> => {
  if (!isUuid(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("worker_profiles")
    .select(
      `id, profile_id, headline, about, experience_level, status, remote_preference, work_format, completeness, views_count, last_active_at,
       profile:profiles!worker_profiles_profile_id_fkey(first_name, last_name, avatar_url, birth_date, gender),
       region:regions(name_uz, name_ru),
       district:districts!worker_profiles_district_id_fkey(name_uz, name_ru),
       category:categories(id, slug, name_uz, name_ru, icon),
       subcategory:subcategories(name_uz, name_ru),
       preferences:worker_preferences(employment_types, schedules, work_time_from, work_time_to, salary_min, salary_expected, salary_type, availability, official_terms),
       locations:worker_locations(district:districts(id, name_uz, name_ru)),
       skills:worker_skills(level, skill:skills(id, name_uz, name_ru)),
       languages:worker_languages(language_code, level),
       experience:worker_experience(id, company_name, position, started_on, ended_on, is_current, responsibilities, achievements, sort_order),
       education:worker_education(id, level, institution, field, started_year, ended_year),
       portfolio:worker_portfolio(id, title, description, type, media_paths, link_url, sort_order)`,
    )
    .eq("id", id)
    .maybeSingle();
  if (!data || !data.profile) return null;

  const experience = [...data.experience].sort((a, b) => {
    if (a.is_current !== b.is_current) return a.is_current ? -1 : 1;
    return b.started_on.localeCompare(a.started_on) || a.sort_order - b.sort_order;
  });
  const education = [...data.education].sort((a, b) => (b.ended_year ?? b.started_year ?? 0) - (a.ended_year ?? a.started_year ?? 0));
  const portfolio = [...data.portfolio]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((p) => ({
      id: p.id,
      title: p.title,
      description: p.description,
      type: p.type,
      media: p.media_paths.map((path) => ({ path, url: publicUrl(supabase, "portfolio", path) })),
      link_url: p.link_url,
    }));

  return {
    id: data.id,
    profile_id: data.profile_id,
    first_name: data.profile.first_name,
    last_initial: data.profile.last_name ? data.profile.last_name.trim().charAt(0) || null : null,
    avatar_url: data.profile.avatar_url,
    birth_date: data.profile.birth_date,
    gender: data.profile.gender,
    headline: data.headline,
    about: data.about,
    experience_level: data.experience_level,
    status: data.status,
    remote_preference: data.remote_preference,
    work_format: data.work_format,
    completeness: data.completeness,
    views_count: data.views_count,
    last_active_at: data.last_active_at,
    region: data.region,
    district: data.district,
    category: data.category,
    subcategory: data.subcategory,
    preferences: data.preferences,
    work_districts: data.locations.flatMap((l) => (l.district ? [l.district] : [])),
    skills: data.skills.flatMap((s) => (s.skill ? [{ id: s.skill.id, name_uz: s.skill.name_uz, name_ru: s.skill.name_ru, level: s.level }] : [])),
    languages: data.languages.map((l) => ({ code: l.language_code, level: l.level })),
    experience,
    education,
    portfolio,
  };
});

/** Ko'rishlar sonini oshirish (xatolik e'tiborsiz) */
export async function recordWorkerView(workerId: string): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc("record_worker_view", { p_worker_id: workerId });
}

/** Vakansiya menikimi? (manages_vacancy RPC) */
export async function managesVacancy(vacancyId: string): Promise<boolean> {
  if (!isUuid(vacancyId)) return false;
  const supabase = await createClient();
  const { data } = await supabase.rpc("manages_vacancy", { p_vacancy_id: vacancyId });
  return data === true;
}

/** compute_match: nomzod ↔ vakansiya (faqat men boshqaradigan vakansiya uchun chaqiriladi) */
export async function getCandidateMatch(workerId: string, vacancyId: string): Promise<CandidateMatch | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("compute_match", { p_worker_id: workerId, p_vacancy_id: vacancyId }).maybeSingle();
  if (!data) return null;
  return { score: data.score, reasons: parseMatchReasons(data.reasons) };
}

export async function getCandidateRating(profileId: string): Promise<CandidateRating> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("profile_rating", { p_profile_id: profileId }).maybeSingle();
  return { avg: data?.avg_rating ?? null, count: Number(data?.reviews_count ?? 0) };
}

export async function getCandidateReviews(profileId: string, limit = 10): Promise<CandidateReview[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("reviews")
    .select("id, rating, text, created_at, author:profiles!reviews_author_profile_id_fkey(first_name, last_name, avatar_url)")
    .eq("target_profile_id", profileId)
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map((r) => ({
    id: r.id,
    rating: r.rating,
    text: r.text,
    created_at: r.created_at,
    author_name: r.author ? `${r.author.first_name} ${r.author.last_name.trim().charAt(0)}${r.author.last_name ? "." : ""}`.trim() : "",
    author_avatar: r.author?.avatar_url ?? null,
  }));
}

/** Men bilan nomzod o'rtasidagi ariza/taklif: chat havolasi va kutilayotgan takliflar */
export async function getCandidateInteractions(workerId: string, userId: string): Promise<CandidateInteractions> {
  const supabase = await createClient();
  const [apps, offers] = await Promise.all([
    supabase.from("applications").select("id, status, created_at").eq("worker_id", workerId).neq("status", "withdrawn").order("created_at", { ascending: false }).limit(1),
    supabase.from("job_offers").select("id, status, vacancy_id, created_at").eq("worker_id", workerId).eq("employer_profile_id", userId).order("created_at", { ascending: false }).limit(50),
  ]);
  const app = apps.data?.[0];
  const offerRows = offers.data ?? [];
  const openOffer = offerRows.find((o) => o.status === "sent" || o.status === "viewed" || o.status === "accepted");
  const chatHref = app ? `/messages/new?application_id=${app.id}` : openOffer ? `/messages/new?offer_id=${openOffer.id}` : null;
  const offeredVacancyIds = offerRows.filter((o) => (o.status === "sent" || o.status === "viewed") && o.vacancy_id).map((o) => o.vacancy_id as string);
  return { chatHref, offeredVacancyIds: [...new Set(offeredVacancyIds)] };
}

export async function getSavedEntry(workerId: string, userId: string): Promise<SavedEntry | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("saved_workers").select("folder, note").eq("employer_profile_id", userId).eq("worker_id", workerId).maybeSingle();
  return data ?? null;
}

/** Mavjud papkalar (takrorlanmas, alifbo tartibida) */
export async function getSavedFolders(userId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("saved_workers").select("folder").eq("employer_profile_id", userId).not("folder", "is", null);
  const set = new Set<string>();
  for (const r of data ?? []) if (r.folder) set.add(r.folder);
  return [...set].sort((a, b) => a.localeCompare(b));
}

// ---------------------------------------------------------------------------
// Saqlangan nomzodlar
// ---------------------------------------------------------------------------

const SAVED_CARD_SELECT = `id, headline, experience_level, status,
  profile:profiles!worker_profiles_profile_id_fkey(first_name, last_name, avatar_url),
  category:categories(name_uz, name_ru),
  region:regions(name_uz, name_ru),
  district:districts!worker_profiles_district_id_fkey(name_uz, name_ru),
  preferences:worker_preferences(salary_min, salary_expected, employment_types),
  skills:worker_skills(level, skill:skills(id, name_uz, name_ru)),
  languages:worker_languages(language_code, level),
  portfolio:worker_portfolio(id)`;

export async function getSavedWorkers(userId: string): Promise<SavedWorkerItem[]> {
  const supabase = await createClient();
  const { data: saved } = await supabase
    .from("saved_workers")
    .select("worker_id, folder, note, created_at")
    .eq("employer_profile_id", userId)
    .order("created_at", { ascending: false });
  const entries = saved ?? [];
  if (!entries.length) return [];

  const { data: workers } = await supabase
    .from("worker_profiles")
    .select(SAVED_CARD_SELECT)
    .in(
      "id",
      entries.map((e) => e.worker_id),
    );

  const cards = new Map<string, WorkerCardData>();
  for (const w of workers ?? []) {
    if (!w.profile) continue;
    cards.set(w.id, {
      id: w.id,
      first_name: w.profile.first_name,
      last_initial: w.profile.last_name ? w.profile.last_name.trim().charAt(0) || null : null,
      avatar_url: w.profile.avatar_url,
      headline: w.headline,
      category_name_uz: w.category?.name_uz ?? null,
      category_name_ru: w.category?.name_ru ?? null,
      region_name_uz: w.region?.name_uz ?? null,
      region_name_ru: w.region?.name_ru ?? null,
      district_name_uz: w.district?.name_uz ?? null,
      district_name_ru: w.district?.name_ru ?? null,
      experience_level: w.experience_level,
      status: w.status,
      salary_min: w.preferences?.salary_min ?? null,
      salary_expected: w.preferences?.salary_expected ?? null,
      employment_types: w.preferences?.employment_types ?? null,
      skills: w.skills.flatMap((s) => (s.skill ? [{ id: s.skill.id, name_uz: s.skill.name_uz, name_ru: s.skill.name_ru, level: s.level }] : [])),
      languages: w.languages.map((l) => ({ code: l.language_code, level: l.level })),
      has_portfolio: w.portfolio.length > 0,
      phone_verified: null,
      match_score: null,
      distance_km: null,
      is_saved: true,
    });
  }

  return entries.map((e) => ({ worker_id: e.worker_id, folder: e.folder, note: e.note, created_at: e.created_at, card: cards.get(e.worker_id) ?? null }));
}

export type { Enums };
