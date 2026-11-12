import { describe, expect, it, vi } from "vitest";
import type { AiFindResult } from "@/features/find/ai-find-types";
import { runAssistant, sanitizeHistory, type EngineDeps, type FindFn, type LlmClient, type LlmMessage, type LlmParams, type StatsFn } from "./engine";
import type { MarketStats } from "./market-math";
import { isSearchRequest, isStatsQuestion, statsReply } from "./replies";
import { compactForModel, compactStatsForModel, parseToolCall } from "./tools";
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
  flags: { profession: true, filters: false },
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

  it("hol-ahvol ('nima gap', 'qalaysiz', 'как дела') — qidiruvsiz, suhbatdek javob; 'qanday ish bor' esa qidiruv", async () => {
    for (const text of ["nima gap", "Salom, nima gaplar?", "qalaysiz", "Қалайсиз?", "как дела?", "what's up"]) {
      const r = await run([user(text)], {});
      expect(r.find, text).not.toHaveBeenCalled();
      expect(r.text, text).not.toMatch(/tushunmadim|aniqlay olmadim|понял|tell which/i);
      expect(r.text, text).toMatch(/AI yordamchi|AI ёрдамчи|ИИ-помощник|AI assistant/);
    }
    const search = await run([user("qanday ish bor")], {});
    expect(search.find).toHaveBeenCalled();
  });

  it("AI'siz: 'menga mos ish toping' — kasb so'raladi (soxta qidiruv yo'q); maslahat savollari — amaliy yo'riqnoma (boshi berk emas)", async () => {
    for (const [text, role] of [["Menga mos ish toping", "seeker"], ["Vakansiyamga mos nomzod toping", "employer"], ["Найдите мне подходящую работу", "seeker"], ["Find me a suitable job", "seeker"]] as const) {
      const r = await run([user(text)], {}, role);
      expect(r.find, text).not.toHaveBeenCalled();
      expect(r.text, text).toMatch(/kasb|профессии|profession/i);
    }
    for (const [text, role, expected] of [
      ["Karyeramni rivojlantirish uchun nima qilishim kerak?", "seeker", /^Karyerani bosqichma-bosqich quramiz:\n1\./],
      ["Ish suhbatiga tayyorlanishga yordam bering", "seeker", /^Suhbatga tayyorgarlik — 6 qadam/],
      ["Rezyume yozishga yordam bering", "seeker", /^Rezyumeni 5 qismdan tuzing/],
      ["Nomzod uchun suhbat savollarini tuzing", "employer", /^Suhbat savollari \(istalgan lavozim uchun\)/],
      ["Vakansiya matnini tuzishga yordam bering", "employer", /^Yaxshi vakansiya matni/],
      ["Help me prepare for a job interview", "seeker", /^Interview preparation — 6 steps/],
      ["Помогите подготовиться к собеседованию", "seeker", /^Подготовка к собеседованию/],
      ["Резюме ёзишга ёрдам беринг", "seeker", /^Резюмени 5 қисмдан тузинг/],
    ] as const) {
      const r = await run([user(text)], {}, role);
      expect(r.find, text).not.toHaveBeenCalled();
      expect(r.text, text).toMatch(expected);
      // "AI ulanmagan" degan boshi berk javob yo'q; keyingi qadam tugmalari bor
      expect(r.text, text).not.toMatch(/ulanmagan|не подключ|not connected/i);
      expect((r.events.find((e) => e.type === "suggestions") as { items: string[] }).items.length, text).toBe(2);
    }
    // oddiy qidiruv o'zgarmaydi
    expect((await run([user("Toshkentda sotuvchi")], {})).find).toHaveBeenCalled();
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

  it("qisqa davom (faqat shart) oldingi xabarlar bilan birga qidiriladi — kasb topilguncha; tushunarsiz matn qo'shilmaydi", async () => {
    const find = vi.fn<FindFn>(async ({ text }) => ({ ok: true, data: result({ flags: { profession: text.includes("oshpaz"), filters: /Chilonzor|mln/.test(text) } }) }));
    await run([user("oshpaz kerak"), bot("Qaysi tumanda?"), user("Chilonzorda")], { find });
    expect(find.mock.calls.map((c) => c[0].text)).toEqual(["Chilonzorda", "oshpaz kerak Chilonzorda"]);
    // uchinchi xabar: bitta oldingisi yetmaydi — ikkitasi bilan
    find.mockClear();
    await run([user("oshpaz kerak"), bot("…"), user("Chilonzorda"), bot("…"), user("5 mln dan")], { find });
    expect(find.mock.calls.map((c) => c[0].text)).toEqual(["5 mln dan", "Chilonzorda 5 mln dan", "oshpaz kerak Chilonzorda 5 mln dan"]);
    // hech narsa tushunilmagan matn oldingisiga qo'shilmaydi
    find.mockClear();
    const r = await run([user("kunlik ish"), bot("…"), user("qwerty asdf")], {
      find: vi.fn<FindFn>(async () => ({ ok: true, data: result({ total: 0, jobs: [], needProfession: true, flags: { profession: false, filters: false } }) })),
    });
    expect(r.find).toHaveBeenCalledTimes(1);
    expect(r.text).toMatch(/tushunmadim|aniqlay olmadim/);
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
    expect(parseToolCall("seeker", "search_jobs", { query: "  oshpaz   Chilonzor " })).toEqual({ tool: "search", mode: "jobs", query: "oshpaz Chilonzor" });
    expect(parseToolCall("employer", "market_stats", { query: "sotuvchi" })).toBeNull(); // statistika ulanmagan
    expect(parseToolCall("employer", "market_stats", { query: "sotuvchi  Samarqand" }, true)).toEqual({ tool: "stats", query: "sotuvchi Samarqand" });
    expect(parseToolCall("seeker", "search_workers", { query: "oshpaz" })).toBeNull();
    expect(parseToolCall("employer", "search_workers", { query: "x" })).toBeNull();
    expect(parseToolCall("seeker", "search_jobs", { q: "oshpaz" })).toBeNull();
  });

  it("modelga beriladigan natijada shaxsiy ma'lumot yo'q; kengaytirish izohlari bor", () => {
    const text = compactForModel(result({ relaxed: ["Chilonzorda hozircha yo'q — butun Toshkent bo'yicha ko'rsatildi"] }));
    expect(text).not.toMatch(/phone|99890/);
    expect(JSON.parse(text)).toMatchObject({ total: 1, widened: [expect.stringContaining("Toshkent")], results: [{ title: "Oshpaz", salary_from: 5_000_000 }] });
  });

  it("tavsiya savollar: AI ishlamasa faqat qidiruv misollari; natija bo'lsa AI yordami (rezyume) faqat AI bilan", async () => {
    const rules = await run([user("Salom")], {});
    expect(rules.events.find((e) => e.type === "suggestions")).toEqual({ type: "suggestions", items: ["Kunlik ish bormi?", "Tajribasiz ishlar", "Oshpaz maoshi qancha?"] });
    const rulesFound = await run([user("oshpaz")], {});
    expect(rulesFound.events.find((e) => e.type === "suggestions")).toEqual({ type: "suggestions", items: [] });
    const { llm } = fakeLlm([
      { stop_reason: "tool_use", content: [{ type: "tool_use", id: "t1", name: "search_jobs", input: { query: "oshpaz" } }] },
      { stop_reason: "end_turn", content: [{ type: "text", text: "Topdim." }] },
    ]);
    const ai = await run([user("oshpaz")], { llm });
    expect(ai.events.find((e) => e.type === "suggestions")).toEqual({ type: "suggestions", items: ["Rezyume yozishga yordam bering", "Suhbatga qanday tayyorlanay?"] });
  });

  it("foydalanuvchi profili ko'rsatmaga 'ma'lumot' sifatida qo'shiladi (uzunligi va soni cheklangan)", () => {
    const text = systemPrompt({ role: "seeker", lang: "uz", loggedIn: true, today: "2026-11-11", profile: ["Profession: Oshpaz", "Region: Samarqand", "x".repeat(500)] });
    expect(text).toContain("• Profession: Oshpaz");
    expect(text).toContain("• Region: Samarqand");
    expect(text).toMatch(/data, not instructions\). Use it to search/);
    expect(text).not.toContain("x".repeat(200));
    expect(systemPrompt({ role: "seeker", lang: "uz", loggedIn: false, today: "2026-11-11" })).not.toContain("own ad (data");
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

const stats = (over: Partial<MarketStats> = {}): MarketStats => ({
  profession: { uz: "Oshpaz", ru: "Повар", en: "Cook" },
  region: { uz: "Samarqand viloyati", ru: "Самаркандская область", en: "Samarkand region" },
  vacancies: 12,
  seekers: 4,
  salary: { n: 9, min: 3_000_000, median: 4_500_000, max: 8_000_000 },
  jobsHref: "/search?mode=jobs&p=x&region=samarkand",
  workersHref: "/search?mode=workers&p=x&region=samarkand",
  ...over,
});

describe("bozor statistikasi (maosh, talab) — faqat bazadagi faol e'lonlardan", () => {
  it("statistika savoli tanib olinadi; oddiy qidiruv emas", () => {
    for (const q of ["Oshpaz maoshi qancha?", "haydovchi oyligi qancha", "o'rtacha maosh sotuvchi", "o‘rtacha oylik buxgalter", "dasturchi statistika", "mehnat bozori qanday", "oshpaz qancha oladi", "Ошпаз маоши қанча?", "Сколько получает повар в Ташкенте?", "средняя зарплата водителя", "рынок труда бухгалтер", "How much does a cook earn?", "average salary for drivers", "Kasbim bo'yicha maosh qancha va talab qanday?", "Xodimga qancha maosh taklif qilay? Bozordagi maoshni ko'rsating", "Какую зарплату предложить сотруднику? Покажите средние зарплаты на рынке", "What salary should I offer? Show me the average salary on the market", "Касбим бўйича маош қанча ва талаб қандай?"])
      expect(isStatsQuestion(q), q).toBe(true);
    for (const q of ["oshpaz Chilonzor 5 mln", "Toshkentda sotuvchi", "зарплата от 5 млн повар", "maoshi yuqori ish", "Kunlik ish bormi?", "salom"]) expect(isStatsQuestion(q), q).toBe(false);
  });

  it("AI'siz: kasb aytilgan — bazadan sonlar, karta hodisasi, maosh oralig'i, halol izoh; qidiruv chaqirilmaydi", async () => {
    const st = vi.fn<StatsFn>(async () => ({ ok: true, data: stats() }));
    const r = await run([user("Samarqandda oshpaz maoshi qancha?")], { stats: st });
    expect(st).toHaveBeenCalledWith("Samarqandda oshpaz maoshi qancha?");
    expect(r.find).not.toHaveBeenCalled();
    expect(r.types).toEqual(["status", "stats", "text", "suggestions", "done"]);
    expect(r.text).toContain("Oshpaz — Samarqand viloyati:");
    expect(r.text).toContain("Faol vakansiyalar: 12 ta");
    expect(r.text).toContain("Ish izlovchilar e'lonlari: 4 ta");
    expect(r.text).toContain("Oylik maosh (9 ta e'londa): 3 mln so'm – 8 mln so'm, o'rtasi 4,5 mln so'm");
    expect(r.text).toContain("talab yaxshi");
    expect(r.text).toContain("butun mehnat bozori emas");
    expect(r.events.find((e) => e.type === "suggestions")).toEqual({ type: "suggestions", items: ["Oshpaz bo'yicha ishlar Samarqand viloyati", "Rezyume qanday yoziladi?"] });
  });

  it("AI'siz: kasb yo'q — oldingi xabar bilan birga; baribir yo'q — kasb misol bilan so'raladi", async () => {
    const st = vi.fn<StatsFn>(async (t) => ({ ok: true, data: /oshpaz/i.test(t) ? stats({ region: null }) : null }));
    const follow = await run([user("oshpaz maoshi qancha"), bot("…"), user("Samarqandda-chi?")], { stats: st });
    expect(st).toHaveBeenLastCalledWith("Samarqandda-chi? oshpaz maoshi qancha");
    expect(follow.text).toContain("Oshpaz — butun O'zbekiston:");
    const ask = await run([user("statistika")], { stats: vi.fn<StatsFn>(async () => ({ ok: true, data: null })) });
    expect(ask.text).toMatch(/^Qaysi kasb bo'yicha ko'raylik\?/);
    // faqat so'roq (kasb ham, joy ham yo'q) — oldingi suhbat kasbi takrorlanmaydi, kasb so'raladi
    const again = vi.fn<StatsFn>(async (t) => ({ ok: true, data: /oshpaz/i.test(t) ? stats() : null }));
    const askAgain = await run([user("oshpaz maoshi qancha"), bot("…"), user("statistika")], { stats: again });
    expect(again).toHaveBeenCalledTimes(1);
    expect(askAgain.text).toMatch(/^Qaysi kasb bo'yicha ko'raylik\?/);
    expect(ask.find).not.toHaveBeenCalled();
    const failed = await run([user("oshpaz maoshi qancha")], { stats: vi.fn<StatsFn>(async () => ({ ok: false })) });
    expect(failed.events.at(-1)).toEqual({ type: "error", code: "search_failed" });
  });

  it("namuna kichik bo'lsa — xulosa va o'ylab topilgan maosh yo'q; ruscha, inglizcha va kirillda", () => {
    const small = statsReply(stats({ vacancies: 2, seekers: 1, salary: null, region: null }), "uz", "seeker");
    expect(small).toContain("kamida 3 ta kerak");
    expect(small).not.toMatch(/talab yaxshi|teng|ko'p —/);
    expect(statsReply(stats(), "ru", "employer")).toContain("Зарплата в месяц (по 9 объявл.): 3 млн сум – 8 млн сум, середина 4,5 млн сум");
    expect(statsReply(stats(), "ru", "employer")).toContain("Кандидатов меньше");
    expect(statsReply(stats(), "en", "seeker")).toContain("Cook — Samarkand region:");
    expect(statsReply(stats(), "en", "seeker")).toContain("4.5M UZS");
    expect(statsReply(stats(), "oz", "seeker")).toContain("Ошпаз — Самарқанд вилояти:");
    expect(statsReply(stats({ vacancies: 0, seekers: 0, salary: null }), "uz", "seeker")).toContain("hozircha faol e'lon yo'q");
  });

  it("AI bilan: model market_stats asbobini chaqiradi → karta hodisasi va sonlar modelga (ixcham, shaxsiy ma'lumotsiz)", async () => {
    const { llm, calls } = fakeLlm([
      { stop_reason: "tool_use", content: [{ type: "tool_use", id: "s1", name: "market_stats", input: { query: "oshpaz Samarqand" } }] },
      { stop_reason: "end_turn", content: [{ type: "text", text: "Samarqandda oshpazga talab yaxshi." }] },
    ]);
    const st = vi.fn<StatsFn>(async () => ({ ok: true, data: stats() }));
    const r = await run([user("Samarqandda oshpaz bo'lsam qancha topaman?")], { llm, stats: st });
    expect(calls[0]!.tools.map((t) => t.name)).toEqual(["search_jobs", "market_stats"]);
    expect(st).toHaveBeenCalledWith("oshpaz Samarqand");
    expect(r.types).toContain("stats");
    const toolResult = (calls[1]!.messages.at(-1)!.content as Array<{ content: string }>)[0]!.content;
    expect(JSON.parse(toolResult)).toMatchObject({ active_vacancies: 12, job_seeker_ads: 4, monthly_salary_uzs: { median: 4_500_000 } });
    expect(r.events.find((e) => e.type === "suggestions")).toEqual({ type: "suggestions", items: ["Oshpaz bo'yicha ishlar Samarqand viloyati", "Rezyume qanday yoziladi?"] });
    // statistika ulanmagan — asbob berilmaydi
    const { llm: llm2, calls: calls2 } = fakeLlm([{ stop_reason: "end_turn", content: [{ type: "text", text: "Salom." }] }]);
    await run([user("salom")], { llm: llm2 });
    expect(calls2[0]!.tools.map((t) => t.name)).toEqual(["search_jobs"]);
    expect(JSON.parse(compactStatsForModel(null))).toMatchObject({ profession_unclear: true });
  });
});

const demoCard = (slug: string, title: string) =>
  ({ id: slug, slug, title_uz: title, title_ru: null, title_en: null, category_slug: "talim", category_icon: null, profession_node_id: "n-avto", region_name_uz: "Xorazm viloyati", region_name_ru: null, region_name_en: null, region_name_oz: null, district_name_uz: null, district_name_ru: null, district_name_en: null, district_name_oz: null, lat: null, lng: null, is_remote: false, salary_from: 3_500_000, salary_to: 8_000_000, salary_type: "monthly", salary_negotiable: false, schedule: "5_2", employment_type: "full_time", experience_min_months: 12 }) as NonNullable<AiFindResult["demos"]>["items"][number];

describe("namuna e'lonlar va statistikadan keyingi qidiruv", () => {
  it("statistika savolidan keyin 'avto instruktor kerak' — yangi qidiruv (statistika emas)", async () => {
    expect(isSearchRequest("avto instruktor kerak")).toBe(true);
    expect(isSearchRequest("нужен повар")).toBe(true);
    expect(isSearchRequest("buxgalter")).toBe(false);
    expect(isSearchRequest("Samarqandda-chi?")).toBe(false);
    const st = vi.fn<StatsFn>(async () => ({ ok: true, data: null }));
    const r = await run([user("Kasbim bo'yicha maosh qancha va talab qanday?"), bot("Qaysi kasb bo'yicha ko'raylik?"), user("avto instruktor kerak")], { stats: st });
    expect(st).not.toHaveBeenCalled();
    expect(r.find).toHaveBeenCalledWith({ text: "avto instruktor kerak", mode: "jobs", ai: true });
    expect(r.types).toContain("results");
    // qisqa javob (kasb nomi) — hali ham statistikaning davomi
    const st2 = vi.fn<StatsFn>(async () => ({ ok: true, data: stats({ region: null }) }));
    const r2 = await run([user("Kasbim bo'yicha maosh qancha va talab qanday?"), bot("Qaysi kasb bo'yicha ko'raylik?"), user("oshpaz")], { stats: st2 });
    expect(st2).toHaveBeenCalledWith("oshpaz");
    expect(r2.find).not.toHaveBeenCalled();
  });

  it("haqiqiy e'lon 0, namunalar bor — javobda ochiq aytiladi (haqiqiy deb ko'rsatilmaydi), modelga ham shunday", async () => {
    const empty = result({ jobs: [], total: 0, demos: { items: [demoCard("namuna-talim-1", "Avtoinstruktor")], exact: true, href: "/jobs/namuna?soha=talim" } });
    const r = await run([user("avto instruktor kerak")], { find: vi.fn<FindFn>(async () => ({ ok: true, data: empty })) });
    expect(r.text).toContain("Haqiqiy e'lon hozircha yo'q. Quyida shu kasb bo'yicha namuna e'lonlar — ular haqiqiy emas");
    const ru = await run([user("нужен автоинструктор")], { find: vi.fn<FindFn>(async () => ({ ok: true, data: { ...empty, demos: { ...empty.demos!, exact: false } } })) });
    expect(ru.text).toContain("Ниже — образцы из этой сферы: они не настоящие");
    const model = JSON.parse(compactForModel(empty));
    expect(model).toMatchObject({ total: 0, sample_ads_shown: 1 });
    expect(model.sample_ads_note).toContain("not real jobs");
    // haqiqiy natija bor — namuna eslatilmaydi
    expect(JSON.parse(compactForModel(result({ demos: empty.demos }))).sample_ads_shown).toBeUndefined();
    // statistika: namunalar alohida qatorda, sonlarga qo'shilmaydi
    const text = statsReply(stats({ vacancies: 0, seekers: 0, salary: null, demos: 1 }), "uz", "seeker");
    expect(text).toContain("Faol vakansiyalar: 0 ta");
    expect(text).toContain("Namuna e'lonlar: 1 ta — ular haqiqiy emas");
    expect(statsReply(stats({ demos: 2 }), "uz", "seeker")).not.toContain("Namuna");
  });
});
