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
  /** e'londa hech bir raqam ko'rinmaydi (eski e'lon: raqam yozilmagan, hisob raqami yashirin) — egasiga eslatma */
  phoneHidden: boolean;
  /** 0086: shaxsning asosiy e'loni (birinchisi) — tahrirlash /post/worker, qolganlari — /post/worker?listing=<id> */
  primary: boolean;
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
  /** kelgan arizalar (qaytarib olinganlarsiz) va hali ko'rilmaganlari */
  applications: { total: number; fresh: number };
  /** e'londagi raqam yashirilgan (eski "ko'rsatilmasin" tanlovi) — egasiga eslatma */
  phoneHidden: boolean;
}

/** Kabinet: foydalanuvchining o'z e'lonlari (ishchi e'loni + ish e'lonlari) */
/**
 * Bosh sahifadagi "E'lonlarim" qatori uchun son: o'zi haqidagi e'lon (bo'lsa), vakansiyalar va usta e'lonlari — barcha
 * holatlarda (sahifada nima ko'rinsa, shu). Faqat son so'raladi (head). Xatoda — null (son ko'rsatilmaydi).
 */
export async function countMyListings(session: SessionContext): Promise<number | null> {
  const supabase = await createClient();
  const [vac, masters] = await Promise.all([
    supabase.from("vacancies").select("id", { count: "exact", head: true }).eq("owner_profile_id", session.userId),
    supabase.from("master_listings").select("id", { count: "exact", head: true }).eq("owner_profile_id", session.userId),
  ]);
  if (vac.error || masters.error) {
    console.error("[cabinet] listing count", vac.error?.message ?? masters.error?.message);
    return null;
  }
  // 0086: ishchi e'lonlari ham bir nechta bo'lishi mumkin
  const workers = session.workerId
    ? await supabase.from("worker_profiles").select("id", { count: "exact", head: true }).eq("profile_id", session.userId).not("onboarding_completed_at", "is", null)
    : { count: 0, error: null };
  if (workers.error) return null;
  return (workers.count ?? 0) + (vac.count ?? 0) + (masters.count ?? 0);
}

