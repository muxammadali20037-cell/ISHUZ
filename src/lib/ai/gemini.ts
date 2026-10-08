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

export async function geminiJson<T extends z.ZodType>(schema: T, system: string, userText: string, opts: AiCallOptions = {}): Promise<z.infer<T> | null> {
  const env = getServerEnv();
  if (!env.GEMINI_API_KEY) return null;
  const model = env.GEMINI_MODEL || GEMINI_DEFAULT_MODEL;
  const base = (env.GEMINI_BASE_URL ?? "https://generativelanguage.googleapis.com").replace(/\/$/, "");
  const started = Date.now();
  const feature = opts.feature ?? "other";
  const images = opts.images ?? [];
  const log = (ok: boolean, usage?: { promptTokenCount?: number; candidatesTokenCount?: number }, error?: string) =>
    logAiUsage({
      feature, provider: "gemini", model, ok, latencyMs: Date.now() - started,
      inputTokens: usage?.promptTokenCount ?? null, outputTokens: usage?.candidatesTokenCount ?? null, images: images.length, error,
    });
  let res: Response;
  try {
    res = await fetch(`${base}/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [...images.map((im) => ({ inlineData: { mimeType: im.mimeType, data: im.data } })), { text: userText }] }],
        generationConfig: {
          temperature: opts.temperature ?? 0.2,
          maxOutputTokens: opts.maxOutputTokens ?? 8192,
          responseMimeType: "application/json",
          responseSchema: toGeminiSchema(z.toJSONSchema(schema) as JsonSchema),
        },
      }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 90_000),
    });
  } catch (e) {
    await log(false, undefined, e instanceof Error ? e.message : "network");
    throw e;
  }
  if (res.status === 429 || res.status === 503) {
    await log(false, undefined, `http_${res.status}`);
    throw new AiBusyError(`gemini ${res.status}`);
  }
  if (!res.ok) {
    const body = (await res.text()).slice(0, 300);
    await log(false, undefined, `http_${res.status}`);
    throw new Error(`gemini ${res.status}: ${body}`);
  }
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  };
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  try {
    const parsed = schema.safeParse(JSON.parse(text));
    await log(parsed.success, data.usageMetadata, parsed.success ? undefined : "invalid_output");
    return parsed.success ? parsed.data : null;
  } catch {
    await log(false, data.usageMetadata, "invalid_json");
    return null;
  }
}
