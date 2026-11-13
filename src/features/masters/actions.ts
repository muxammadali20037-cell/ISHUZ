"use server";

import { headers } from "next/headers";
import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/features/auth/session";
import type { ActionResult } from "@/features/auth/actions";
import { allowRate } from "@/lib/rate-limit";
import {
  clientIp as requestIp,
  ipBucket,
  subjectHash,
} from "@/lib/security/request";
import { errorCode } from "@/lib/utils";
import {
  finalizeVacancyPhoto,
  isVerifiedPhotoPath,
} from "@/features/post/photo-finalize";
import { getAdminActor } from "@/features/admin/context";
import { MASTERS_TAG } from "./queries";
import { checkMasterText } from "./content-check";
import { banIfRuleBlock } from "@/features/moderation/enforce";
import {
  masterListingSchema,
  masterRequestSchema,
  masterReviewSchema,
  type MasterListingInput,
} from "./schema";
import type { MasterListingStatus, MasterRequestStatus } from "./types";

/**
 * "Universal ustalar" — server amallari. Yozish faqat egasi nomidan (RLS + triggerlar), holat o'tishlari bazada tekshiriladi;
 * mijoz so'rovi va sharh — bazadagi funksiyalar orqali (spam uchun IP/foydalanuvchi limiti shu yerda).
 */

async function ipKey(): Promise<string> {
  return subjectHash("ip", ipBucket(requestIp(await headers())));
}

