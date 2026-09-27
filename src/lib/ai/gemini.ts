import "server-only";

import { z } from "zod";
import { getServerEnv } from "@/lib/env";

/**
 * Google Gemini (REST, generateContent) — bepul limitli AI. Javob JSON sxema bo'yicha (responseSchema),
 * so'ng zod bilan qayta tekshiriladi: sxemadan chiqsa null.
 */
export const GEMINI_DEFAULT_MODEL = "gemini-flash-latest";

export class AiBusyError extends Error {}

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

export async function geminiJson<T extends z.ZodType>(schema: T, system: string, userText: string): Promise<z.infer<T> | null> {
  const env = getServerEnv();
  if (!env.GEMINI_API_KEY) return null;
  const model = env.GEMINI_MODEL || GEMINI_DEFAULT_MODEL;
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: userText }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 8192,
        responseMimeType: "application/json",
        responseSchema: toGeminiSchema(z.toJSONSchema(schema) as JsonSchema),
      },
    }),
    signal: AbortSignal.timeout(90_000),
  });
  if (res.status === 429 || res.status === 503) throw new AiBusyError(`gemini ${res.status}`);
  if (!res.ok) throw new Error(`gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  try {
    const parsed = schema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
