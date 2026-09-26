import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Enums } from "@/types/database.types";
import { PAGE_SIZE, likeTerm, isUuid, oneOf, pageRange, parsePage, param, toPaged, type Paged, type SearchParams } from "./shared";

export interface UserRow {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  created_at: string;
  last_seen_at: string | null;
  is_blocked: boolean;
  blocked_reason: string | null;
  locale: Enums<"app_locale">;
  roles: Enums<"app_role">[];
  phone: string | null;
  telegram_username: string | null;
}

export interface UserFilters {
  q: string;
  role: Enums<"app_role"> | undefined;
  blocked: "yes" | "no" | undefined;
  page: number;
}

export function parseUserFilters(sp: SearchParams): UserFilters {
  return {
    q: param(sp, "q"),
    role: oneOf(param(sp, "role"), ["worker", "employer"] as const),
    blocked: oneOf(param(sp, "blocked"), ["yes", "no"] as const),
    page: parsePage(sp),
  };
}

const BASE = "id, first_name, last_name, avatar_url, created_at, last_seen_at, is_blocked, blocked_reason, locale, profile_contacts(phone, telegram_username), telegram_accounts(username)" as const;

interface RawUser {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  created_at: string;
  last_seen_at: string | null;
  is_blocked: boolean;
  blocked_reason: string | null;
  locale: Enums<"app_locale">;
  profile_contacts: { phone: string | null; telegram_username: string | null } | null;
  telegram_accounts: { username: string | null } | null;
  user_roles: { role: Enums<"app_role"> }[];
}

function mapUser(r: RawUser): UserRow {
  return {
    id: r.id,
    first_name: r.first_name,
    last_name: r.last_name,
    avatar_url: r.avatar_url,
    created_at: r.created_at,
    last_seen_at: r.last_seen_at,
    is_blocked: r.is_blocked,
    blocked_reason: r.blocked_reason,
    locale: r.locale,
    roles: r.user_roles.map((x) => x.role),
    phone: r.profile_contacts?.phone ?? null,
    telegram_username: r.profile_contacts?.telegram_username ?? r.telegram_accounts?.username ?? null,
  };
}

/** Profil ro'yxati (users.view). Telefon profile_contacts dan — RLS admin uchun ochiq. */
export async function listUsers(f: UserFilters): Promise<Paged<UserRow> & { error: string | null }> {
  const supabase = await createClient();
  const [from, to] = pageRange(f.page);
  const search = f.q ? (isUuid(f.q) ? `id.eq.${f.q}` : `first_name.ilike.${likeTerm(f.q)},last_name.ilike.${likeTerm(f.q)}`) : null;

  if (f.role) {
    let q = supabase
      .from("profiles")
      .select(`${BASE}, user_roles!inner(role)`, { count: "exact" })
      .eq("user_roles.role", f.role)
      .order("created_at", { ascending: false })
      .range(from, to);
    if (search) q = q.or(search);
    if (f.blocked) q = q.eq("is_blocked", f.blocked === "yes");
    const { data, count, error } = await q;
    return { ...toPaged((data ?? []).map(mapUser), count, f.page, PAGE_SIZE), error: error?.message ?? null };
  }

  let q = supabase
    .from("profiles")
    .select(`${BASE}, user_roles(role)`, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);
  if (search) q = q.or(search);
  if (f.blocked) q = q.eq("is_blocked", f.blocked === "yes");
  const { data, count, error } = await q;
  return { ...toPaged((data ?? []).map(mapUser), count, f.page, PAGE_SIZE), error: error?.message ?? null };
}

export interface UserDetail extends UserRow {
  email: string | null;
  phone_verified_at: string | null;
  phone_visibility: Enums<"phone_visibility"> | null;
  birth_date: string | null;
  gender: Enums<"gender"> | null;
  blocked_at: string | null;
  telegram: { telegram_user_id: number; username: string | null; bot_started: boolean; linked_at: string } | null;
  worker: {
    id: string;
    headline: string | null;
    status: Enums<"worker_status">;
    completeness: number;
    is_public: boolean;
    onboarding_completed_at: string | null;
    category: { name_uz: string; name_ru: string } | null;
    region: { name_uz: string; name_ru: string } | null;
  } | null;
  employer: {
    id: string;
    employer_type: Enums<"employer_type">;
    display_name: string | null;
    verification_status: Enums<"verification_status">;
    onboarding_completed_at: string | null;
    company: { id: string; name: string; slug: string; verification_status: Enums<"verification_status"> } | null;
  } | null;
  admin: { role: Enums<"admin_role">; is_active: boolean } | null;
  counts: { vacancies: number; applications: number; reports_against: number };
}

