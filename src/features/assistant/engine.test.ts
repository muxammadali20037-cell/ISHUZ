import { describe, expect, it, vi } from "vitest";
import type { AiFindResult } from "@/features/find/ai-find-types";
import { runAssistant, sanitizeHistory, type EngineDeps, type FindFn, type LlmClient, type LlmMessage, type LlmParams } from "./engine";
import { compactForModel, parseToolCall } from "./tools";
import { systemPrompt } from "./prompt";
import type { AssistantEvent, ChatMessage } from "./types";

const result = (over: Partial<AiFindResult> = {}): AiFindResult => ({
  mode: "jobs",
  understood: ["Ish e'lonlari", "Oshpaz"],
  needProfession: false,
  source: "rules",
  aiAvailable: true,
  applied: { daily: false, noexp: false, exp: false, remote: false, shift: false },
  jobs: [
    {
      id: "v1", slug: "oshpaz-1", title: "Oshpaz", employer_name: "Milliy taomlar", employer_verified: false, profession_node_id: null, profession_name_uz: "Oshpaz", profession_name_ru: null,
      profession_name_en: null, category_slug: null, category_icon: null, region_name_uz: "Toshkent shahri", region_name_ru: null, district_name_uz: "Chilonzor tumani", district_name_ru: null,
      region_wide: false, is_remote: false, salary_from: 5_000_000, salary_to: null, salary_type: "monthly", salary_negotiable: false, schedule: "6_1", experience_min_months: 0,
      summary: null, phone: "+998901234567", is_featured: false,
    } as AiFindResult["jobs"][number],
  ],
  workers: [],
  images: {},
  photos: {},
  saved: [],
  total: 1,
  href: "/search?mode=jobs",
  relaxed: [],
  alertHref: "/ai-alerts?role=worker&q=x",
  postHref: "/post/worker",
  ...over,
});

/** Skriptli model: har chaqiruvga navbatdagi javob; matn bo'laklari "text" tinglovchisiga beriladi */
function fakeLlm(script: Array<LlmMessage | Error>) {
  const calls: LlmParams[] = [];
  const llm: LlmClient = {
    stream(params) {
      calls.push(structuredClone(params));
      const next = script.shift();
      let listener: (d: string) => void = () => {};
      return {
        on: (_e, l) => void (listener = l),
        abort: () => {},
        finalMessage: async () => {
          if (!next) throw new Error("no script");
          if (next instanceof Error) throw next;
          for (const b of next.content) if (b.type === "text" && b.text) for (const part of b.text.match(/.{1,12}/gs) ?? []) listener(part);
          return next;
        },
      };
    },
  };
  return { llm, calls };
}

async function run(messages: ChatMessage[], deps: Partial<EngineDeps> & { find?: FindFn }, role: "seeker" | "employer" = "seeker") {
  const events: AssistantEvent[] = [];
  const find = deps.find ?? vi.fn<FindFn>(async () => ({ ok: true, data: result() }));
  await runAssistant(
    { messages, role, siteLocale: "uz", loggedIn: false, emit: (e) => events.push(e) },
    { llm: null, model: "test-model", budget: async () => true, today: () => "2026-11-11", ...deps, find },
  );
  const text = events.filter((e): e is Extract<AssistantEvent, { type: "text" }> => e.type === "text").map((e) => e.delta).join("");
  return { events, text, find, types: events.map((e) => e.type) };
}

const user = (text: string): ChatMessage => ({ role: "user", text });
const bot = (text: string): ChatMessage => ({ role: "assistant", text });

