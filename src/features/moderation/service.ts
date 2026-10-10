import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { aiJson, aiProviderConfigured } from "@/lib/ai/json";
import type { AiImage } from "@/lib/ai/gemini";
import { publicEnv } from "@/lib/env";
import { runModerationEngine, type ModerationImage } from "./engine";
import { imageSystemPrompt, imageVerdictSchema, moderationSystemPrompt, moderationUserPrompt, textVerdictSchema } from "./verdict";
import { isTelegramGeneratedAvatar } from "./images";

/**
 * Moderatsiya xizmati (faqat serverda, service role): bazadan aynan tekshiriladigan versiyani oladi,
 * qoidalar + AI dan o'tkazadi va natijani shu versiyaga bog'lab yozadi (moderation_apply).
 * AI uzilsa yoki javobi yaroqsiz bo'lsa — moderation_fail (e'lon pending, keyin qayta urinish);
 * 5 marta muvaffaqiyatsiz bo'lsa — admin tekshiruviga ("review").
 */

export type ModerationEntity = "vacancy" | "worker";

const MAX_ATTEMPTS = 5;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

interface Snapshot {
  entity: ModerationEntity;
  id: string;
  version: number;
  attempts?: number;
  locale?: string | null;
  fields: Record<string, string>;
  images: { photo?: string; logo?: string };
  signals: string[];
}

function storageBase() {
  return `${publicEnv.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "")}/storage/v1/object/public/`;
}

/** Faqat ishonchli manbalardagi rasm yuklab olinadi (SSRF'dan himoya) */
export function trustedImageUrl(entity: ModerationEntity, key: string, value: string): string | null {
  if (!value) return null;
  if (entity === "vacancy" && key === "photo" && !/^https?:\/\//.test(value)) {
    return `${storageBase()}vacancy-photos/${value.split("/").map(encodeURIComponent).join("/")}`;
  }
  if (value.startsWith(storageBase())) return value;
  try {
    const u = new URL(value);
    if (u.protocol === "https:" && (u.hostname === "t.me" || u.hostname.endsWith(".telesco.pe") || u.hostname === "telesco.pe")) return value;
  } catch {
    return null;
  }
  return null;
}

/** Yuklab olish mumkin bo'lgan host: o'z storage yoki Telegram rasmlari (har bir yo'naltirishda qayta tekshiriladi) */
function trustedFetchUrl(url: string): boolean {
  if (url.startsWith(storageBase())) return true;
  try {
    const u = new URL(url);
    return u.protocol === "https:" && (u.hostname === "t.me" || u.hostname === "telesco.pe" || u.hostname.endsWith(".telesco.pe"));
  } catch {
    return false;
  }
}

/** Tanani oqim bilan o'qiydi: chegaradan oshsa darhol to'xtaydi (katta faylni xotiraga to'liq olmaydi) */
async function readCapped(res: Response, maxBytes: number): Promise<Buffer> {
  const reader = res.body?.getReader();
  if (!reader) return Buffer.alloc(0);
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw new Error("image_too_large");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

async function fetchImage(url: string): Promise<AiImage> {
  // SSRF: yo'naltirishlar qo'lda kuzatiladi — har bir manzil ishonchli ro'yxatda bo'lishi shart (ichki tarmoqqa burilmaydi)
  let current = url;
  for (let hop = 0; hop < 4; hop++) {
    if (!trustedFetchUrl(current)) throw new Error("image_untrusted");
    const res = await fetch(current, { signal: AbortSignal.timeout(15_000), redirect: "manual" });
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) throw new Error(`image_${res.status}`);
      current = new URL(location, current).toString();
      continue;
    }
    if (!res.ok) throw new Error(`image_${res.status}`);
    const type = (res.headers.get("content-type") ?? "").split(";")[0]!.trim().toLowerCase();
    if (!IMAGE_TYPES.has(type)) throw new Error("image_type");
    if (Number(res.headers.get("content-length") ?? "0") > MAX_IMAGE_BYTES) throw new Error("image_too_large");
    const buf = await readCapped(res, MAX_IMAGE_BYTES);
    return { mimeType: type, data: buf.toString("base64") };
  }
  throw new Error("image_redirects");
}

async function settings(db: ReturnType<typeof createAdminClient>) {
  const { data } = await db.from("app_settings").select("key, value").in("key", ["moderation_without_ai", "moderation_ai_daily_limit"]);
  const map = new Map((data ?? []).map((r) => [r.key, r.value]));
  return {
    withoutAi: map.get("moderation_without_ai") === "rules" ? ("rules" as const) : ("review" as const),
    dailyLimit: Number(map.get("moderation_ai_daily_limit") ?? 3000) || 3000,
  };
}

