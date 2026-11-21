/**
 * "E'lonlarim" yorliqlari (ega, 2026-11-21, master prompt: "Faol e'lonlar · Yopilgan e'lonlar · Muddati tugagan e'lonlar").
 * Har bir e'lon aniq bitta yorliqqa tushadi. Tekshiruvda, rad etilgan, to'lov kutayotgan e'lonlar "Faol"da qoladi —
 * ular egasidan harakat kutadi (holat belgisi va tugmalari bilan ko'rinadi).
 */
export type ListingBucket = "active" | "closed" | "expired";
export const LISTING_BUCKETS: ListingBucket[] = ["active", "closed", "expired"];

/** URL dagi ?holat= qiymati ↔ yorliq (o'zbekcha, oddiy) */
const SLUG: Record<ListingBucket, string> = { active: "faol", closed: "yopilgan", expired: "tugagan" };
export const bucketSlug = (b: ListingBucket) => SLUG[b];
export function parseBucket(raw: string | string[] | undefined): ListingBucket {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return (LISTING_BUCKETS.find((b) => SLUG[b] === v) ?? "active");
}

/** Vakansiya: muddati tugagan — expired; to'xtatilgan/yopilgan/yashirilgan — closed; qolgani (faol, tekshiruvda, qoralama, rad) — active */
export function vacancyBucket(status: string): ListingBucket {
  if (status === "expired") return "expired";
  if (status === "paused" || status === "closed" || status === "hidden") return "closed";
  return "active";
}

/**
 * Ish izlovchi e'loni: qidiruvda ko'rinadi yoki egasidan harakat kutadi — active; "ish topdim"/to'xtatdi — closed;
 * ko'rinish muddati o'tgan (yoki to'lov kutayotgan muddat) — expired.
 */
export function workerBucket(w: { status: "listed" | "payment_required" | "stopped"; listedUntil: string | null; moderationState: string }, now = Date.now()): ListingBucket {
  if (w.status === "listed") return "active";
  if (w.status === "payment_required") return "expired";
  if (["moderation_pending", "review", "rejected"].includes(w.moderationState)) return "active";
  if (w.listedUntil && new Date(w.listedUntil).getTime() <= now) return "expired";
  return "closed";
}

/** Usta e'loni: faol yoki tekshiruvda/rad — active; qolgani — closed (ustalar e'lonining muddati yo'q) */
export function masterBucket(status: string): ListingBucket {
  return status === "active" || status === "pending_review" || status === "rejected" ? "active" : "closed";
}