export async function getMyListings(
  session: SessionContext,
  /** vacancies: false — faqat o'zi haqidagi e'lon (ish beruvchi "E'lonlarim"ida vakansiyalar o'z ro'yxatida) */
  opts: { vacancies?: boolean } = {},
): Promise<{ workers: MyWorkerListing[]; vacancies: MyVacancy[]; paid: boolean; workerPaid: boolean }> {
  const supabase = await createClient();
  const withVacancies = opts.vacancies !== false;
  const [workerRes, vacRes, paidRes, statesRes, workerPaidRes] = await Promise.all([
    // 0086 (ega, 2026-11-20: "10 ta, 100 ta e'lon joylasin"): barcha o'z ishchi e'lonlari — asosiysi birinchi
    session.workerId
      ? supabase
          .from("worker_profiles")
          .select("id, is_primary, headline, profession_node_id, district_id, is_public, status, listed_until, regions!worker_profiles_region_id_fkey(slug, name_uz, name_ru, name_en, name_oz), districts!worker_profiles_district_id_fkey(name_uz, name_ru, name_oz)")
          .eq("profile_id", session.userId)
          .not("onboarding_completed_at", "is", null)
          .order("is_primary", { ascending: false })
          .order("created_at", { ascending: true })
          .limit(100)
      : Promise.resolve({ data: [], error: null }),
    withVacancies
      ? supabase
          .from("vacancies")
          .select("id, slug, title, status, expires_at, profession_node_id, district_id, is_remote, regions!vacancies_region_id_fkey(slug, name_uz, name_ru, name_en, name_oz)")
          .eq("owner_profile_id", session.userId)
          .order("created_at", { ascending: false })
          .limit(30)
      : Promise.resolve({ data: [], error: null }),
    supabase.rpc("listings_paid"),
    supabase.rpc("my_listing_states"),
    // 0094: ishchi e'loni alohida (sukut — bepul); migratsiya hali yo'q bo'lsa — avvalgidek listings_paid
    supabase.rpc("worker_listings_paid"),
  ]);
  const states = new Map((statesRes.data ?? []).map((r) => [`${r.entity}:${r.id}`, toListingStateInfo(r.info)]));
  // arizalar soni — ish beruvchining asosiy keyingi amali (RLS: faqat o'z vakansiyalarining arizalari)
  const vacancyIds = (vacRes.data ?? []).map((v) => v.id);
  const workerIds = (workerRes.data ?? []).map((w) => w.id);
  // Ega (2026-11-20): "telefon nomerlar 100% ko'rinsin" — raqami ko'rinmaydigan eski e'lonlar egasiga eslatiladi
  // (yangi e'londa raqam majburiy va doim ko'rinadi). RLS: faqat o'z e'lonlarining raqam qatorlari.
  const [appsRes, contactsRes, listingPhoneRes, ownContactRes] = await Promise.all([
    vacancyIds.length
      ? supabase.from("applications").select("vacancy_id, status").in("vacancy_id", vacancyIds).neq("status", "withdrawn")
      : Promise.resolve({ data: [], error: null }),
    vacancyIds.length ? supabase.from("vacancy_contacts").select("vacancy_id, phone, show_phone").in("vacancy_id", vacancyIds) : Promise.resolve({ data: [], error: null }),
    workerIds.length ? supabase.from("worker_listing_phones").select("worker_id").in("worker_id", workerIds) : Promise.resolve({ data: [], error: null }),
    workerIds.length ? supabase.from("profile_contacts").select("phone, phone_visibility").eq("profile_id", session.userId).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ]);
  const hiddenVacancyPhones = new Set((contactsRes.data ?? []).filter((c) => !c.show_phone || !c.phone).map((c) => c.vacancy_id));
  if (appsRes.error) console.error("[cabinet] applications", appsRes.error.message);
  const apps = new Map<string, { total: number; fresh: number }>();
  for (const a of appsRes.data ?? []) {
    const c = apps.get(a.vacancy_id) ?? { total: 0, fresh: 0 };
    c.total += 1;
    if (a.status === "sent") c.fresh += 1;
    apps.set(a.vacancy_id, c);
  }
  if (workerRes.error) console.error("[cabinet] worker", workerRes.error.message);
  if (vacRes.error) console.error("[cabinet] vacancies", vacRes.error.message);
  const paid = paidRes.data !== false;
  const workerPaid = workerPaidRes.error ? paid : workerPaidRes.data === true;
  const withPhone = new Set((listingPhoneRes.data ?? []).map((r) => r.worker_id));
  const accountPhonePublic = !!(ownContactRes.data?.phone && ownContactRes.data.phone_visibility === "everyone");
  const workers: MyWorkerListing[] = (workerRes.data ?? []).map((w) => {
    const listed = w.is_public && w.status !== "not_looking" && (!workerPaid || (!!w.listed_until && new Date(w.listed_until) > new Date()));
    const region = w.regions as MyWorkerListing["regionName"] & { slug: string } | null;
    return {
      id: w.id,
      headline: w.headline,
      professionNodeId: w.profession_node_id,
      regionSlug: region?.slug ?? null,
      regionName: region,
      districtId: w.district_id,
      districtName: w.districts as MyWorkerListing["districtName"],
      status: listed ? "listed" : w.status === "not_looking" ? "stopped" : workerPaid ? "payment_required" : "stopped",
      listedUntil: w.listed_until,
      moderation: states.get(`worker:${w.id}`) ?? toListingStateInfo({ state: listed ? "listed" : "saved" }),
      // so'rov xatosida eslatma ko'rsatilmaydi (yolg'on ogohlantirish bo'lmasin)
      phoneHidden: !listingPhoneRes.error && !ownContactRes.error && !withPhone.has(w.id) && !accountPhonePublic,
      primary: w.is_primary,
    };
  });
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
      applications: apps.get(v.id) ?? { total: 0, fresh: 0 },
      phoneHidden: hiddenVacancyPhones.has(v.id),
    };
  });
  return { workers, vacancies, paid, workerPaid };
}