/** Bitta foydalanuvchi: profil + kontakt + rol + worker/employer xulosasi */
export async function getUserDetail(id: string): Promise<UserDetail | null> {
  if (!isUuid(id)) return null;
  const supabase = await createClient();
  const { data: p } = await supabase
    .from("profiles")
    .select(
      `id, first_name, last_name, avatar_url, created_at, last_seen_at, is_blocked, blocked_reason, locale, birth_date, gender, blocked_at, user_roles(role),
       profile_contacts(phone, telegram_username, email, phone_verified_at, phone_visibility),
       telegram_accounts(telegram_user_id, username, bot_started, linked_at),
       worker_profiles(id, headline, status, completeness, is_public, onboarding_completed_at, categories(name_uz, name_ru), regions(name_uz, name_ru)),
       employer_profiles(id, employer_type, display_name, verification_status, onboarding_completed_at, companies(id, name, slug, verification_status)),
       admin_users!admin_users_profile_id_fkey(role, is_active)`,
    )
    .eq("id", id)
    .maybeSingle();
  if (!p) return null;

  const workerId = p.worker_profiles?.id ?? null;
  const [vacancies, applications, reportsAgainst] = await Promise.all([
    supabase.from("vacancies").select("id", { count: "exact", head: true }).eq("owner_profile_id", id),
    workerId ? supabase.from("applications").select("id", { count: "exact", head: true }).eq("worker_id", workerId) : Promise.resolve({ count: 0 }),
    supabase.from("reports").select("id", { count: "exact", head: true }).eq("target_type", "profile").eq("target_id", id),
  ]);

  return {
    ...mapUser(p),
    email: p.profile_contacts?.email ?? null,
    phone_verified_at: p.profile_contacts?.phone_verified_at ?? null,
    phone_visibility: p.profile_contacts?.phone_visibility ?? null,
    birth_date: p.birth_date,
    gender: p.gender,
    blocked_at: p.blocked_at,
    telegram: p.telegram_accounts,
    worker: p.worker_profiles
      ? {
          id: p.worker_profiles.id,
          headline: p.worker_profiles.headline,
          status: p.worker_profiles.status,
          completeness: p.worker_profiles.completeness,
          is_public: p.worker_profiles.is_public,
          onboarding_completed_at: p.worker_profiles.onboarding_completed_at,
          category: p.worker_profiles.categories,
          region: p.worker_profiles.regions,
        }
      : null,
    employer: p.employer_profiles
      ? {
          id: p.employer_profiles.id,
          employer_type: p.employer_profiles.employer_type,
          display_name: p.employer_profiles.display_name,
          verification_status: p.employer_profiles.verification_status,
          onboarding_completed_at: p.employer_profiles.onboarding_completed_at,
          company: p.employer_profiles.companies,
        }
      : null,
    admin: p.admin_users,
    counts: { vacancies: vacancies.count ?? 0, applications: applications.count ?? 0, reports_against: reportsAgainst.count ?? 0 },
  };
}

/** Rol bo'yicha faol (bloklanmagan) profillar soni — broadcast uchun taxminiy qabul qiluvchilar */
export async function countRecipients(role: Enums<"app_role"> | null): Promise<number> {
  const supabase = await createClient();
  if (!role) {
    const { count } = await supabase.from("profiles").select("id", { count: "exact", head: true }).eq("is_blocked", false);
    return count ?? 0;
  }
  const { count } = await supabase.from("profiles").select("id, user_roles!inner(role)", { count: "exact", head: true }).eq("is_blocked", false).eq("user_roles.role", role);
  return count ?? 0;
}
