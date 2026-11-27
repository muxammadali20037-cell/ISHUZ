import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { publicEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAiUsage } from "@/lib/ai/usage";
import { checkGeneratedImage } from "@/features/moderation/service";
import { buildListingImagePrompt } from "./prompt";
import { isProviderOutage, openAiImage, openAiImageConfig } from "@/lib/ai/openai-image";

export { isProviderOutage };

export type ListingEntity = "vacancy" | "worker" | "master";
const BUCKET = "listing-images";
const one = <T,>(x: T | T[] | null | undefined): T | null => (Array.isArray(x) ? (x[0] ?? null) : (x ?? null));

/** OpenAI rasm modeli sozlanganmi (kalit + service role). Sozlanmagan bo'lsa — "Rasm yaratilsinmi?" savoli chiqmaydi */
export const listingImageConfig = openAiImageConfig;

export function listingImageEnabled(): boolean {
  return listingImageConfig() !== null;
}

function anon() {
  return createSupabaseClient<Database>(publicEnv.NEXT_PUBLIC_SUPABASE_URL, publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
}

/**
 * Tayyor rasm manzili (RLS: faqat status = ready). Xususiyat yoqilmagan (kalit yo'q) — bazaga so'rov ham yo'q (e'lon sahifasi
 * sekinlashmasin; 0087 hali qo'llanmagan prod'da ham xavfsiz). Jadval yo'q yoki xato — null.
 */
export async function getListingImageUrl(entity: ListingEntity, id: string): Promise<string | null> {
  if (!listingImageEnabled()) return null;
  try {
    const { data, error } = await anon().from("listing_images").select("image_url").eq("entity", entity).eq("entity_id", id).eq("status", "ready").maybeSingle();
    if (error) return null;
    return data?.image_url ?? null;
  } catch {
    return null;
  }
}

/**
 * Bir nechta e'lonning tayyor AI rasmlari (id → manzil) — chatdagi natija kartalari uchun bitta so'rov bilan. Xususiyat
 * yoqilmagan yoki xato — bo'sh (kartalar rasmsiz, avvalgidek).
 */
export async function getListingImageUrls(entity: ListingEntity, ids: string[]): Promise<Record<string, string>> {
  const list = [...new Set(ids)].slice(0, 60);
  if (!list.length || !listingImageEnabled()) return {};
  try {
    const { data, error } = await anon().from("listing_images").select("entity_id, image_url").eq("entity", entity).eq("status", "ready").in("entity_id", list);
    if (error) return {};
    return Object.fromEntries((data ?? []).filter((r) => r.image_url).map((r) => [r.entity_id, r.image_url as string]));
  } catch {
    return {};
  }
}

interface ListingForImage {
  owner: string;
  names: (string | null)[];
  categorySlug: string | null;
  /** usta e'loni: xizmat kategoriyasi (sahna uchun) */
  masterCategory?: string | null;
}

/** Rasm uchun e'londan faqat kerakli maydonlar: kasb nomlari (ingliz, rus, o'zbek), sarlavha, kategoriya, egasi */
async function loadListing(entity: ListingEntity, id: string): Promise<ListingForImage | null> {
  const db = createAdminClient();
  if (entity === "vacancy") {
    const { data } = await db
      .from("vacancies")
      .select("owner_profile_id, title, category:categories(slug), profession:profession_nodes(name_en, name_ru, name_uz)")
      .eq("id", id)
      .maybeSingle();
    if (!data?.owner_profile_id) return null;
    const p = one(data.profession);
    return { owner: data.owner_profile_id, names: [p?.name_en ?? null, data.title, p?.name_ru ?? null, p?.name_uz ?? null], categorySlug: one(data.category)?.slug ?? null };
  }
  if (entity === "master") {
    const { data } = await db.from("master_listings").select("owner_profile_id, title, category:master_categories(slug, name_en)").eq("id", id).maybeSingle();
    if (!data?.owner_profile_id) return null;
    const c = one(data.category);
    return { owner: data.owner_profile_id, names: [c?.name_en ?? null, data.title], categorySlug: null, masterCategory: c?.slug ?? null };
  }
  const { data } = await db
    .from("worker_profiles")
    .select("profile_id, custom_profession, headline, profession:profession_nodes!worker_profiles_profession_node_id_fkey(name_en, name_ru, name_uz)")
    .eq("id", id)
    .maybeSingle();
  if (!data?.profile_id) return null;
  const p = one(data.profession);
  return { owner: data.profile_id, names: [p?.name_en ?? null, data.custom_profession, p?.name_ru ?? null, p?.name_uz ?? null, data.headline], categorySlug: null };
}

export type ListingImageResult = { ok: true; url: string } | { ok: false; error: string };

/**
 * Umumiy yo'l: navbat va xarajat chegarasi (claim_listing_image) → OpenAI → yaratilgan rasm ham tekshiriladi (moderatsiya)
 * → saqlanadi → holat "ready". Xatoda holat "failed" va qisqa sabab; foydalanuvchiga — tushunarli kod.
 */
async function produce(entity: ListingEntity, entityId: string, userId: string, prompt: string, cfg: NonNullable<ReturnType<typeof listingImageConfig>>): Promise<ListingImageResult> {
  const admin = createAdminClient();
  const { data: claim, error: claimError } = await admin.rpc("claim_listing_image", { p_entity: entity, p_entity_id: entityId, p_owner: userId, p_prompt: prompt, p_model: cfg.model });
  if (claimError) return { ok: false, error: "unavailable" };
  if (claim !== "ok") return { ok: false, error: claim ?? "unavailable" };

  const started = Date.now();
  try {
    const img = await openAiImage(cfg, prompt).catch(async (e) => {
      await logAiUsage({ feature: "listing_image", provider: "openai", model: cfg.model, ok: false, latencyMs: Date.now() - started, images: 0, error: e instanceof Error ? e.message : "error" });
      throw e;
    });
    await logAiUsage({ feature: "listing_image", provider: "openai", model: cfg.model, ok: true, latencyMs: Date.now() - started, images: 1 });
    // yaratilgan rasm ham tekshiriladi; o'tmasa saqlanmaydi
    const verdict = await checkGeneratedImage({ mimeType: img.mime, data: img.bytes.toString("base64") });
    if (verdict === "reject" || verdict === "review") throw new Error(`moderation_${verdict}`);
    const path = `${entity}/${entityId}-${Date.now()}.jpg`;
    const up = await admin.storage.from(BUCKET).upload(path, img.bytes, { contentType: img.mime, upsert: false, cacheControl: "31536000" });
    if (up.error) throw new Error(`storage_${up.error.message}`);
    const url = admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    await admin.from("listing_images").update({ status: "ready", image_url: url, storage_path: path, last_error: null, updated_at: new Date().toISOString() }).eq("entity", entity).eq("entity_id", entityId);
    return { ok: true, url };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[listing-image]", entity, entityId, msg.slice(0, 200));
    const outage = isProviderOutage(msg);
    const patch: { status: string; last_error: string; updated_at: string; attempts?: number } = { status: "failed", last_error: msg.slice(0, 300), updated_at: new Date().toISOString() };
    if (outage) {
      // urinish qaytariladi (claim uni oshirgan edi)
      const { data: cur } = await admin.from("listing_images").select("attempts").eq("entity", entity).eq("entity_id", entityId).maybeSingle();
      if (cur && typeof cur.attempts === "number") patch.attempts = Math.max(0, cur.attempts - 1);
    }
    await admin.from("listing_images").update(patch).eq("entity", entity).eq("entity_id", entityId);
    return { ok: false, error: msg.startsWith("moderation_") ? "moderation" : outage ? "provider_unavailable" : "generation_failed" };
  }
}

/** Joylangan e'lon uchun rasm (egasi). Avvalgi yo'l — e'lon tahririda ham ishlatiladi */
export async function generateListingImage(entity: ListingEntity, id: string, userId: string): Promise<ListingImageResult> {
  const cfg = listingImageConfig();
  if (!cfg) return { ok: false, error: "not_configured" };
  const listing = await loadListing(entity, id);
  if (!listing) return { ok: false, error: "not_found" };
  if (listing.owner !== userId) return { ok: false, error: "forbidden" };
  const prompt = buildListingImagePrompt({ kind: entity, names: listing.names, categorySlug: listing.categorySlug, masterCategory: listing.masterCategory ?? null });
  return produce(entity, id, userId, prompt, cfg);
}

/** Qoralama rasm uchun: kasb (bazadan — inglizcha nomi birinchi) va sarlavha */
async function draftNames(professionId: string | null, title: string | null): Promise<{ names: (string | null)[]; categorySlug: string | null }> {
  if (!professionId) return { names: [title], categorySlug: null };
  const db = createAdminClient();
  const { data } = await db.from("profession_nodes").select("name_en, name_ru, name_uz, category:categories(slug)").eq("id", professionId).maybeSingle();
  if (!data) return { names: [title], categorySlug: null };
  return { names: [data.name_en ?? null, title, data.name_ru ?? null, data.name_uz ?? null], categorySlug: one(data.category)?.slug ?? null };
}

/**
 * Qoralama id'si shu odamniki bo'la oladimi: mavjud e'lon id'si emas (aks holda begona e'longa rasm qo'yilardi) va boshqa
 * odamning qoralamasi emas
 */
export async function draftAllowed(entity: ListingEntity, draftId: string, userId: string): Promise<boolean> {
  const admin = createAdminClient();
  const realQuery =
    entity === "vacancy"
      ? admin.from("vacancies").select("id").eq("id", draftId).maybeSingle()
      : entity === "master"
        ? admin.from("master_listings").select("id").eq("id", draftId).maybeSingle()
        : admin.from("worker_profiles").select("id").eq("id", draftId).maybeSingle();
  const [{ data: row }, { data: real }] = await Promise.all([admin.from("listing_images").select("owner_profile_id").eq("entity", entity).eq("entity_id", draftId).maybeSingle(), realQuery]);
  return !real && !(row && row.owner_profile_id !== userId);
}

/**
 * E'lon JOYLANISHIDAN OLDIN (ega, 2026-11-22: "rasmni e'lon joylashdan oldin yaratish kerak, ma'qul kelsa joylash kerak"):
 * tekshirish sahifasida rasm qoralama id'si bilan yaratiladi (listing_images.entity_id = qoralama). Joylanganda
 * `attachDraftImage` uni e'longa o'tkazadi. Qoralama id — tasodifiy; mavjud e'lon id'si yoki boshqa odamning qoralamasi
 * bo'lishi mumkin emas (aks holda begona e'longa rasm qo'yilardi). Bir qoralamaga ko'pi bilan 3 urinish ("Boshqa rasm").
 */
export async function generateDraftImage(
  entity: ListingEntity,
  draftId: string,
  userId: string,
  input: { professionId: string | null; title: string | null; masterCategory?: string | null },
): Promise<ListingImageResult> {
  const cfg = listingImageConfig();
  if (!cfg) return { ok: false, error: "not_configured" };
  if (!(await draftAllowed(entity, draftId, userId))) return { ok: false, error: "forbidden" };
  // usta e'loni: kasb daraxti yo'q — kategoriya (sahna) va sarlavha (xizmatlar)
  const { names, categorySlug } = entity === "master" ? { names: [input.title], categorySlug: null } : await draftNames(input.professionId, input.title);
  if (!names.some((n) => n && n.trim())) return { ok: false, error: "invalid" };
  const prompt = buildListingImagePrompt({ kind: entity, names, categorySlug, masterCategory: input.masterCategory ?? null });
  return produce(entity, draftId, userId, prompt, cfg);
}

/**
 * Joylangan (yoki saqlangan) e'longa tayyor qoralama rasmni biriktiradi: faqat shu odamning tayyor qoralamasi. E'londa
 * avvalgi rasm bo'lsa — yangisi o'rnini egallaydi (egasi tekshirish sahifasida boshqasini tanladi). Xato e'lonni to'xtatmaydi.
 */
export async function attachDraftImage(entity: ListingEntity, draftId: string, listingId: string, userId: string): Promise<boolean> {
  if (!listingImageEnabled() || draftId === listingId) return false;
  try {
    const admin = createAdminClient();
    const { data: draft } = await admin
      .from("listing_images")
      .select("id")
      .eq("entity", entity)
      .eq("entity_id", draftId)
      .eq("owner_profile_id", userId)
      .eq("status", "ready")
      .maybeSingle();
    if (!draft) return false;
    await admin.from("listing_images").delete().eq("entity", entity).eq("entity_id", listingId);
    const { error } = await admin.from("listing_images").update({ entity_id: listingId, updated_at: new Date().toISOString() }).eq("id", draft.id);
    return !error;
  } catch (e) {
    console.error("[listing-image] attach", entity, e instanceof Error ? e.message.slice(0, 160) : "error");
    return false;
  }
}
