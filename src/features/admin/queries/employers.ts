import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Enums } from "@/types/database.types";
import { PAGE_SIZE, likeTerm, isUuid, oneOf, pageRange, parsePage, param, toPaged, type Paged, type SearchParams } from "./shared";

export interface EmployerFilters {
  q: string;
  verification: Enums<"verification_status"> | undefined;
  type: Enums<"employer_type"> | undefined;
  page: number;
}

export function parseEmployerFilters(sp: SearchParams): EmployerFilters {
  return {
    q: param(sp, "q"),
    verification: oneOf(param(sp, "verification"), ["unverified", "pending", "verified", "rejected"] as const),
    type: oneOf(param(sp, "type"), ["company", "government", "individual_entrepreneur", "self_employed", "person", "other"] as const),
    page: parsePage(sp),
  };
}

const LIST_SELECT =
  "id, profile_id, employer_type, display_name, verification_status, onboarding_completed_at, created_at, contact_phone, profiles!inner(first_name, last_name, avatar_url, is_blocked), companies(id, name, slug, logo_url, verification_status, is_blocked, tin), regions(name_uz, name_ru)" as const;

export type EmployerRow = {
  id: string;
  profile_id: string;
  employer_type: Enums<"employer_type">;
  display_name: string | null;
  verification_status: Enums<"verification_status">;
  onboarding_completed_at: string | null;
  created_at: string;
  contact_phone: string | null;
  profiles: { first_name: string; last_name: string; avatar_url: string | null; is_blocked: boolean };
  companies: { id: string; name: string; slug: string; logo_url: string | null; verification_status: Enums<"verification_status">; is_blocked: boolean; tin: string | null } | null;
  regions: { name_uz: string; name_ru: string } | null;
};

/** Ish beruvchilar (employers.view) */
export async function listEmployers(f: EmployerFilters): Promise<Paged<EmployerRow> & { error: string | null }> {
  const supabase = await createClient();
  const [from, to] = pageRange(f.page);
  let q = supabase.from("employer_profiles").select(LIST_SELECT, { count: "exact" }).order("created_at", { ascending: false }).range(from, to);
  if (f.verification) q = q.eq("verification_status", f.verification);
  if (f.type) q = q.eq("employer_type", f.type);
  if (f.q) {
    if (isUuid(f.q)) {
      q = q.or(`id.eq.${f.q},profile_id.eq.${f.q},company_id.eq.${f.q}`);
    } else {
      const term = likeTerm(f.q);
      const [{ data: byName }, { data: byCompany }] = await Promise.all([
        supabase.from("profiles").select("id").or(`first_name.ilike.${term},last_name.ilike.${term}`).limit(200),
        supabase.from("companies").select("id").ilike("name", term).limit(200),
      ]);
      const parts = [`display_name.ilike.${term}`];
      const pids = (byName ?? []).map((r) => r.id);
      const cids = (byCompany ?? []).map((r) => r.id);
      if (pids.length) parts.push(`profile_id.in.(${pids.join(",")})`);
      if (cids.length) parts.push(`company_id.in.(${cids.join(",")})`);
      q = q.or(parts.join(","));
    }
  }
  const { data, count, error } = await q;
  return { ...toPaged<EmployerRow>(data ?? [], count, f.page, PAGE_SIZE), error: error?.message ?? null };
}

/** Bitta ish beruvchi: kompaniya, a'zolar, vakansiyalar soni, so'nggi verifikatsiya */
export async function getEmployerDetail(id: string) {
  if (!isUuid(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("employer_profiles")
    .select(
      `id, profile_id, employer_type, display_name, verification_status, verification_checks, verification_note, verified_at, identity_number, onboarding_completed_at, created_at, contact_phone, about,
       profiles!inner(first_name, last_name, avatar_url, is_blocked), regions(name_uz, name_ru), districts(name_uz, name_ru),
       companies(id, name, slug, logo_url, verification_status, is_blocked, tin, phone, telegram, website, address, size, about, verified_at, created_at, company_members(role, profiles!company_members_profile_id_fkey(id, first_name, last_name)))`,
    )
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const [vac, active, ver] = await Promise.all([
    supabase.from("vacancies").select("id", { count: "exact", head: true }).eq("owner_profile_id", data.profile_id),
    supabase.from("vacancies").select("id", { count: "exact", head: true }).eq("owner_profile_id", data.profile_id).eq("status", "active"),
    supabase.from("verification_requests").select("id, type, status, created_at, review_note, note, document_paths, ai_review").eq("profile_id", data.profile_id).order("created_at", { ascending: false }).limit(5),
  ]);
  return { ...data, counts: { vacancies: vac.count ?? 0, active: active.count ?? 0 }, verifications: ver.data ?? [] };
}

export type EmployerDetail = NonNullable<Awaited<ReturnType<typeof getEmployerDetail>>>;
