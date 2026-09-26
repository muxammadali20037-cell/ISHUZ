import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Enums } from "@/types/database.types";
import type { CandidateSummary, ReviewSummary } from "@/features/applications/types";
import type { OfferBase, OfferDetail, OfferEmployer, OfferStatus, ReceivedOffer, SentOffer } from "./types";

const OFFER_FIELDS =
  "id, status, title, message, salary_from, salary_to, expires_at, viewed_at, responded_at, hired_at, created_at, updated_at, vacancy_id, employer_profile_id, company_id, worker_id";
const VACANCY_SELECT = "vacancy:vacancies(id, title, slug, status)";
const COMPANY_SELECT = "company:companies(id, name, slug, logo_url, verification_status)";
const EMPLOYER_SELECT = "employer:profiles!job_offers_employer_profile_id_fkey(id, first_name, last_name, avatar_url)";
const CANDIDATE_SELECT = "worker:worker_profiles(id, profile_id, headline, experience_level, profile:profiles(first_name, last_name, avatar_url))";

type OfferRow = {
  id: string;
  status: OfferStatus;
  title: string | null;
  message: string | null;
  salary_from: number | null;
  salary_to: number | null;
  expires_at: string | null;
  viewed_at: string | null;
  responded_at: string | null;
  hired_at: string | null;
  created_at: string;
  updated_at: string;
  vacancy_id: string | null;
  employer_profile_id: string;
  company_id: string | null;
  worker_id: string;
  vacancy: { id: string; title: string; slug: string; status: Enums<"vacancy_status"> } | null;
  company: { id: string; name: string; slug: string; logo_url: string | null; verification_status: Enums<"verification_status"> } | null;
};

type EmployerRow = { id: string; first_name: string; last_name: string; avatar_url: string | null } | null;

type CandidateRow = {
  id: string;
  profile_id: string;
  headline: string | null;
  experience_level: Enums<"experience_level">;
  profile: { first_name: string; last_name: string; avatar_url: string | null } | null;
} | null;

function mapBase(row: OfferRow): OfferBase {
  return {
    id: row.id,
    status: row.status,
    title: row.title,
    message: row.message,
    salary_from: row.salary_from,
    salary_to: row.salary_to,
    expires_at: row.expires_at,
    viewed_at: row.viewed_at,
    responded_at: row.responded_at,
    hired_at: row.hired_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    vacancy_id: row.vacancy_id,
    employer_profile_id: row.employer_profile_id,
    company_id: row.company_id,
    worker_id: row.worker_id,
    vacancy: row.vacancy ? { ...row.vacancy } : null,
    company: row.company ? { ...row.company } : null,
  };
}

function mapEmployer(p: EmployerRow, displayName: string | null): OfferEmployer | null {
  if (!p) return null;
  return { profile_id: p.id, first_name: p.first_name, last_name: p.last_name, avatar_url: p.avatar_url, display_name: displayName };
}

function mapCandidate(w: CandidateRow): CandidateSummary | null {
  if (!w) return null;
  return {
    worker_id: w.id,
    profile_id: w.profile_id,
    first_name: w.profile?.first_name ?? "",
    last_initial: w.profile?.last_name ? w.profile.last_name.trim().charAt(0).toUpperCase() : null,
    avatar_url: w.profile?.avatar_url ?? null,
    headline: w.headline,
    experience_level: w.experience_level,
  };
}

/** employer_profiles.display_name (YaTT / oddiy shaxs uchun) — profil id bo'yicha */
async function getDisplayNames(profileIds: string[]): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>();
  const ids = [...new Set(profileIds)];
  if (!ids.length) return map;
  const supabase = await createClient();
  const { data } = await supabase.from("employer_profiles").select("profile_id, display_name").in("profile_id", ids);
  for (const row of data ?? []) map.set(row.profile_id, row.display_name);
  return map;
}

async function getMyOfferReview(offerId: string, userId: string): Promise<ReviewSummary | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("reviews").select("id, rating, text, status, created_at").eq("job_offer_id", offerId).eq("author_profile_id", userId).maybeSingle();
  if (error) throw new Error(`reviews: ${error.message}`);
  return data ?? null;
}

/** Ishchiga kelgan takliflar (created_at desc) */
export async function getReceivedOffers(workerId: string): Promise<ReceivedOffer[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("job_offers")
    .select(`${OFFER_FIELDS}, ${VACANCY_SELECT}, ${COMPANY_SELECT}, ${EMPLOYER_SELECT}`)
    .eq("worker_id", workerId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(`offers: ${error.message}`);
  const rows = data ?? [];
  const names = await getDisplayNames(rows.map((r) => r.employer_profile_id));
  return rows.map((row) => ({ ...mapBase(row), employer: mapEmployer(row.employer, names.get(row.employer_profile_id) ?? null) }));
}

/** Ish beruvchi yuborgan takliflar (created_at desc) */
export async function getSentOffers(userId: string): Promise<SentOffer[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("job_offers")
    .select(`${OFFER_FIELDS}, ${VACANCY_SELECT}, ${COMPANY_SELECT}, ${CANDIDATE_SELECT}`)
    .eq("employer_profile_id", userId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(`offers: ${error.message}`);
  return (data ?? []).map((row) => ({ ...mapBase(row), candidate: mapCandidate(row.worker) }));
}

/** Bitta taklif (RLS: faqat tomonlar ko'radi); topilmasa null */
export async function getOffer(offerId: string, userId: string): Promise<OfferDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("job_offers")
    .select(`${OFFER_FIELDS}, ${VACANCY_SELECT}, ${COMPANY_SELECT}, ${EMPLOYER_SELECT}, ${CANDIDATE_SELECT}`)
    .eq("id", offerId)
    .maybeSingle();
  if (error) throw new Error(`offer: ${error.message}`);
  if (!data) return null;
  const [names, my_review] = await Promise.all([getDisplayNames([data.employer_profile_id]), getMyOfferReview(offerId, userId)]);
  return {
    ...mapBase(data),
    employer: mapEmployer(data.employer, names.get(data.employer_profile_id) ?? null),
    candidate: mapCandidate(data.worker),
    my_review,
  };
}

/**
 * Ishchi taklifni ochganda: sent → viewed (RPC faqat o'z taklifi va status = sent bo'lsa o'zgartiradi).
 * Sahifa render'ida chaqiriladi — revalidatePath yo'q. Muvaffaqiyat bo'lsa true.
 */
export async function markOfferViewedOnOpen(offerId: string, currentStatus: OfferStatus): Promise<boolean> {
  if (currentStatus !== "sent") return false;
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_offer_viewed", { p_offer_id: offerId });
  if (error) {
    console.error("[offers] mark viewed", error.message);
    return false;
  }
  return true;
}
