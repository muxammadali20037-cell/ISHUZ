import type { Enums } from "@/types/database.types";
import type { CandidateSummary, ReviewSummary, StatusTone } from "@/features/applications/types";

export type OfferStatus = Enums<"offer_status">;

/** Javob kutilayotgan takliflar ("Yangi" tab) */
export const PENDING_OFFER_STATUSES = ["sent", "viewed"] as const satisfies readonly OfferStatus[];
/** Javob berilgan / yakunlangan ("Javob berilgan" tab) */
export const ANSWERED_OFFER_STATUSES = ["accepted", "declined", "expired", "withdrawn"] as const satisfies readonly OfferStatus[];

export const OFFER_STATUS_TONE: Record<OfferStatus, StatusTone> = {
  sent: "info",
  viewed: "info",
  accepted: "success",
  declined: "destructive",
  expired: "muted",
  withdrawn: "muted",
};

export function isOfferPending(status: OfferStatus): boolean {
  return (PENDING_OFFER_STATUSES as readonly OfferStatus[]).includes(status);
}

export interface OfferVacancy {
  id: string;
  title: string;
  slug: string;
  status: Enums<"vacancy_status">;
}

export interface OfferCompany {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  verification_status: Enums<"verification_status">;
}

export interface OfferEmployer {
  profile_id: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  display_name: string | null;
}

export interface OfferBase {
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
  /** Vakansiya faol bo'lmasa RLS tufayli null bo'lishi mumkin */
  vacancy: OfferVacancy | null;
  company: OfferCompany | null;
}

/** Ishchi ko'radigan taklif */
export interface ReceivedOffer extends OfferBase {
  employer: OfferEmployer | null;
}

/** Ish beruvchi yuborgan taklif */
export interface SentOffer extends OfferBase {
  candidate: CandidateSummary | null;
}

export interface OfferDetail extends OfferBase {
  employer: OfferEmployer | null;
  candidate: CandidateSummary | null;
  my_review: ReviewSummary | null;
}

/** Taklif muddati o'tgan, lekin hali javob berilmagan (DB cron 'expired' qilguncha) */
export function isOfferExpired(offer: Pick<OfferBase, "status" | "expires_at">, now: Date = new Date()): boolean {
  return isOfferPending(offer.status) && !!offer.expires_at && new Date(offer.expires_at).getTime() < now.getTime();
}

/** Taklif sarlavhasi: custom title yoki vakansiya nomi */
export function offerTitle(offer: Pick<OfferBase, "title" | "vacancy">): string {
  return offer.title?.trim() || offer.vacancy?.title || "";
}

/** Kim yuborgan: kompaniya → employer display_name → ism familiya */
export function offerSenderName(offer: Pick<OfferBase, "company"> & { employer: OfferEmployer | null }): string {
  if (offer.company?.name) return offer.company.name;
  const e = offer.employer;
  if (!e) return "";
  return e.display_name?.trim() || [e.first_name, e.last_name].filter(Boolean).join(" ").trim();
}

export type OffersTab = "new" | "answered";
export function isOffersTab(v: unknown): v is OffersTab {
  return v === "new" || v === "answered";
}
