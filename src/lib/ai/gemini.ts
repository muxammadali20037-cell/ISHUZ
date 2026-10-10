import "server-only";

import { z } from "zod";
import { getServerEnv } from "@/lib/env";
import { logAiUsage } from "./usage";

/**
 * Google Gemini (REST, generateContent) — bepul limitli AI. Javob JSON sxema bo'yicha (responseSchema),
 * so'ng zod bilan qayta tekshiriladi: sxemadan chiqsa null.
 */
export const GEMINI_DEFAULT_MODEL = "gemini-flash-latest";

export class AiBusyError extends Error {}

/** Rasm (vision): base64 ma'lumot va turi */
export interface AiImage {
  mimeType: string;
  data: string;
}

export interface AiCallOptions {
  /** Jurnal uchun xususiyat nomi (ai_usage_log.feature) */
  feature?: string;
  images?: AiImage[];
  timeoutMs?: number;
  temperature?: number;
  maxOutputTokens?: number;
}

type JsonSchema = {
  type?: string | string[];
  anyOf?: JsonSchema[];
  enum?: unknown[];
  items?: JsonSchema;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  description?: string;
};
type GeminiSchema = {
  type: string;
  nullable?: boolean;
  enum?: string[];
  items?: GeminiSchema;
  properties?: Record<string, GeminiSchema>;
  required?: string[];
  propertyOrdering?: string[];
  description?: string;
};

/** JSON Schema (zod) → Gemini OpenAPI sxemasi (STRING/INTEGER/..., nullable) */
export function toGeminiSchema(s: JsonSchema): GeminiSchema {
  let nullable = false;
  let node = s;
  if (s.anyOf) {
    const rest = s.anyOf.filter((x) => x.type !== "null");
    nullable = rest.length < s.anyOf.length;
    node = { ...rest[0], description: s.description ?? rest[0]?.description };
  }
  let type = node.type;
  if (Array.isArray(type)) {
    nullable = nullable || type.includes("null");
    type = type.find((x) => x !== "null");
  }
  const out: GeminiSchema = { type: String(type ?? "string").toUpperCase() };
  if (nullable) out.nullable = true;
  if (node.description) out.description = node.description;
  if (node.enum) out.enum = node.enum.filter((v): v is string => typeof v === "string");
  if (node.items) out.items = toGeminiSchema(node.items);
  if (node.properties) {
    out.properties = Object.fromEntries(Object.entries(node.properties).map(([k, v]) => [k, toGeminiSchema(v)]));
    out.propertyOrdering = Object.keys(node.properties);
    if (node.required) out.required = node.required;
  }
  return out;
}

/**
 * Asosiy model band bo'lsa (503/429), javob kechiksa yoki model topilmasa — shu modellar ketma-ket sinaladi.
 * "-latest" taxalluslari Google'ning joriy modellariga ishora qiladi.
 */
export const GEMINI_FALLBACK_MODELS = ["gemini-flash-lite-latest", "gemini-2.5-flash"];

type Attempt<T> =
  | { kind: "ok"; value: T | null }
  | { kind: "busy"; error: string }
  | { kind: "no_thinking" }
  | { kind: "skip"; error: string };

/** Gemini xato javobidan qisqa matn (kalit javobda qaytmaydi) — jurnal va admin uchun */
export function geminiErrorText(status: number, body: string): string {
  let msg = body;
  try {
    msg = (JSON.parse(body) as { error?: { message?: string } }).error?.message ?? body;
  } catch {
    /* matn o'zi */
  }
  return `http_${status}: ${msg.replace(/\s+/g, " ").trim()}`.slice(0, 200);
}

/**
 * Qat'iy sxemali Gemini chaqiruvi. Umumiy vaqt — opts.timeoutMs (sukut 90 s), modellar o'rtasida taqsimlanadi.
 * Tezlik uchun "fikrlash" o'chiriladi (model 400 qaytarsa — usiz qayta so'raladi). 429/5xx/tarmoq/vaqt — band:
 * keyingi model. Boshqa 4xx (model yo'q, ruxsat yo'q, so'rov xato) — ham keyingi model; hech biri ishlamasa:
 * hech bo'lmasa bittasi band bo'lgan bo'lsa AiBusyError, aks holda oxirgi xato matni bilan Error.
 * Javob sxemaga mos kelmasa — null (boshqa modelda qayta urinilmaydi).
 */
