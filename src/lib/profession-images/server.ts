import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { getServerEnv, publicEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildProfessionPrompt, professionAndSpecialization } from "./prompt";

const BUCKET = "profession-images";
const DEFAULT_MODEL = "gemini-2.5-flash-image";

function anon() {
  return createSupabaseClient<Database>(publicEnv.NEXT_PUBLIC_SUPABASE_URL, publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
}

/** Rasm generatsiyasi sozlanganmi (alohida kalit + service role). Sozlanmagan bo'lsa hech qachon tashqi so'rov yuborilmaydi */
export function imageGenConfig(): { apiKey: string; model: string; baseUrl: string } | null {
  const env = getServerEnv();
  if (!env.IMAGE_GEN_API_KEY || !env.SUPABASE_SERVICE_ROLE_KEY) return null;
  return {
    apiKey: env.IMAGE_GEN_API_KEY,
    model: env.IMAGE_GEN_MODEL || DEFAULT_MODEL,
    baseUrl: (env.IMAGE_GEN_BASE_URL || "https://generativelanguage.googleapis.com").replace(/\/$/, ""),
  };
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

/** Gemini rasm modeli (REST). Javobdagi birinchi rasm qaytadi */
async function generateImage(cfg: NonNullable<ReturnType<typeof imageGenConfig>>, prompt: string): Promise<{ bytes: Buffer; mime: string }> {
  const res = await fetch(`${cfg.baseUrl}/v1beta/models/${encodeURIComponent(cfg.model)}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": cfg.apiKey },
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
 * Berilgan kasblar uchun rasm yo'q bo'lsa — yaratadi va saqlaydi (har kasb uchun BIR MARTA, keyin qayta ishlatiladi).
 * Fonda chaqiriladi (`after()` yoki cron): e'lon joylash yoki qidiruvni kutdirmaydi. Xatoda jim — ikonka ko'rinishda qoladi.
 * Navbat, takroriy urinish va kunlik xarajat cheklovi bazada (`claim_profession_image`).
 */
export async function ensureProfessionImages(nodeIds: Array<string | null | undefined>, max = 2): Promise<{ generated: number; skipped: number; failed: number }> {
  const stats = { generated: 0, skipped: 0, failed: 0 };
  const cfg = imageGenConfig();
  const ids = [...new Set(nodeIds.filter((x): x is string => !!x))];
  if (!cfg || !ids.length) return { ...stats, skipped: ids.length };
  const ready = await getProfessionImages(ids);
  const todo = ids.filter((id) => !ready[id]).slice(0, max);
  stats.skipped = ids.length - todo.length;
  const admin = createAdminClient();

  for (const nodeId of todo) {
    const { data: node } = await admin.from("profession_nodes").select("id, kind, name_en, name_ru, name_uz, path").eq("id", nodeId).maybeSingle();
    if (!node) {
      stats.skipped++;
      continue;
    }
    const pathIds = (node.path as string[] | null) ?? [];
    const { data: ancestors } = pathIds.length ? await admin.from("profession_nodes").select("id, kind, name_en, name_ru, name_uz").in("id", pathIds) : { data: [] };
    const byId = new Map((ancestors ?? []).map((a) => [a.id, a]));
    const path = [...pathIds.filter((id) => id !== node.id).map((id) => byId.get(id)).filter((x): x is NonNullable<typeof x> => !!x), node];
    const names = professionAndSpecialization(path);
    if (!names) {
      stats.skipped++;
      continue;
    }
    const prompt = buildProfessionPrompt(names.profession, names.specialization);
    const { data: claimed } = await admin.rpc("claim_profession_image", { p_node_id: nodeId, p_prompt: prompt, p_model: cfg.model });
    if (!claimed) {
      stats.skipped++;
      continue;
    }
    try {
      const img = await generateImage(cfg, prompt);
      const ext = img.mime === "image/jpeg" ? "jpg" : img.mime === "image/webp" ? "webp" : "png";
      const path = `${nodeId}.${ext}`;
      const up = await admin.storage.from(BUCKET).upload(path, img.bytes, { contentType: img.mime, upsert: true, cacheControl: "31536000" });
      if (up.error) throw new Error(`storage_${up.error.message}`);
      const url = admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
      await admin.from("profession_images").update({ status: "ready", image_url: url, storage_path: path, last_error: null, updated_at: new Date().toISOString() }).eq("node_id", nodeId);
      stats.generated++;
    } catch (e) {
      const msg = (e instanceof Error ? e.message : String(e)).slice(0, 300);
      console.error("[profession-images]", nodeId, msg);
      await admin.from("profession_images").update({ status: "failed", last_error: msg, updated_at: new Date().toISOString() }).eq("node_id", nodeId);
      stats.failed++;
    }
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
