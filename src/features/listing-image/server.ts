import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { getServerEnv, publicEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAiUsage } from "@/lib/ai/usage";
import { checkGeneratedImage } from "@/features/moderation/service";
import { buildListingImagePrompt } from "./prompt";

export type ListingEntity = "vacancy" | "worker";
const BUCKET = "listing-images";
const DEFAULT_MODEL = "gpt-image-1.5";
const one = <T,>(x: T | T[] | null | undefined): T | null => (Array.isArray(x) ? (x[0] ?? null) : (x ?? null));

/** OpenAI rasm modeli sozlanganmi (kalit + service role). Sozlanmagan bo'lsa — "Rasm yaratilsinmi?" savoli chiqmaydi */
export function listingImageConfig(): { apiKey: string; model: string; quality: "low" | "medium" | "high"; baseUrl: string } | null {
  const env = getServerEnv();
  if (!env.OPENAI_API_KEY || !env.SUPABASE_SERVICE_ROLE_KEY) return null;
  return {
    apiKey: env.OPENAI_API_KEY,
    model: env.LISTING_IMAGE_MODEL || DEFAULT_MODEL,
    quality: env.LISTING_IMAGE_QUALITY ?? "medium",
    baseUrl: (env.OPENAI_BASE_URL || "https://api.openai.com").replace(/\/$/, ""),
  };
}

export function listingImageEnabled(): boolean {
  return listingImageConfig() !== null;
}

function anon() {
  return createSupabaseClient<Database>(publicEnv.NEXT_PUBLIC_SUPABASE_URL, publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
}

/** Tayyor rasm manzili (RLS: faqat status = ready). Jadval hali yo'q (0087 qo'llanmagan) yoki xato — null */
export async function getListingImageUrl(entity: ListingEntity, id: string): Promise<string | null> {
  try {
    const { data, error } = await anon().from("listing_images").select("image_url").eq("entity", entity).eq("entity_id", id).eq("status", "ready").maybeSingle();
    if (error) return null;
    return data?.image_url ?? null;
  } catch {
    return null;
  }
}

/** OpenAI Images API (gpt-image): bitta landshaft rasm, JPEG */
async function openAiImage(cfg: NonNullable<ReturnType<typeof listingImageConfig>>, prompt: string): Promise<{ bytes: Buffer; mime: string }> {
  const res = await fetch(`${cfg.baseUrl}/v1/images/generations`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${cfg.apiKey}` },
    body: JSON.stringify({ model: cfg.model, prompt, n: 1, size: "1536x1024", quality: cfg.quality, output_format: "jpeg", output_compression: 85 }),
    signal: AbortSignal.timeout(100_000),
  });
  if (!res.ok) {
    // xato matni (kalitsiz) — jurnal uchun qisqa
    const body = await res.text().catch(() => "");
    const code = /"code"\s*:\s*"([^"]{1,60})"/.exec(body)?.[1];
    throw new Error(`provider_http_${res.status}${code ? `_${code}` : ""}`);
  }
  const json = (await res.json()) as { data?: { b64_json?: string }[] };
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) throw new Error("provider_no_image");
  return { bytes: Buffer.from(b64, "base64"), mime: "image/jpeg" };
}

interface ListingForImage {
  owner: string;
  names: (string | null)[];
  categorySlug: string | null;
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
 * E'lon rasmini yaratish (egasi "Ha" bosganda). Tartib: e'lon va egasi tekshiriladi → navbat va xarajat chegarasi
 * (claim_listing_image) → OpenAI → yaratilgan rasm ham tekshiriladi (moderatsiya) → saqlanadi → holat "ready".
 * Xatoda holat "failed" va qisqa sabab; foydalanuvchiga — tushunarli kod.
 */
export async function generateListingImage(entity: ListingEntity, id: string, userId: string): Promise<ListingImageResult> {
  const cfg = listingImageConfig();
  if (!cfg) return { ok: false, error: "not_configured" };
  const listing = await loadListing(entity, id);
  if (!listing) return { ok: false, error: "not_found" };
  if (listing.owner !== userId) return { ok: false, error: "forbidden" };

  const prompt = buildListingImagePrompt({ kind: entity, names: listing.names, categorySlug: listing.categorySlug });
  const admin = createAdminClient();
  const { data: claim, error: claimError } = await admin.rpc("claim_listing_image", { p_entity: entity, p_entity_id: id, p_owner: userId, p_prompt: prompt, p_model: cfg.model });
  if (claimError) return { ok: false, error: "unavailable" };
  if (claim !== "ok") return { ok: false, error: claim ?? "unavailable" };

  const fail = async (msg: string) => {
    await admin.from("listing_images").update({ status: "failed", last_error: msg.slice(0, 300), updated_at: new Date().toISOString() }).eq("entity", entity).eq("entity_id", id);
  };
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
    const path = `${entity}/${id}-${Date.now()}.jpg`;
    const up = await admin.storage.from(BUCKET).upload(path, img.bytes, { contentType: img.mime, upsert: false, cacheControl: "31536000" });
    if (up.error) throw new Error(`storage_${up.error.message}`);
    const url = admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    await admin.from("listing_images").update({ status: "ready", image_url: url, storage_path: path, last_error: null, updated_at: new Date().toISOString() }).eq("entity", entity).eq("entity_id", id);
    return { ok: true, url };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[listing-image]", entity, id, msg.slice(0, 200));
    await fail(msg);
    return { ok: false, error: msg.startsWith("moderation_") ? "moderation" : "generation_failed" };
  }
}
