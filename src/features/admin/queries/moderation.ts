import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Enums, Tables } from "@/types/database.types";
import { PAGE_SIZE, isUuid, oneOf, pageRange, parsePage, param, toPaged, type Paged, type SearchParams } from "./shared";

// =====================================================================
// Shikoyatlar
// =====================================================================
export const REPORT_STATUSES = ["open", "in_review", "resolved", "dismissed"] as const;

type Person = { id: string; first_name: string; last_name: string; is_blocked: boolean } | null;

export interface ReportTarget {
  type: Enums<"report_target">;
  id: string;
  /** Odam bo'lsa — ism, vakansiya — sarlavha, kompaniya — nom */
  label: string | null;
  /** Havola (admin ichida yoki public sahifa) */
  href: string | null;
  /** target profil (profile / vacancy egasi / company yaratuvchisi) — tez bloklash uchun */
  profileId: string | null;
  profileBlocked: boolean;
  vacancyStatus: Enums<"vacancy_status"> | null;
  /** message shikoyati uchun (chat.moderate bo'lsa) */
  message: { conversation_id: string; body: string | null; type: Enums<"message_type">; created_at: string } | null;
}

export type ReportRow = Tables<"reports"> & {
  reporter: Person;
  resolver: Person;
  target: ReportTarget;
};

export interface ReportFilters {
  status: Enums<"report_status">;
  page: number;
}

export function parseReportFilters(sp: SearchParams): ReportFilters {
  return { status: oneOf(param(sp, "status"), REPORT_STATUSES) ?? "open", page: parsePage(sp) };
}

async function resolveTargets(rows: Tables<"reports">[]): Promise<Map<string, ReportTarget>> {
  const supabase = await createClient();
  const map = new Map<string, ReportTarget>();
  const byType = (t: Enums<"report_target">) => [...new Set(rows.filter((r) => r.target_type === t && isUuid(r.target_id)).map((r) => r.target_id))];
  const profileIds = byType("profile");
  const vacancyIds = byType("vacancy");
  const companyIds = byType("company");
  const reviewIds = byType("review");
  const messageIds = [...new Set(rows.filter((r) => r.target_type === "message" && /^\d{1,18}$/.test(r.target_id)).map((r) => Number(r.target_id)))];

  const [profiles, vacancies, companies, reviews, messages] = await Promise.all([
    profileIds.length ? supabase.from("profiles").select("id, first_name, last_name, is_blocked").in("id", profileIds) : Promise.resolve({ data: [] }),
    vacancyIds.length ? supabase.from("vacancies").select("id, title, slug, status, owner_profile_id, profiles!vacancies_owner_profile_id_fkey(is_blocked)").in("id", vacancyIds) : Promise.resolve({ data: [] }),
    companyIds.length ? supabase.from("companies").select("id, name, slug, created_by, profiles!companies_created_by_fkey(is_blocked)").in("id", companyIds) : Promise.resolve({ data: [] }),
    reviewIds.length ? supabase.from("reviews").select("id, author_profile_id, text, profiles!reviews_author_profile_id_fkey(first_name, last_name, is_blocked)").in("id", reviewIds) : Promise.resolve({ data: [] }),
    // RLS: faqat chat.moderate ruxsati bo'lsa qaytadi
    messageIds.length ? supabase.from("messages").select("id, conversation_id, sender_id, body, type, created_at, profiles(first_name, last_name, is_blocked)").in("id", messageIds) : Promise.resolve({ data: [] }),
  ]);

  for (const r of rows) {
    const key = `${r.target_type}:${r.target_id}`;
    const base: ReportTarget = { type: r.target_type, id: r.target_id, label: null, href: null, profileId: null, profileBlocked: false, vacancyStatus: null, message: null };
    if (r.target_type === "profile") {
      const p = (profiles.data ?? []).find((x) => x.id === r.target_id);
      map.set(key, { ...base, label: p ? `${p.first_name} ${p.last_name}`.trim() : null, href: `/admin/users?q=${r.target_id}`, profileId: r.target_id, profileBlocked: p?.is_blocked ?? false });
    } else if (r.target_type === "vacancy") {
      const v = (vacancies.data ?? []).find((x) => x.id === r.target_id);
      map.set(key, { ...base, label: v?.title ?? null, href: `/admin/vacancies?q=${r.target_id}`, profileId: v?.owner_profile_id ?? null, profileBlocked: v?.profiles?.is_blocked ?? false, vacancyStatus: v?.status ?? null });
    } else if (r.target_type === "company") {
      const c = (companies.data ?? []).find((x) => x.id === r.target_id);
      map.set(key, { ...base, label: c?.name ?? null, href: c ? `/company/${c.slug}` : null, profileId: c?.created_by ?? null, profileBlocked: c?.profiles?.is_blocked ?? false });
    } else if (r.target_type === "review") {
      const rv = (reviews.data ?? []).find((x) => x.id === r.target_id);
      map.set(key, { ...base, label: rv?.text ? rv.text.slice(0, 80) : null, href: `/admin/reviews?q=${r.target_id}`, profileId: rv?.author_profile_id ?? null, profileBlocked: rv?.profiles?.is_blocked ?? false });
    } else if (r.target_type === "message") {
      const m = (messages.data ?? []).find((x) => String(x.id) === r.target_id);
      map.set(key, {
        ...base,
        label: m?.profiles ? `${m.profiles.first_name} ${m.profiles.last_name}`.trim() : null,
        href: null,
        profileId: m?.sender_id ?? null,
        profileBlocked: m?.profiles?.is_blocked ?? false,
        message: m ? { conversation_id: m.conversation_id, body: m.body, type: m.type, created_at: m.created_at } : null,
      });
    } else {
      map.set(key, base);
    }
  }
  return map;
}

