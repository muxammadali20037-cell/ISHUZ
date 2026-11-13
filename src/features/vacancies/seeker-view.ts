import "server-only";

import { createClient } from "@/lib/supabase/server";
import { EMPTY_FIND } from "@/features/find/params";
import { findJobs } from "@/features/find/queries";
import type { JobCardData } from "@/features/find/components/result-cards";
import type { VacancyDetail } from "@/features/jobs/types";
import { seekerPreviewHref } from "./preview-href";

/**
 * "Ish izlovchilar qanday ko'radi" (ega, 2026-11-13: "ish beruvchi e'lon joylagandan keyin o'z e'lonini ish izlovchilar
 * kabinetda qanday ko'rishini bilmoqchi"). Hammasi haqiqiy ma'lumotdan:
 * - karta — ish izlovchi ro'yxatda ko'radigan kartaning o'zi (o'sha qidiruv funksiyasi qaytargan qator; e'lon hali ko'rinmasa —
 *   e'londagi ma'lumotdan yig'ilgan xuddi shu shakl);
 * - o'rin — ish izlovchi shu kasbni shu hududda (barcha tumanlar) qidirganda — o'sha funksiya, o'sha tartib — e'lon nechanchi
 *   bo'lib chiqadi. Birinchi RANK_LIMIT ta ichida bo'lmasa — o'rin aytilmaydi (taxmin qilinmaydi). Qidiruv sahifasining o'ziga
 *   havola yo'q: ish beruvchi rejimida u "bu bo'lim ish izlovchilar uchun" oynasini ko'rsatadi (rejim o'z-o'zidan almashmaydi).
 */
export const RANK_LIMIT = 50;

export type SeekerVisibility = "visible" | "pending_review" | "draft" | "paused" | "ended" | "hidden";

export interface SeekerViewData {
  visibility: SeekerVisibility;
  card: JobCardData;
  /** /jobs/[slug]?korinish=izlovchi — to'liq sahifa ish izlovchi ko'zi bilan */
  previewHref: string;
  /** faqat ko'rinayotgan e'lon uchun; position — 1 dan, birinchi `limit` ta ichida topilmasa null */
  rank: { position: number | null; total: number; limit: number } | null;
  profession: { name_uz: string; name_ru: string; name_en: string | null } | null;
  /** qidiruvdagi joy: viloyat nomi, masofaviy yoki butun O'zbekiston */
  place: { kind: "region"; name_uz: string; name_ru: string } | { kind: "remote" } | { kind: "all" };
}

export function seekerVisibility(v: Pick<VacancyDetail, "status" | "is_expired">): SeekerVisibility {
  if (v.status === "active") return v.is_expired ? "ended" : "visible";
  if (v.status === "pending_review") return "pending_review";
  if (v.status === "draft") return "draft";
  if (v.status === "paused") return "paused";
  if (v.status === "hidden" || v.status === "rejected") return "hidden";
  return "ended";
}

/** E'londagi ma'lumotdan ro'yxat kartasi (qidiruvdagi qator bilan bir xil maydonlar; ish beruvchi nomi — qidiruvdagi tartibda) */
function cardFromDetail(v: VacancyDetail, employerName: string | null): JobCardData {
  const featuredNow = v.is_featured && (!v.featured_until || new Date(v.featured_until).getTime() > Date.now());
  return {
    id: v.id,
    slug: v.slug,
    title: v.title,
    employer_name: v.company?.name ?? employerName ?? (v.owner?.first_name?.trim() || null),
    employer_verified: v.company?.verification_status === "verified",
    profession_node_id: v.profession_node_id,
    profession_name_uz: v.profession?.name_uz ?? null,
    profession_name_ru: v.profession?.name_ru ?? null,
    profession_name_en: v.profession?.name_en ?? null,
    category_slug: v.category?.slug ?? null,
    category_icon: null,
    region_name_uz: v.region?.name_uz ?? null,
    region_name_ru: v.region?.name_ru ?? null,
    region_name_en: null,
    region_name_oz: null,
    district_name_uz: v.district?.name_uz ?? null,
    district_name_ru: v.district?.name_ru ?? null,
    district_name_en: null,
    district_name_oz: null,
    region_wide: false,
    is_remote: v.is_remote,
    salary_from: v.salary_from,
    salary_to: v.salary_to,
    salary_type: v.salary_type,
    salary_negotiable: v.salary_negotiable,
    schedule: v.schedule,
    experience_min_months: v.experience_min_months,
    summary: v.description ? v.description.replace(/\s+/g, " ").slice(0, 220) : null,
    phone: null,
    is_featured: featuredNow,
    published_at: v.published_at,
  };
}

export async function getSeekerView(v: VacancyDetail): Promise<SeekerViewData> {
  const visibility = seekerVisibility(v);
  const place: SeekerViewData["place"] = v.is_remote ? { kind: "remote" } : v.region ? { kind: "region", name_uz: v.region.name_uz, name_ru: v.region.name_ru } : { kind: "all" };
  const nodeId = v.profession_node_id;

  let rank: SeekerViewData["rank"] = null;
  let card: JobCardData | null = null;
  if (visibility === "visible" && nodeId) {
    const res = await findJobs({ ...EMPTY_FIND, mode: "jobs", p: nodeId }, { regionId: v.is_remote ? null : (v.region?.id ?? null), districtId: null, remote: v.is_remote }, RANK_LIMIT);
    if (res.ok) {
      const idx = res.items.findIndex((r) => r.id === v.id);
      rank = { position: idx >= 0 ? idx + 1 : null, total: res.total, limit: RANK_LIMIT };
      if (idx >= 0) card = res.items[idx] ?? null;
    }
  }
  if (!card) {
    let employerName: string | null = null;
    if (!v.company && v.owner_profile_id) {
      const supabase = await createClient();
      const { data } = await supabase.rpc("employer_public_names", { p_profile_ids: [v.owner_profile_id] });
      employerName = data?.[0]?.display_name?.trim() || null;
    }
    card = cardFromDetail(v, employerName);
  }
  return {
    visibility,
    card,
    previewHref: seekerPreviewHref(v.slug),
    rank,
    profession: v.profession ? { name_uz: v.profession.name_uz, name_ru: v.profession.name_ru, name_en: v.profession.name_en } : null,
    place,
  };
}
