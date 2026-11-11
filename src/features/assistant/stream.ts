import type { AssistantEvent } from "./types";

/**
 * /api/assistant javobini o'qish: NDJSON oqimi (har qator — bitta hodisa). Qator va belgi (UTF-8) bo'laklar orasida
 * bo'linib kelishi mumkin — bufer bilan yig'iladi. Buzilgan yoki noma'lum qator jim tashlanadi (oqim to'xtamaydi).
 */
export async function readEvents(body: ReadableStream<Uint8Array>, onEvent: (event: AssistantEvent) => void): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  const feed = (line: string) => {
    const s = line.trim();
    if (!s) return;
    try {
      const e: unknown = JSON.parse(s);
      if (isEvent(e)) onEvent(e);
    } catch {
      // buzilgan qator — tashlanadi
    }
  };
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let i: number;
    while ((i = buf.indexOf("\n")) >= 0) {
      feed(buf.slice(0, i));
      buf = buf.slice(i + 1);
    }
  }
  feed(buf + decoder.decode());
}

const STAGES = new Set(["thinking", "searching"]);
const LANGS = new Set(["uz", "oz", "ru", "en"]);

function isEvent(e: unknown): e is AssistantEvent {
  if (!e || typeof e !== "object") return false;
  const o = e as Record<string, unknown>;
  switch (o.type) {
    case "status":
      return typeof o.stage === "string" && STAGES.has(o.stage);
    case "text":
      return typeof o.delta === "string";
    case "results": {
      const d = o.data as Record<string, unknown> | null;
      return !!d && typeof d === "object" && Array.isArray(d.jobs) && Array.isArray(d.workers) && typeof d.total === "number" && Array.isArray(d.understood);
    }
    case "suggestions":
      return Array.isArray(o.items) && o.items.every((x) => typeof x === "string");
    case "done":
      return (o.source === "ai" || o.source === "rules") && typeof o.lang === "string" && LANGS.has(o.lang);
    case "error":
      return typeof o.code === "string";
    default:
      return false;
  }
}
