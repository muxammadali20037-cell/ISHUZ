import "server-only";

import { logAiUsage } from "@/lib/ai/usage";
import { checkGeneratedImage } from "@/features/moderation/service";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { getServerEnv, publicEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { isProviderOutage, openAiImage, openAiImageConfig, type OpenAiImageConfig } from "@/lib/ai/openai-image";
import { buildListingImagePrompt } from "@/features/listing-image/prompt";
import { buildProfessionPrompt, professionAndSpecialization, promptName } from "./prompt";

const BUCKET = "profession-images";
const GEMINI_MODEL = "gemini-2.5-flash-image";
const one = <T,>(x: T | T[] | null | undefined): T | null => (Array.isArray(x) ? (x[0] ?? null) : (x ?? null));

/**
 * Rasm provayderi. Ega (2026-11-27): kasb rasmi e'lonning tayyor rasmi bo'ladi — e'lon rasmlari bilan bir xil OpenAI
 * (kalit, model, landshaft 3:2, sahna va "yuzsiz" qoidasi). OpenAI sozlanmagan bo'lsa — avvalgi Gemini (IMAGE_GEN_API_KEY).
 */
type Provider =
  | { kind: "openai"; model: string; cfg: OpenAiImageConfig }
  | { kind: "gemini"; model: string; apiKey: string; baseUrl: string };

/** Rasm generatsiyasi sozlanganmi (kalit + service role). Sozlanmagan bo'lsa hech qachon tashqi so'rov yuborilmaydi */
export function imageGenConfig(): Provider | null {
  const oa = openAiImageConfig();
  if (oa) return { kind: "openai", model: oa.model, cfg: oa };
  const env = getServerEnv();
  if (!env.IMAGE_GEN_API_KEY || !env.SUPABASE_SERVICE_ROLE_KEY) return null;
  return {
    kind: "gemini",
    apiKey: env.IMAGE_GEN_API_KEY,
    model: env.IMAGE_GEN_MODEL || GEMINI_MODEL,
    baseUrl: (env.IMAGE_GEN_BASE_URL || "https://generativelanguage.googleapis.com").replace(/\/$/, ""),
  };
}

function anon() {
  return createSupabaseClient<Database>(publicEnv.NEXT_PUBLIC_SUPABASE_URL, publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
}

/** Tayyor rasmlar: node_id → URL (faqat status = ready; RLS shuni ochadi) */
export async function getProfessionImages(nodeIds: Array<string | null | undefined>): Promise<Record<string, string>> {
  const ids = [...new Set(nodeIds.filter((x): x is string => !!x))].slice(0, 100);
  if (!ids.length) return {};
  const { data, error } = await anon().from("profession_images").select("node_id, image_url").in("node_id", ids).eq("status", "ready");
  if (error) return {};
  const out: Record<string, string> = {};
  for (const r of data ?? []) if (r.image_url) out[r.node_id] = r.image_url;
  return out;
}

/** Bitta kasbning tayyor rasmi (server, keshsiz — yangi yaratilgani darhol ko'rinsin) */
export async function readyProfessionImage(nodeId: string): Promise<string | null> {
  const { data } = await createAdminClient().from("profession_images").select("image_url").eq("node_id", nodeId).eq("status", "ready").maybeSingle();
  return data?.image_url ?? null;
}

/** Gemini rasm modeli (REST). Javobdagi birinchi rasm qaytadi */
async function geminiImage(p: Extract<Provider, { kind: "gemini" }>, prompt: string): Promise<{ bytes: Buffer; mime: string }> {
  const res = await fetch(`${p.baseUrl}/v1beta/models/${encodeURIComponent(p.model)}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": p.apiKey },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "4:3" } },
    }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!res.ok) throw new Error(`provider_http_${res.status}`);
  const json = (await res.json()) as { candidates?: { content?: { parts?: { inlineData?: { data?: string; mimeType?: string } }[] } }[] };
  const part = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
  if (!part?.inlineData?.data) throw new Error("provider_no_image");
  const mime = part.inlineData.mimeType ?? "image/png";
  if (!/^image\/(png|jpeg|webp)$/.test(mime)) throw new Error("provider_bad_mime");
  return { bytes: Buffer.from(part.inlineData.data, "base64"), mime };
}

/**
 * Kasb tugunidan so'rov. OpenAI: e'lon rasmi shabloni — ishchi e'loni qoidasi bilan (kameraga qaragan yuz yo'q: rasm
 * vakansiyada ham, ishchi e'lonida ham ishlatiladi va kimningdir surati deb o'ylanmasin). Gemini — avvalgi shablon.
 */
async function nodePrompt(nodeId: string, provider: Provider): Promise<string | null> {
  const admin = createAdminClient();
  const { data: node } = await admin.from("profession_nodes").select("id, kind, name_en, name_ru, name_uz, path, category:categories(slug)").eq("id", nodeId).maybeSingle();
  if (!node) return null;
  const pathIds = (node.path as string[] | null) ?? [];
  const { data: ancestors } = pathIds.length ? await admin.from("profession_nodes").select("id, kind, name_en, name_ru, name_uz").in("id", pathIds) : { data: [] };
  const byId = new Map((ancestors ?? []).map((a) => [a.id, a]));
  const path = [...pathIds.filter((id) => id !== node.id).map((id) => byId.get(id)).filter((x): x is NonNullable<typeof x> => !!x), node];
  const names = professionAndSpecialization(path);
  if (!names) return null;
  if (provider.kind === "openai") {
    return buildListingImagePrompt({ kind: "worker", names: [promptName(node), names.profession, node.name_ru, node.name_uz], categorySlug: one(node.category)?.slug ?? null });
  }
  return buildProfessionPrompt(names.profession, names.specialization);
}

export type ProfessionImageResult = { ok: true; url: string } | { ok: false; error: string };

/**
 * Navbat olingandan keyin: yaratish → tekshirish (moderatsiya) → saqlash → "ready". Fayl nomi har safar yangi (CDN eski
 * rasmni bermasin). Xatoda: avvalgi tayyor rasm bo'lsa (admin almashtirayotgan edi) — o'sha qaytadi, bo'lmasa "failed";
 * provayder xatosi urinish sanalmaydi.
 */
async function produce(nodeId: string, prompt: string, provider: Provider): Promise<ProfessionImageResult> {
  const admin = createAdminClient();
  const started = Date.now();
  try {
    const img = await (provider.kind === "openai" ? openAiImage(provider.cfg, prompt) : geminiImage(provider, prompt)).catch(async (e) => {
      await logAiUsage({ feature: "profession_image", provider: provider.kind, model: provider.model, ok: false, latencyMs: Date.now() - started, images: 0, error: e instanceof Error ? e.message : "error" });
      throw e;
    });
    await logAiUsage({ feature: "profession_image", provider: provider.kind, model: provider.model, ok: true, latencyMs: Date.now() - started, images: 1 });
    // yaratilgan rasm ham tekshiriladi (rasm + undagi yozuv); o'tmasa saqlanmaydi
    const verdict = await checkGeneratedImage({ mimeType: img.mime, data: img.bytes.toString("base64") });
    if (verdict === "reject" || verdict === "review") throw new Error(`moderation_${verdict}`);
    const ext = img.mime === "image/jpeg" ? "jpg" : img.mime === "image/webp" ? "webp" : "png";
    const path = `${nodeId}-${Date.now()}.${ext}`;
    const up = await admin.storage.from(BUCKET).upload(path, img.bytes, { contentType: img.mime, upsert: false, cacheControl: "31536000" });
    if (up.error) throw new Error(`storage_${up.error.message}`);
    const url = admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    await admin.from("profession_images").update({ status: "ready", image_url: url, storage_path: path, model: provider.model, last_error: null, updated_at: new Date().toISOString() }).eq("node_id", nodeId);
    return { ok: true, url };
  } catch (e) {
    const msg = (e instanceof Error ? e.message : String(e)).slice(0, 300);
    console.error("[profession-images]", nodeId, msg);
    const outage = isProviderOutage(msg);
    const { data: cur } = await admin.from("profession_images").select("attempts, image_url").eq("node_id", nodeId).maybeSingle();
    const patch: { status: string; last_error: string; updated_at: string; attempts?: number } = { status: cur?.image_url ? "ready" : "failed", last_error: msg, updated_at: new Date().toISOString() };
    if (outage && cur && typeof cur.attempts === "number") patch.attempts = Math.max(0, cur.attempts - 1);
    await admin.from("profession_images").update(patch).eq("node_id", nodeId);
    return { ok: false, error: msg.startsWith("moderation_") ? "moderation" : outage ? "provider_unavailable" : "generation_failed" };
  }
}

/**
 * Berilgan kasblar uchun rasm yo'q bo'lsa — yaratadi va saqlaydi (har kasb uchun BIR MARTA, keyin qayta ishlatiladi).
 * Fonda chaqiriladi (`after()` yoki cron): e'lon joylash yoki qidiruvni kutdirmaydi. Xatoda jim.
 * Navbat, takroriy urinish va kunlik xarajat cheklovi bazada (`claim_profession_image`, profession_images_daily_limit).
 */
export async function ensureProfessionImages(nodeIds: Array<string | null | undefined>, max = 2): Promise<{ generated: number; skipped: number; failed: number }> {
  const stats = { generated: 0, skipped: 0, failed: 0 };
  const provider = imageGenConfig();
  const ids = [...new Set(nodeIds.filter((x): x is string => !!x))];
  if (!provider || !ids.length) return { ...stats, skipped: ids.length };
  const ready = await getProfessionImages(ids);
  const todo = ids.filter((id) => !ready[id]).slice(0, max);
  stats.skipped = ids.length - todo.length;
  const admin = createAdminClient();

  for (const nodeId of todo) {
    const prompt = await nodePrompt(nodeId, provider);
    if (!prompt) {
      stats.skipped++;
      continue;
    }
    const { data: claimed } = await admin.rpc("claim_profession_image", { p_node_id: nodeId, p_prompt: prompt, p_model: provider.model });
    if (!claimed) {
      stats.skipped++;
      continue;
    }
    const res = await produce(nodeId, prompt, provider);
    if (res.ok) stats.generated++;
    else stats.failed++;
  }
  return stats;
}

/** Fon uchun xavfsiz chaqiruv: hech qachon xato tashlamaydi */
export async function ensureProfessionImagesSafe(nodeIds: Array<string | null | undefined>, max = 2): Promise<void> {
  try {
    await ensureProfessionImages(nodeIds, max);
  } catch (e) {
    console.error("[profession-images] background", e instanceof Error ? e.message : e);
  }
}

/**
 * Bitta kasbga rasm — SHU ZAHOTI (20–60 s). Ega (2026-11-27): e'lon tekshiruvida "Rasm yaratish" bosilganda kasbning
 * rasmi yo'q bo'lsa — kasb rasmi yaratiladi va keyin shu kasbdagi hammaga tayyor turadi. `batch` — admin panelidan
 * oldindan yaratish, `force` — admin tayyorini almashtiradi. Navbat va xarajat — claim_profession_image_by (0093).
 */
export async function generateProfessionImage(nodeId: string, userId: string, opts: { batch?: boolean; force?: boolean } = {}): Promise<ProfessionImageResult> {
  const provider = imageGenConfig();
  if (!provider) return { ok: false, error: "not_configured" };
  const prompt = await nodePrompt(nodeId, provider);
  if (!prompt) return { ok: false, error: "invalid" };
  const { data: claim, error } = await createAdminClient().rpc("claim_profession_image_by", {
    p_node_id: nodeId,
    p_owner: userId,
    p_prompt: prompt,
    p_model: provider.model,
    p_batch: !!opts.batch,
    p_force: !!opts.force,
  });
  if (error) return { ok: false, error: "unavailable" };
  if (claim !== "ok") return { ok: false, error: claim ?? "unavailable" };
  return produce(nodeId, prompt, provider);
}