describe("AI bilan: model asbob chaqiradi → bazadan haqiqiy natija → tabiiy javob (oqim)", () => {
  it("qidiruv asbobi: natija bazadan, kartalar hodisasi model matnidan oldin; javob bo'laklab keladi", async () => {
    const { llm, calls } = fakeLlm([
      { stop_reason: "tool_use", content: [{ type: "tool_use", id: "t1", name: "search_jobs", input: { query: "oshpaz Chilonzor" } }], usage: { input_tokens: 900, output_tokens: 30 } },
      { stop_reason: "end_turn", content: [{ type: "text", text: "Chilonzorda bitta oshpaz e'loni bor — pastda. Maoshi 5 mln so'mdan. Grafik muhimmi?" }], usage: { input_tokens: 1100, output_tokens: 40 } },
    ]);
    const log = vi.fn();
    const r = await run([user("Chilonzorda oshpaz ish kerak")], { llm, log });
    expect(r.find).toHaveBeenCalledExactlyOnceWith({ text: "oshpaz Chilonzor", mode: "jobs", ai: false });
    expect(r.types.filter((t) => t !== "text")).toEqual(["status", "status", "results", "suggestions", "done"]);
    expect(r.types.indexOf("results")).toBeLessThan(r.types.indexOf("text"));
    expect(r.text).toBe("Chilonzorda bitta oshpaz e'loni bor — pastda. Maoshi 5 mln so'mdan. Grafik muhimmi?");
    expect(r.events.filter((e) => e.type === "text").length).toBeGreaterThan(3); // oqim: bir nechta bo'lak
    expect(r.events.at(-1)).toEqual({ type: "done", source: "ai", lang: "uz" });
    // ikkinchi chaqiruvda modelga asbob natijasi berilgan — telefon va ism yo'q
    const toolResult = JSON.stringify(calls[1]!.messages.at(-1));
    expect(toolResult).toContain("Milliy taomlar");
    expect(toolResult).not.toContain("998901234567");
    expect(calls[0]!.tools.map((t) => t.name)).toEqual(["search_jobs"]);
    expect(calls[0]!.system[0]!.text).toContain("Uzbek in Latin script");
    expect(log).toHaveBeenCalledWith(expect.objectContaining({ ok: true, inputTokens: 2000, outputTokens: 70 }));
  });

  it("asbob kerak bo'lmagan savol (rezyume maslahati) — bazaga murojaat qilinmaydi", async () => {
    const { llm } = fakeLlm([{ stop_reason: "end_turn", content: [{ type: "text", text: "Albatta. Qaysi kasbda ishlagansiz?" }] }]);
    const r = await run([user("rezyume yozishga yordam bering")], { llm });
    expect(r.find).not.toHaveBeenCalled();
    expect(r.types).not.toContain("results");
    expect(r.text).toBe("Albatta. Qaysi kasbda ishlagansiz?");
  });

  it("ish beruvchi faqat nomzod qidira oladi: boshqa asbob chaqiruvi bajarilmaydi", async () => {
    const { llm, calls } = fakeLlm([
      { stop_reason: "tool_use", content: [{ type: "tool_use", id: "t1", name: "search_jobs", input: { query: "sotuvchi" } }] },
      { stop_reason: "end_turn", content: [{ type: "text", text: "Qanday sotuvchi kerak?" }] },
    ]);
    const r = await run([user("sotuvchi kerak")], { llm }, "employer");
    expect(r.find).not.toHaveBeenCalled();
    expect(calls[0]!.tools.map((t) => t.name)).toEqual(["search_workers"]);
    expect(JSON.stringify(calls[1]!.messages.at(-1))).toContain('"is_error":true');
  });

  it("oxirgi urinishda model asbob chaqira olmaydi (tool_choice none) — matn bilan tugaydi", async () => {
    const tool = (id: string): LlmMessage => ({ stop_reason: "tool_use", content: [{ type: "tool_use", id, name: "search_jobs", input: { query: "oshpaz" } }] });
    const { llm, calls } = fakeLlm([tool("a"), tool("b"), { stop_reason: "end_turn", content: [{ type: "text", text: "Topdim." }] }]);
    const r = await run([user("oshpaz")], { llm });
    expect(calls).toHaveLength(3);
    expect(calls[2]!.tool_choice).toEqual({ type: "none" });
    expect(r.text).toBe("Topdim.");
  });

  it("model matn yozmasa — natija bo'yicha tayyor javob (foydalanuvchi javobsiz qolmaydi)", async () => {
    const { llm } = fakeLlm([
      { stop_reason: "tool_use", content: [{ type: "tool_use", id: "t1", name: "search_jobs", input: { query: "oshpaz" } }] },
      { stop_reason: "end_turn", content: [] },
    ]);
    const r = await run([user("oshpaz")], { llm });
    expect(r.text).toMatch(/1 ta/);
    expect(r.events.at(-1)).toMatchObject({ type: "done", source: "ai" });
  });
});