/** Shikoyatlar navbati (reports.view) */
export async function listReports(f: ReportFilters): Promise<Paged<ReportRow> & { error: string | null }> {
  const supabase = await createClient();
  const [from, to] = pageRange(f.page);
  const { data, count, error } = await supabase
    .from("reports")
    .select("*, reporter:profiles!reports_reporter_profile_id_fkey(id, first_name, last_name, is_blocked), resolver:profiles!reports_resolved_by_fkey(id, first_name, last_name, is_blocked)", { count: "exact" })
    .eq("status", f.status)
    .order("created_at", { ascending: f.status === "open" || f.status === "in_review" })
    .range(from, to);
  const base = data ?? [];
  const targets = await resolveTargets(base);
  const rows: ReportRow[] = base.map((r) => {
    const { reporter, resolver, ...rest } = r;
    return { ...rest, reporter, resolver, target: targets.get(`${r.target_type}:${r.target_id}`)! };
  });
  return { ...toPaged(rows, count, f.page, PAGE_SIZE), error: error?.message ?? null };
}

export async function reportStatusCounts(): Promise<Record<Enums<"report_status">, number>> {
  const supabase = await createClient();
  const res = await Promise.all(REPORT_STATUSES.map((s) => supabase.from("reports").select("id", { count: "exact", head: true }).eq("status", s)));
  return { open: res[0]?.count ?? 0, in_review: res[1]?.count ?? 0, resolved: res[2]?.count ?? 0, dismissed: res[3]?.count ?? 0 };
}

// =====================================================================
// Sharhlar
// =====================================================================
export const REVIEW_STATUSES = ["pending", "approved", "rejected"] as const;

export interface ReviewFilters {
  status: Enums<"review_status"> | undefined;
  q: string;
  rating: number | undefined;
  page: number;
}

export function parseReviewFilters(sp: SearchParams): ReviewFilters {
  const rating = Number.parseInt(param(sp, "rating"), 10);
  const status = param(sp, "status");
  return {
    status: status === "all" ? undefined : (oneOf(status, REVIEW_STATUSES) ?? "pending"),
    q: param(sp, "q"),
    rating: rating >= 1 && rating <= 5 ? rating : undefined,
    page: parsePage(sp),
  };
}

export type ReviewRow = Tables<"reviews"> & {
  author: Person;
  target: Person;
  moderator: Person;
};

