import { describe, expect, it } from "vitest";
import { readEvents } from "./stream";
import { pickVoice, speakable } from "./speech";
import type { AssistantEvent } from "./types";

function streamOf(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(c) {
      for (const ch of chunks) c.enqueue(ch);
      c.close();
    },
  });
}

describe("readEvents — NDJSON oqimi", () => {
  it("qator va UTF-8 belgi bo'laklar orasida bo'linsa ham to'g'ri yig'iladi; buzilgan qator tashlanadi", async () => {
    const text =
      [
        JSON.stringify({ type: "status", stage: "thinking" }),
        JSON.stringify({ type: "text", delta: "Ассалому алайкум — " }),
        "{buzilgan",
        JSON.stringify({ type: "noma'lum" }),
        JSON.stringify({ type: "text", delta: "o'zbekcha ✓" }),
        JSON.stringify({ type: "suggestions", items: ["Kunlik ish bormi?"] }),
        JSON.stringify({ type: "done", source: "rules", lang: "oz" }),
      ].join("\n") + "\n";
    const bytes = new TextEncoder().encode(text);
    // 7 baytli bo'laklar: ko'p baytli belgilar o'rtasidan ham kesiladi
    const chunks: Uint8Array[] = [];
    for (let i = 0; i < bytes.length; i += 7) chunks.push(bytes.slice(i, i + 7));
    const events: AssistantEvent[] = [];
    await readEvents(streamOf(chunks), (e) => events.push(e));
    expect(events.map((e) => e.type)).toEqual(["status", "text", "text", "suggestions", "done"]);
    expect(events.filter((e) => e.type === "text").map((e) => (e as { delta: string }).delta).join("")).toBe("Ассалому алайкум — o'zbekcha ✓");
  });

  it("oxirgi qator yangi qatorsiz tugasa ham o'qiladi; noto'g'ri shakldagi hodisa o'tmaydi", async () => {
    const text = `${JSON.stringify({ type: "results", data: { jobs: "x" } })}\n${JSON.stringify({ type: "error", code: "timeout" })}`;
    const events: AssistantEvent[] = [];
    await readEvents(streamOf([new TextEncoder().encode(text)]), (e) => events.push(e));
    expect(events).toEqual([{ type: "error", code: "timeout" }]);
  });
});

describe("ovoz bilan o'qish", () => {
  const voices = [
    { lang: "en-US", name: "English", default: true },
    { lang: "ru-RU", name: "Russian" },
    { lang: "ru_RU", name: "Russian local", localService: true },
    { lang: "tr-TR", name: "Turkish" },
  ];
  it("til bo'yicha ovoz; o'zbekcha ovoz yo'q bo'lsa lotin matn o'qilmaydi, kirill — ruscha ovoz bilan", () => {
    expect(pickVoice(voices, "en")?.name).toBe("English");
    expect(pickVoice(voices, "ru")?.name).toBe("Russian local");
    expect(pickVoice(voices, "uz")).toBeNull();
    expect(pickVoice(voices, "oz")?.name).toBe("Russian local");
    expect(pickVoice([...voices, { lang: "uz-UZ", name: "Madina" }], "uz")?.name).toBe("Madina");
    expect(pickVoice([...voices, { lang: "uz-UZ", name: "Madina" }], "oz")?.name).toBe("Madina");
    expect(pickVoice([], "ru")).toBeNull();
  });
  it("o'qiladigan matn: belgilar va havolalar olib tashlanadi, uzun matn gap chegarasida kesiladi", () => {
    expect(speakable("**Oshpaz** kerak:\n- tajriba 1 yil\n- https://ishuz.vercel.app/jobs/x smena")).toBe("Oshpaz kerak: tajriba 1 yil smena");
    const long = `${"Bu birinchi gap. ".repeat(60)}Oxiri`;
    const out = speakable(long);
    expect(out.length).toBeLessThanOrEqual(700);
    expect(out.endsWith(".")).toBe(true);
  });
});