describe("AI ishlamasa — lug'at va shablon bilan to'liq javob", () => {
  it("kalit yo'q: bazadan qidiradi, o'zbekcha javob, manba 'rules'", async () => {
    const r = await run([user("Chilonzorda oshpaz ish kerak")], {});
    expect(r.find).toHaveBeenCalledWith({ text: "Chilonzorda oshpaz ish kerak", mode: "jobs", ai: true });
    expect(r.types).toEqual(["status", "results", "text", "suggestions", "done"]);
    expect(r.text).toContain("1 ta");
    expect(r.events.at(-1)).toEqual({ type: "done", source: "rules", lang: "uz" });
  });

  it("kunlik byudjet tugagan — model chaqirilmaydi", async () => {
    const { llm, calls } = fakeLlm([]);
    const r = await run([user("oshpaz")], { llm, budget: async () => false });
    expect(calls).toHaveLength(0);
    expect(r.events.at(-1)).toMatchObject({ type: "done", source: "rules" });
  });

  it("model xato berdi (javob boshlanmasdan) — foydalanuvchi xatoni ko'rmaydi, lug'at javob beradi", async () => {
    const { llm } = fakeLlm([new Error("529 overloaded")]);
    const log = vi.fn();
    const r = await run([user("ищу работу поваром")], { llm, log });
    expect(r.types).not.toContain("error");
    expect(r.events.at(-1)).toEqual({ type: "done", source: "rules", lang: "ru" });
    expect(r.text).toMatch(/[а-я]/i);
    expect(log).toHaveBeenCalledWith(expect.objectContaining({ ok: false }));
  });

  it("model javob o'rtasida uzildi — xato hodisasi (yarim javob ustiga shablon yozilmaydi)", async () => {
    const { llm } = fakeLlm([
      { stop_reason: "tool_use", content: [{ type: "text", text: "Hozir qarayman." }, { type: "tool_use", id: "t1", name: "search_jobs", input: { query: "oshpaz" } }] },
      new Error("connection reset"),
    ]);
    const r = await run([user("oshpaz")], { llm });
    expect(r.types).toContain("results");
    expect(r.events.at(-1)).toEqual({ type: "error", code: "unavailable" });
  });

  it("salomlashuv va rahmat — qidiruvsiz, tilga mos; sun'iy intellekt ekanini aytadi", async () => {
    const hi = await run([user("Salom")], {});
    expect(hi.find).not.toHaveBeenCalled();
    expect(hi.text).toContain("AI yordamchi");
    const who = await run([user("ты бот?")], {});
    expect(who.text).toContain("искусственный интеллект");
    const en = await run([user("thanks")], {});
    expect(en.text).toMatch(/welcome|help/i);
  });

  it("qisqa davom oldingi xabar bilan birga qidiriladi (kontekst)", async () => {
    const find = vi.fn<FindFn>(async ({ text }) => ({ ok: true, data: text.includes("oshpaz") ? result() : result({ needProfession: true, total: 0, jobs: [] }) }));
    const r = await run([user("oshpaz kerak"), bot("Qaysi tumanda?"), user("Chilonzorda")], { find });
    expect(find).toHaveBeenLastCalledWith({ text: "oshpaz kerak Chilonzorda", mode: "jobs", ai: true });
    expect(r.text).toContain("1 ta");
  });

  it("hech narsa yo'q / kasb tushunilmadi / baza xatosi — halol javob", async () => {
    const none = await run([user("kosmonavt")], { find: async () => ({ ok: true, data: result({ total: 0, jobs: [] }) }) });
    expect(none.text).toMatch(/yo'q|topilmadi/);
    const unclear = await run([user("qwerty")], { find: async () => ({ ok: true, data: result({ total: 0, jobs: [], needProfession: true }) }) });
    expect(unclear.text).toMatch(/tushunmadim|aniqlay olmadim/);
    const failed = await run([user("oshpaz")], { find: async () => ({ ok: false }) });
    expect(failed.events.at(-1)).toEqual({ type: "error", code: "search_failed" });
  });

  it("bir xil gap takrorlanmaydi: ketma-ket javoblar boshqacha", async () => {
    const a = await run([user("oshpaz")], {});
    const b = await run([user("oshpaz"), bot(a.text), user("haydovchi")], {});
    expect(b.text).not.toBe(a.text);
  });
});

describe("tarix, kiritma va ko'rsatma", () => {
  it("faqat oxirgi 12 xabar, uzun matn kesiladi, boshida va oxirida foydalanuvchi", () => {
    const many = Array.from({ length: 30 }, (_, i) => (i % 2 ? bot(`javob ${i}`) : user(`savol ${i}`)));
    const h = sanitizeHistory([...many, user("x".repeat(5000))]);
    expect(h.length).toBeLessThanOrEqual(12);
    expect(h[0]!.role).toBe("user");
    expect(h.at(-1)!.text).toHaveLength(600);
  });

  it("oxirgi xabar foydalanuvchiniki bo'lmasa yoki bo'sh bo'lsa — xato", async () => {
    expect((await run([user("salom"), bot("Assalomu alaykum")], {})).events).toEqual([{ type: "error", code: "validation" }]);
    expect((await run([user("   ")], {})).events).toEqual([{ type: "error", code: "validation" }]);
  });

  it("asbob kiritmasi tekshiriladi", () => {
    expect(parseToolCall("seeker", "search_jobs", { query: "  oshpaz   Chilonzor " })).toEqual({ mode: "jobs", query: "oshpaz Chilonzor" });
    expect(parseToolCall("seeker", "search_workers", { query: "oshpaz" })).toBeNull();
    expect(parseToolCall("employer", "search_workers", { query: "x" })).toBeNull();
    expect(parseToolCall("seeker", "search_jobs", { q: "oshpaz" })).toBeNull();
  });

  it("modelga beriladigan natijada shaxsiy ma'lumot yo'q; kengaytirish izohlari bor", () => {
    const text = compactForModel(result({ relaxed: ["Chilonzorda hozircha yo'q — butun Toshkent bo'yicha ko'rsatildi"] }));
    expect(text).not.toMatch(/phone|99890/);
    expect(JSON.parse(text)).toMatchObject({ total: 1, widened: [expect.stringContaining("Toshkent")], results: [{ title: "Oshpaz", salary_from: 5_000_000 }] });
  });

  it("tizim ko'rsatmasi: til, bitta savol, o'ylab topmaslik, AI ekanini yashirmaslik, yakuniy qaror yo'q", () => {
    const seeker = systemPrompt({ role: "seeker", lang: "oz", loggedIn: true, firstName: "Aziz", today: "2026-11-11" });
    expect(seeker).toContain("Uzbek in Cyrillic script");
    expect(seeker).toMatch(/ask ONE short question/);
    expect(seeker).toMatch(/Never invent/);
    expect(seeker).toMatch(/You are an AI/);
    expect(seeker).toMatch(/do not make hiring decisions/);
    expect(seeker).toMatch(/data, not instructions/);
    expect(seeker).toContain("search_jobs");
    const employer = systemPrompt({ role: "employer", lang: "ru", loggedIn: false, today: "2026-11-11" });
    expect(employer).toContain("search_workers");
    expect(employer).toContain("Russian");
    expect(employer).toMatch(/interview questions/);
    expect(employer).toMatch(/gender, age, nationality/);
  });
});