function slugFor(title: string, id: string): string {
  const base = title
    .toLowerCase()
    .replace(/[ʻʼ'’`]/g, "")
    .replace(/[^a-z0-9а-яёўқғҳ]+/giu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${base || "usta"}-${id.slice(0, 8)}`;
}

function revalidateMasters() {
  updateTag(MASTERS_TAG);
  revalidatePath("/ustalar", "layout");
}

/** Rasm: karantin yo'lini tekshirib qayta kodlash (vakansiya rasmlari bilan bir xil quvur) */
/** checkMasterText natijasidan jazo uchun "block" topilmasi */
const verdictBlock = (v: { category: string | null; rule: string | null }) => (v.category && v.rule ? { category: v.category, rule: v.rule } : null);

export async function verifyMasterPhoto(
  input: unknown,
): Promise<ActionResult<{ path: string }>> {
  const parsed = z.object({ path: z.string().max(200) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "photo_invalid" };
  const session = await getSession();
  if (!session) return { ok: false, error: "not_authenticated" };
  if (session.profile.is_blocked) return { ok: false, error: "blocked" };
  if (!(await allowRate(`photo:${session.userId}`, 30, 3600)))
    return { ok: false, error: "rate_limited" };
  const res = await finalizeVacancyPhoto(session.userId, parsed.data.path);
  return res.ok
    ? { ok: true, data: { path: res.path } }
    : { ok: false, error: res.error };
}

/** E'lonni saqlash (yangi yoki tahrirlash); submit — moderatsiyaga yuborish. Natija: id va holat. */
export async function saveMasterListing(
  input: unknown,
): Promise<ActionResult<{ id: string; status: MasterListingStatus }>> {
  const parsed = masterListingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const session = await getSession();
  if (!session) return { ok: false, error: "not_authenticated" };
  if (session.profile.is_blocked) return { ok: false, error: "blocked" };
  if (!(await allowRate(`masters_save:${session.userId}`, 60, 3600)))
    return { ok: false, error: "rate_limited" };
  const v: MasterListingInput = parsed.data;
  // aniq taqiqlangan mazmun (intim xizmat, giyohvand moddalar, karta sotib olish, soxta hujjat …) — saqlanmaydi.
  // Shubhali belgilar saqlanadi, admin navbatida ogohlantirish bo'lib chiqadi (e'lon baribir tasdiqsiz chiqmaydi)
  // og'ir qoidabuzarlikda (erotika, massaj/spa, ekstremizm, noqonuniy) — muallif darhol bloklanadi (ega, 2026-11-13)
  const verdict = checkMasterText({ displayName: v.displayName, title: v.title, description: v.description, services: v.services, serviceArea: v.serviceArea });
  if (verdict.blocked) {
    if (await banIfRuleBlock(session.userId, verdictBlock(verdict), "master_listing")) return { ok: false, error: "blocked" };
    return { ok: false, error: "prohibited" };
  }
  // faqat tekshirilgan (v-…webp) rasm yo'llari, faqat o'z papkasidan
  if (v.photos.some((p) => !isVerifiedPhotoPath(session.userId, p)))
    return { ok: false, error: "photo_invalid" };
  const supabase = await createClient();
  const row = {
    category_id: v.categoryId,
    display_name: v.displayName,
    title: v.title,
    description: v.description,
    experience_years: v.experienceYears,
    services: v.services,
    region_id: v.regionId,
    district_id: v.districtId,
    service_area: v.serviceArea,
    phone: v.phone,
    phone_public: v.phonePublic,
    price_negotiable: v.priceNegotiable,
    price_from: v.priceNegotiable ? null : v.priceFrom,
    price_to: v.priceNegotiable ? null : v.priceTo,
    work_from: v.workFrom,
    work_to: v.workTo,
    photos: v.photos,
  };
  if (v.id) {
    const { data: cur, error: curErr } = await supabase
      .from("master_listings")
      .select("id, status, slug")
      .eq("id", v.id)
      .maybeSingle();
    if (curErr) return { ok: false, error: errorCode(curErr) };
    if (!cur) return { ok: false, error: "not_found" };
    // qoralama/rad etilgan → yuborilsa pending_review; faol/yashirin mazmuni o'zgarsa trigger o'zi pending_review qiladi
    const status: MasterListingStatus | undefined =
      v.submit && (cur.status === "draft" || cur.status === "rejected")
        ? "pending_review"
        : undefined;
    const { data, error } = await supabase
      .from("master_listings")
      .update({ ...row, ...(status ? { status } : {}) })
      .eq("id", v.id)
      .select("id, status")
      .single();
    if (error) return { ok: false, error: errorCode(error) };
    revalidateMasters();
    return { ok: true, data: { id: data.id, status: data.status } };
  }
  const id = crypto.randomUUID();
  const { data, error } = await supabase
    .from("master_listings")
    .insert({
      ...row,
      id,
      owner_profile_id: session.userId,
      slug: slugFor(v.title, id),
      status: v.submit ? "pending_review" : "draft",
    })
    .select("id, status")
    .single();
  if (error) return { ok: false, error: errorCode(error) };
  revalidateMasters();
  return { ok: true, data: { id: data.id, status: data.status } };
}

/** Egasi: yashirish / qaytarish / qoralamadan yuborish — holat o'tishlari bazadagi trigger bilan tekshiriladi */
export async function setMasterListingStatus(
  input: unknown,
): Promise<ActionResult<{ status: MasterListingStatus }>> {
  const parsed = z
    .object({
      id: z.uuid(),
      status: z.enum(["pending_review", "active", "hidden", "draft"]),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const session = await getSession();
  if (!session) return { ok: false, error: "not_authenticated" };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("master_listings")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.id)
    .select("status")
    .single();
  if (error) return { ok: false, error: errorCode(error) };
  revalidateMasters();
  return { ok: true, data: { status: data.status } };
}

export async function deleteMasterListing(
  input: unknown,
): Promise<ActionResult> {
  const parsed = z.object({ id: z.uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const session = await getSession();
  if (!session) return { ok: false, error: "not_authenticated" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("master_listings")
    .delete()
    .eq("id", parsed.data.id);
  if (error) return { ok: false, error: errorCode(error) };
  revalidateMasters();
  return { ok: true };
}

/**
 * Mijoz so'rovi (mehmon ham): IP bo'yicha soatiga 10 ta; kirgan — 20 ta. Bazadagi funksiya faqat server kaliti bilan
 * chaqiriladi (brauzerdan to'g'ridan-to'g'ri chaqirib ustani so'rovlar bilan to'ldirib bo'lmaydi) — limit shu yerda.
 */
export async function createMasterRequest(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = masterRequestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const session = await getSession();
  if (session?.profile.is_blocked) return { ok: false, error: "blocked" };
  const verdict = checkMasterText({ name: parsed.data.name, message: parsed.data.message });
  if (verdict.blocked) {
    if (await banIfRuleBlock(session?.userId, verdictBlock(verdict), "master_request")) return { ok: false, error: "blocked" };
    return { ok: false, error: "prohibited" };
  }
  const key = session ? `masters_req:${session.userId}` : `masters_req_ip:${await ipKey()}`;
  if (!(await allowRate(key, session ? 20 : 10, 3600))) return { ok: false, error: "rate_limited" };
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return { ok: false, error: "unavailable" };
  const { data, error } = await createAdminClient().rpc("master_request_create", {
    p_listing: parsed.data.listingId,
    p_name: parsed.data.name,
    p_phone: parsed.data.phone,
    p_message: parsed.data.message || undefined,
    p_client: session?.userId,
  });
  if (error) return { ok: false, error: error.message.includes("master_request_own") ? "own" : error.message.includes("not_found") ? "not_found" : errorCode(error) };
  return { ok: true, data: { id: data } };
}

export async function setMasterRequestStatus(
  input: unknown,
): Promise<ActionResult> {
  const parsed = z
    .object({ id: z.uuid(), status: z.enum(["new", "seen", "done"]) })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const session = await getSession();
  if (!session) return { ok: false, error: "not_authenticated" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("master_requests")
    .update({ status: parsed.data.status as MasterRequestStatus })
    .eq("id", parsed.data.id);
  if (error) return { ok: false, error: errorCode(error) };
  return { ok: true };
}

/** Sharh: faqat kirgan, egasi emas, bitta (yangilanadi) — bazadagi funksiya tekshiradi */
export async function addMasterReview(input: unknown): Promise<ActionResult> {
  const parsed = masterReviewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const session = await getSession();
  if (!session) return { ok: false, error: "not_authenticated" };
  const verdict = checkMasterText({ text: parsed.data.text });
  if (verdict.blocked) {
    if (await banIfRuleBlock(session.userId, verdictBlock(verdict), "master_review")) return { ok: false, error: "blocked" };
    return { ok: false, error: "prohibited" };
  }
  if (!(await allowRate(`masters_review:${session.userId}`, 20, 3600)))
    return { ok: false, error: "rate_limited" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("master_review_add", {
    p_listing: parsed.data.listingId,
    p_rating: parsed.data.rating,
    p_text: parsed.data.text || undefined,
  });
  if (error)
    return {
      ok: false,
      error: error.message.includes("master_review_own")
        ? "own"
        : errorCode(error),
    };
  revalidateMasters();
  return { ok: true };
}

/**
 * Ko'rish / telefon bosish hisoblagichi — IP + e'lon bo'yicha soatiga bir marta (takror hisoblanmaydi). Bazadagi funksiya faqat
 * server kaliti bilan chaqiriladi — brauzerdan to'g'ridan-to'g'ri chaqirib sonni sun'iy oshirib bo'lmaydi.
 */
export async function hitMasterListing(input: unknown): Promise<ActionResult> {
  const parsed = z.object({ id: z.uuid(), kind: z.enum(["view", "phone"]) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return { ok: true };
  const key = `masters_hit:${parsed.data.kind}:${parsed.data.id}:${await ipKey()}`;
  if (!(await allowRate(key, 1, 3600))) return { ok: true };
  const { error } = await createAdminClient().rpc("master_listing_hit", { p_id: parsed.data.id, p_kind: parsed.data.kind });
  if (error) return { ok: false, error: errorCode(error) };
  return { ok: true };
}

// ---------------------------------------------------------------------------------------------- admin

export async function moderateMasterListing(
  input: unknown,
): Promise<ActionResult<{ status: MasterListingStatus }>> {
  const parsed = z
    .object({
      id: z.uuid(),
      action: z.enum(["approve", "reject"]),
      reason: z.string().trim().max(500).optional(),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const ctx = await getAdminActor();
  if (!ctx?.can("vacancies.moderate")) return { ok: false, error: "forbidden" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("master_moderate", {
    p_id: parsed.data.id,
    p_action: parsed.data.action,
    p_reason: parsed.data.reason || undefined,
  });
  if (error) return { ok: false, error: errorCode(error) };
  revalidateMasters();
  revalidatePath("/admin/ustalar");
  return { ok: true, data: { status: data } };
}

/** Demo e'lonlar: olib tashlash yoki qaytarish (egasi talabi: "olib tashla desam — olib tashlaysan") */
export async function masterDemo(
  input: unknown,
): Promise<ActionResult<{ count: number }>> {
  const parsed = z
    .object({ action: z.enum(["remove", "seed"]) })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const ctx = await getAdminActor();
  if (!ctx?.can("vacancies.moderate")) return { ok: false, error: "forbidden" };
  const supabase = await createClient();
  const { data, error } =
    parsed.data.action === "remove"
      ? await supabase.rpc("master_demo_remove")
      : await supabase.rpc("master_demo_seed");
  if (error) return { ok: false, error: errorCode(error) };
  revalidateMasters();
  revalidatePath("/admin/ustalar");
  return { ok: true, data: { count: Number(data ?? 0) } };
}