export async function geminiJson<T extends z.ZodType>(schema: T, system: string, userText: string, opts: AiCallOptions = {}): Promise<z.infer<T> | null> {
  const env = getServerEnv();
  if (!env.GEMINI_API_KEY) return null;
  const apiKey = env.GEMINI_API_KEY;
  const models = [...new Set([env.GEMINI_MODEL || GEMINI_DEFAULT_MODEL, ...GEMINI_FALLBACK_MODELS])];
  const base = (env.GEMINI_BASE_URL ?? "https://generativelanguage.googleapis.com").replace(/\/$/, "");
  const feature = opts.feature ?? "other";
  const images = opts.images ?? [];
  const deadline = Date.now() + (opts.timeoutMs ?? 90_000);
  const responseSchema = toGeminiSchema(z.toJSONSchema(schema) as JsonSchema);

  const attempt = async (model: string, timeoutMs: number, thinkingOff: boolean): Promise<Attempt<z.infer<T>>> => {
    const started = Date.now();
    const log = (ok: boolean, usage?: { promptTokenCount?: number; candidatesTokenCount?: number }, error?: string) =>
      logAiUsage({
        feature, provider: "gemini", model, ok, latencyMs: Date.now() - started,
        inputTokens: usage?.promptTokenCount ?? null, outputTokens: usage?.candidatesTokenCount ?? null, images: images.length, error,
      });
    let res: Response;
    try {
      res = await fetch(`${base}/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [...images.map((im) => ({ inlineData: { mimeType: im.mimeType, data: im.data } })), { text: userText }] }],
          generationConfig: {
            temperature: opts.temperature ?? 0.2,
            maxOutputTokens: opts.maxOutputTokens ?? 8192,
            responseMimeType: "application/json",
            responseSchema,
            ...(thinkingOff ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
          },
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (e) {
      // tarmoq xatosi yoki vaqt tugadi — keyingi model
      const msg = e instanceof Error ? e.message : "network";
      await log(false, undefined, msg);
      return { kind: "busy", error: msg };
    }
    if (res.status === 429 || res.status >= 500) {
      const error = geminiErrorText(res.status, (await res.text().catch(() => "")).slice(0, 600));
      await log(false, undefined, error);
      return { kind: "busy", error };
    }
    if (!res.ok) {
      const error = geminiErrorText(res.status, (await res.text()).slice(0, 600));
      await log(false, undefined, error);
      // "fikrlash"ni o'chirish bu modelda qo'llanmasa — o'sha model usiz
      if (thinkingOff && res.status === 400) return { kind: "no_thinking" };
      return { kind: "skip", error };
    }
    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[];
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
    };
    const text = data.candidates?.[0]?.content?.parts?.filter((p) => !p.thought).map((p) => p.text ?? "").join("") ?? "";
    try {
      const parsed = schema.safeParse(JSON.parse(text));
      await log(parsed.success, data.usageMetadata, parsed.success ? undefined : "invalid_output");
      return { kind: "ok", value: parsed.success ? parsed.data : null };
    } catch {
      await log(false, data.usageMetadata, "invalid_json");
      return { kind: "ok", value: null };
    }
  };

  let busy = false;
  let lastError = "timeout";
  for (let i = 0; i < models.length; i += 1) {
    const remaining = deadline - Date.now();
    if (remaining < 1_500) {
      busy = true;
      break;
    }
    // oxirgi modelga qolgan hamma vaqt; oldingilariga — ko'pi bilan 60% (zaxira uchun vaqt qolsin)
    const slice = i === models.length - 1 ? remaining : Math.min(remaining, Math.max(4_000, Math.floor(remaining * 0.6)));
    let r = await attempt(models[i]!, slice, true);
    if (r.kind === "no_thinking") r = await attempt(models[i]!, Math.max(1_500, Math.min(slice, deadline - Date.now())), false);
    if (r.kind === "ok") return r.value;
    if (r.kind === "busy") busy = true;
    if (r.kind === "busy" || r.kind === "skip") lastError = r.error;
  }
  if (busy) throw new AiBusyError(`gemini ${lastError}`);
  throw new Error(`gemini ${lastError}`);
}

export interface GeminiProbeResult {
  model: string;
  ok: boolean;
  latencyMs: number;
  /** Qisqa xato matni (http_403: ..., timeout) */
  error: string | null;
}

/**
 * Admin uchun tekshiruv: har bir modelga kichik so'rov — kalit, kvota, model mavjudligi va tezlik ko'rinadi.
 * Kalit sozlanmagan bo'lsa — bo'sh ro'yxat.
 */
export async function geminiProbe(): Promise<GeminiProbeResult[]> {
  const env = getServerEnv();
  if (!env.GEMINI_API_KEY) return [];
  const apiKey = env.GEMINI_API_KEY;
  const models = [...new Set([env.GEMINI_MODEL || GEMINI_DEFAULT_MODEL, ...GEMINI_FALLBACK_MODELS])];
  const base = (env.GEMINI_BASE_URL ?? "https://generativelanguage.googleapis.com").replace(/\/$/, "");
  const call = async (model: string, thinkingOff: boolean) =>
    fetch(`${base}/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: 'Reply with JSON {"ok": true}' }] }],
        generationConfig: {
          temperature: 0, maxOutputTokens: 64, responseMimeType: "application/json",
          responseSchema: { type: "OBJECT", properties: { ok: { type: "BOOLEAN" } }, required: ["ok"] },
          ...(thinkingOff ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
        },
      }),
      signal: AbortSignal.timeout(20_000),
    });
  return Promise.all(
    models.map(async (model) => {
      const started = Date.now();
      let error: string | null = null;
      try {
        let res = await call(model, true);
        if (res.status === 400) res = await call(model, false);
        if (!res.ok) error = geminiErrorText(res.status, (await res.text()).slice(0, 600));
      } catch (e) {
        error = e instanceof Error ? e.message : "network";
      }
      const latencyMs = Date.now() - started;
      await logAiUsage({ feature: "ai_probe", provider: "gemini", model, ok: !error, latencyMs, error: error ?? undefined });
      return { model, ok: !error, latencyMs, error };
    }),
  );
}