export async function moderateEntity(entity: ModerationEntity, id: string, opts: { notify: boolean }): Promise<string | null> {
  const db = createAdminClient();
  const { data: raw } = await db.rpc("moderation_snapshot", { p_entity: entity, p_id: id });
  const snap = raw as unknown as Snapshot | null;
  if (!snap) return null;
  const cfg = await settings(db);
  try {
    const aiAvailable = aiProviderConfigured();
    if (aiAvailable) {
      const { data: allowed } = await db.rpc("check_rate_limit", { p_key: "moderation_ai:day", p_limit: cfg.dailyLimit, p_window_seconds: 86400 });
      if (allowed === false) throw new Error("ai_daily_limit");
    }
    const images: ModerationImage[] = [];
    const untrusted: string[] = [];
    for (const [key, value] of Object.entries(snap.images ?? {})) {
      if (!value) continue;
      // Telegram'ning avtomatik avatari (ism harflari, SVG) — foydalanuvchi rasmi emas, tekshirilmaydi
      if (isTelegramGeneratedAvatar(value)) continue;
      const url = trustedImageUrl(entity, key, value);
      if (url) images.push({ key, url });
      else untrusted.push(`image_untrusted@${key}`);
    }
    const locale = snap.locale ?? "uz";
    const result = await runModerationEngine(
      { entity, locale, fields: snap.fields ?? {}, images, signals: [...(snap.signals ?? []), ...untrusted] },
      {
        aiAvailable,
        withoutAi: cfg.withoutAi,
        textVerdict: (x) =>
          aiJson(textVerdictSchema, moderationSystemPrompt(x.locale), moderationUserPrompt(x.entity, x.fields, x.links, x.signals), {
            feature: "moderation_text", timeoutMs: 25_000, temperature: 0, maxOutputTokens: 1024,
          }),
        imageVerdict: async (image, loc) => {
          const img = await fetchImage(image.url);
          const out = await aiJson(imageVerdictSchema, imageSystemPrompt(loc), "Check this image.", {
            feature: "moderation_image", images: [img], timeoutMs: 30_000, temperature: 0, maxOutputTokens: 1500,
          });
          const { extracted_text, ...verdict } = out;
          return { verdict, extractedText: extracted_text ?? "" };
        },
      },
    );
    // tashqi (ishonchsiz) rasm avtomatik tasdiqlanmaydi
    const decision = untrusted.length && result.decision === "allow" ? "review" : result.decision;
    const { data: state, error } = await db.rpc("moderation_apply", {
      p_entity: entity, p_id: id, p_version: snap.version, p_decision: decision,
      p_category: decision === "allow" ? result.category : result.category === "job_related" ? "uncertain" : result.category,
      p_reason_code: decision !== result.decision ? "external_image" : result.reasonCode,
      p_user_message: result.userMessage, p_flagged_fields: result.flaggedFields, p_source: result.source,
      p_model: result.source === "ai" ? "ai" : "rules", p_signals: result.signals.slice(0, 30), p_notify: opts.notify,
    });
    if (error) throw new Error(error.message);
    return state;
  } catch (e) {
    const message = e instanceof Error ? e.message : "error";
    await db.rpc("moderation_fail", { p_entity: entity, p_id: id, p_version: snap.version, p_error: message });
    if ((snap.attempts ?? 0) + 1 >= MAX_ATTEMPTS) {
      // ko'p marta uzilish — admin qo'lda ko'rib chiqadi (avtomatik tasdiq yo'q)
      const { data: state } = await db.rpc("moderation_apply", {
        p_entity: entity, p_id: id, p_version: snap.version, p_decision: "review", p_category: "uncertain",
        p_reason_code: "ai_failed", p_user_message: "", p_flagged_fields: [], p_source: "system", p_notify: false,
      });
      return state;
    }
    return "moderation_pending";
  }
}

/** Joylash tugmasidan keyin: darhol tekshirish (vaqt cheklangan). Ulgurmasa — fon navbati davom ettiradi. */
export async function moderateNow(entity: ModerationEntity, id: string, timeoutMs = 15_000): Promise<void> {
  const db = createAdminClient();
  const { data: version } = await db.rpc("moderation_lease", { p_entity: entity, p_id: id });
  if (version == null) return;
  await Promise.race([moderateEntity(entity, id, { notify: false }).catch(() => null), new Promise((r) => setTimeout(r, timeoutMs))]);
}

/** Fon navbati (cron har daqiqa): ijara bilan olinadi, vaqt chegarasida to'xtaydi */
export async function processModerationQueue(limit = 8, budgetMs = 25_000): Promise<number> {
  const started = Date.now();
  const db = createAdminClient();
  const { data } = await db.rpc("moderation_claim", { p_limit: limit });
  let n = 0;
  for (const row of data ?? []) {
    if (Date.now() - started > budgetMs) break;
    await moderateEntity(row.o_entity as ModerationEntity, row.o_id, { notify: true }).catch(() => null);
    n += 1;
  }
  return n;
}

/**
 * Tizim yaratgan rasm (kasb tasviri) ham saqlashdan oldin tekshiriladi: rasm + undagi yozuv.
 * AI sozlanmagan bo'lsa — rasm bizning nazoratdagi shablondan yaratilgani uchun o'tkaziladi ("unchecked").
 */
export async function checkGeneratedImage(img: AiImage): Promise<"allow" | "reject" | "review" | "unchecked"> {
  if (!aiProviderConfigured()) return "unchecked";
  const out = await aiJson(imageVerdictSchema, imageSystemPrompt("uz"), "Check this image.", {
    feature: "moderation_generated_image", images: [img], timeoutMs: 30_000, temperature: 0, maxOutputTokens: 1500,
  });
  const { extracted_text, ...verdict } = out;
  const result = await runModerationEngine(
    { entity: "vacancy", locale: "uz", fields: {}, images: [{ key: "photo", url: "inline" }], signals: [] },
    {
      aiAvailable: true,
      withoutAi: "review",
      textVerdict: async () => ({ decision: "allow", category: "job_related", reason_code: "no_text", user_message: "", flagged_fields: [] }),
      imageVerdict: async () => ({ verdict, extractedText: extracted_text ?? "" }),
    },
  );
  return result.decision;
}