/** Sharhlar (RLS: admin hammasini ko'radi) */
export async function listReviews(f: ReviewFilters): Promise<Paged<ReviewRow> & { error: string | null }> {
  const supabase = await createClient();
  const [from, to] = pageRange(f.page);
  let q = supabase
    .from("reviews")
    .select(
      "*, author:profiles!reviews_author_profile_id_fkey(id, first_name, last_name, is_blocked), target:profiles!reviews_target_profile_id_fkey(id, first_name, last_name, is_blocked), moderator:profiles!reviews_moderated_by_fkey(id, first_name, last_name, is_blocked)",
      { count: "exact" },
    )
    .order("created_at", { ascending: f.status === "pending" })
    .range(from, to);
  if (f.status) q = q.eq("status", f.status);
  if (f.rating) q = q.eq("rating", f.rating);
  if (f.q) {
    if (isUuid(f.q)) q = q.or(`id.eq.${f.q},author_profile_id.eq.${f.q},target_profile_id.eq.${f.q}`);
    else q = q.ilike("text", `%${f.q.replace(/[%_,()\\]/g, " ")}%`);
  }
  const { data, count, error } = await q;
  return { ...toPaged<ReviewRow>(data ?? [], count, f.page, PAGE_SIZE), error: error?.message ?? null };
}

export async function reviewStatusCounts(): Promise<Record<Enums<"review_status">, number>> {
  const supabase = await createClient();
  const res = await Promise.all(REVIEW_STATUSES.map((s) => supabase.from("reviews").select("id", { count: "exact", head: true }).eq("status", s)));
  return { pending: res[0]?.count ?? 0, approved: res[1]?.count ?? 0, rejected: res[2]?.count ?? 0 };
}

// =====================================================================
// Verifikatsiya so'rovlari
// =====================================================================
export interface VerificationFilters {
  tab: "pending" | "history";
  page: number;
}

export function parseVerificationFilters(sp: SearchParams): VerificationFilters {
  return { tab: param(sp, "tab") === "history" ? "history" : "pending", page: parsePage(sp) };
}

export type VerificationRow = Tables<"verification_requests"> & {
  profile: { id: string; first_name: string; last_name: string; avatar_url: string | null; is_blocked: boolean } | null;
  reviewer: Person;
  companies: { id: string; name: string; slug: string; tin: string | null; verification_status: Enums<"verification_status">; logo_url: string | null } | null;
  employer: { employer_type: Enums<"employer_type">; display_name: string | null; verification_status: Enums<"verification_status"> } | null;
};

/** Verifikatsiya so'rovlari (RLS: employers.verify) */
export async function listVerifications(f: VerificationFilters): Promise<Paged<VerificationRow> & { error: string | null; pendingCount: number }> {
  const supabase = await createClient();
  const [from, to] = pageRange(f.page);
  let q = supabase
    .from("verification_requests")
    .select(
      "*, profile:profiles!verification_requests_profile_id_fkey(id, first_name, last_name, avatar_url, is_blocked), reviewer:profiles!verification_requests_reviewed_by_fkey(id, first_name, last_name, is_blocked), companies(id, name, slug, tin, verification_status, logo_url)",
      { count: "exact" },
    )
    .range(from, to);
  q = f.tab === "pending" ? q.eq("status", "pending").order("created_at", { ascending: true }) : q.neq("status", "pending").order("reviewed_at", { ascending: false, nullsFirst: false });
  const [{ data, count, error }, pending] = await Promise.all([q, supabase.from("verification_requests").select("id", { count: "exact", head: true }).eq("status", "pending")]);
  const base = data ?? [];
  const profileIds = [...new Set(base.map((r) => r.profile_id))];
  const employers = profileIds.length ? (await supabase.from("employer_profiles").select("profile_id, employer_type, display_name, verification_status").in("profile_id", profileIds)).data ?? [] : [];
  const rows: VerificationRow[] = base.map((r) => {
    const e = employers.find((x) => x.profile_id === r.profile_id);
    return { ...r, employer: e ? { employer_type: e.employer_type, display_name: e.display_name, verification_status: e.verification_status } : null };
  });
  return { ...toPaged(rows, count, f.page, PAGE_SIZE), error: error?.message ?? null, pendingCount: pending.count ?? 0 };
}
