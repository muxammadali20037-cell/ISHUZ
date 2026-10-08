import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { SessionContext } from "@/features/auth/session";
import type { Enums } from "@/types/database.types";
import { toListingStateInfo, type ListingStateInfo } from "@/features/post/types";

export type WorkerListingStatus = "listed" | "payment_required" | "stopped";

export interface MyWorkerListing {
  id: string;
  headline: string | null;
  professionNodeId: string | null;
  regionSlug: string | null;
  regionName: { name_uz: string; name_ru: string; name_en: string | null; name_oz: string | null } | null;
  districtId: string | null;
  districtName: { name_uz: string; name_ru: string; name_oz: string | null } | null;
  status: WorkerListingStatus;
  listedUntil: string | null;
  /** haqiqiy holat (moderatsiya, to'lov) — my_listing_state */
  moderation: ListingStateInfo;
}

export interface MyVacancy {
  id: string;
  slug: string;
  title: string;
  status: Enums<"vacancy_status">;
  expiresAt: string | null;
  professionNodeId: string | null;
  regionSlug: string | null;
  regionName: { name_uz: string; name_ru: string; name_en: string | null; name_oz: string | null } | null;
  districtId: string | null;
  isRemote: boolean;
  moderation: ListingStateInfo;
}

/** Kabinet: foydalanuvchining o'z e'lonlari (ishchi e'loni + ish e'lonlari) */
export async function getMyListings(session: SessionContext): Promise<{ worker: MyWorkerListing | null; vacancies: MyVacancy[]; paid: boolean }> {
  const supabase = await createClient();
  const [workerRes, vacRes, paidRes, statesRes] = await Promise.all([
    session.workerId && session.workerOnboarded
      ? supabase
          .from("worker_profiles")
          .select("id, headline, profession_node_id, district_id, is_public, status, listed_until, regions!worker_profiles_region_id_fkey(slug, name_uz, name_ru, name_en, name_oz), districts!worker_profiles_district_id_fkey(name_uz, name_ru, name_oz)")
          .eq("id", session.workerId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("vacancies")
      .select("id, slug, title, status, expires_at, profession_node_id, district_id, is_remote, regions!vacancies_region_id_fkey(slug, name_uz, name_ru, name_en, name_oz)")
      .eq("owner_profile_id", session.userId)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase.rpc("listings_paid"),
    supabase.rpc("my_listing_states"),
  ]);
  const states = new Map((statesRes.data ?? []).map((r) => [`${r.entity}:${r.id}`, toListingStateInfo(r.info)]));
  if ("error" in workerRes && workerRes.error) console.error("[cabinet] worker", workerRes.error.message);
  if (vacRes.error) console.error("[cabinet] vacancies", vacRes.error.message);
  const w = workerRes.data;
  const paid = paidRes.data !== false;
  let worker: MyWorkerListing | null = null;
  if (w) {
    const listed = w.is_public && w.status !== "not_looking" && (!paid || (!!w.listed_until && new Date(w.listed_until) > new Date()));
    const region = w.regions as MyWorkerListing["regionName"] & { slug: string } | null;
    worker = {
      id: w.id,
      headline: w.headline,
      professionNodeId: w.profession_node_id,
      regionSlug: region?.slug ?? null,
      regionName: region,
      districtId: w.district_id,
      districtName: w.districts as MyWorkerListing["districtName"],
      status: listed ? "listed" : w.status === "not_looking" ? "stopped" : paid ? "payment_required" : "stopped",
      listedUntil: w.listed_until,
      moderation: states.get(`worker:${w.id}`) ?? toListingStateInfo({ state: listed ? "listed" : "saved" }),
    };
  }
  const vacancies: MyVacancy[] = (vacRes.data ?? []).map((v) => {
    const region = v.regions as MyVacancy["regionName"] & { slug: string } | null;
    return {
      id: v.id,
      slug: v.slug,
      title: v.title,
      status: v.status,
      expiresAt: v.expires_at,
      professionNodeId: v.profession_node_id,
      regionSlug: region?.slug ?? null,
      regionName: region,
      districtId: v.district_id,
      isRemote: v.is_remote,
      moderation: states.get(`vacancy:${v.id}`) ?? toListingStateInfo({ state: v.status === "active" ? "active" : "saved" }),
    };
  });
  return { worker, vacancies, paid };
}

/** Bosh sahifadagi ixcham "Kabinetim" uchun: faol/kutilayotgan e'lonlar soni */
export async function countMyListings(session: SessionContext): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("vacancies")
    .select("id", { count: "exact", head: true })
    .eq("owner_profile_id", session.userId)
    .in("status", ["active", "pending_review", "draft", "paused"]);
  return (count ?? 0) + (session.workerOnboarded ? 1 : 0);
}
