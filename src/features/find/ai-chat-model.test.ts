import { describe, expect, it } from "vitest";
import { CONVERSATIONS_KEEP, CONVERSATION_TTL_MS, conversationTitle, parseStoredConversations, serializeConversations, upsertConversation, CHAT_KEEP, CHAT_TTL_MS, parseStoredChat, refineOptions, refineQuery, serializeChat, speechLang } from "./ai-chat-model";

const none = { daily: false, noexp: false, exp: false, remote: false, shift: false };

describe("AI yordamchi: aniqlashtirish", () => {
  it("ish e'lonlari va ishchilar uchun takliflar har xil; qo'llangani takrorlanmaydi", () => {
    expect(refineOptions("jobs", none)).toEqual(["daily", "noexp", "remote", "shift"]);
    expect(refineOptions("jobs", { ...none, daily: true, remote: true })).toEqual(["noexp", "shift"]);
    expect(refineOptions("workers", none)).toEqual(["exp", "remote"]);
    expect(refineOptions("workers", { ...none, exp: true })).toEqual(["remote"]);
    expect(refineOptions("jobs", null)).toHaveLength(4);
  });

  it("so'z oxiriga qo'shiladi, bo'lsa — qayta qo'shilmaydi", () => {
    expect(refineQuery("Toshkentda buxgalter", "kunlik")).toBe("Toshkentda buxgalter kunlik");
    expect(refineQuery("  oshpaz   kerak ", "tajribasiz")).toBe("oshpaz kerak tajribasiz");
    expect(refineQuery("Kunlik ish, Chilonzor", "kunlik")).toBe("Kunlik ish, Chilonzor");
    expect(refineQuery("", "kunlik")).toBe("kunlik");
    expect(refineQuery("buxgalter", "  ")).toBe("buxgalter");
  });

  it("300 belgidan oshmaydi va qo'shilgan so'z yo'qolmaydi", () => {
    const long = "a".repeat(298);
    const out = refineQuery(long, "kunlik");
    expect(out.length).toBeLessThanOrEqual(300);
    expect(out.endsWith(" kunlik")).toBe(true);
  });

  it("ovozli kiritish tili", () => {
    expect(speechLang("uz")).toBe("uz-UZ");
    expect(speechLang("oz")).toBe("uz-UZ");
    expect(speechLang("ru")).toBe("ru-RU");
    expect(speechLang("en")).toBe("en-US");
  });
});

describe("AI yordamchi: suhbatni saqlash", () => {
  const now = 1_800_000_000_000;
  it("oxirgi CHAT_KEEP ta savol-javob saqlanadi va qayta o'qiladi", () => {
    const turns = Array.from({ length: CHAT_KEEP + 3 }, (_, i) => ({ id: i }));
    const back = parseStoredChat<{ id: number }>(serializeChat(turns, now), now + 1000);
    expect(back).toHaveLength(CHAT_KEEP);
    expect(back[0]!.id).toBe(3);
  });

  it("muddati o'tgan, kelajakdagi yoki buzilgan yozuv — bo'sh", () => {
    expect(parseStoredChat(serializeChat([{ id: 1 }], now), now + CHAT_TTL_MS + 1)).toEqual([]);
    expect(parseStoredChat(serializeChat([{ id: 1 }], now + 10 * 60_000), now)).toEqual([]);
    expect(parseStoredChat("{bad json", now)).toEqual([]);
    expect(parseStoredChat(JSON.stringify({ at: now }), now)).toEqual([]);
    expect(parseStoredChat(null, now)).toEqual([]);
  });
});

describe("AI yordamchi: so'nggi suhbatlar (qurilmada)", () => {
  const now = 1_800_000_000_000;
  const conv = (id: number, at: number, n = 1) => ({ id, title: `s${id}`, at, turns: Array.from({ length: n }, (_, i) => ({ q: `${id}-${i}` })) });

  it("sarlavha — birinchi savol, bir qatorda, 60 belgigacha so'z chegarasida", () => {
    expect(conversationTitle("  Toshkentda   haydovchi  ")).toBe("Toshkentda haydovchi");
    const long = "Samarqandda tajribasiz sotuvchi ishi kerak, maosh kamida besh million so'm bo'lsin iltimos";
    const title = conversationTitle(long);
    expect(title.length).toBeLessThanOrEqual(61);
    expect(title.endsWith("…")).toBe(true);
    expect(title).not.toMatch(/\s…$/);
  });

  it("yangisi birinchi, bor bo'lsa yangilanadi, 10 tadan ortig'i tushib qoladi, bo'sh suhbat yozilmaydi", () => {
    let list = Array.from({ length: 10 }, (_, i) => conv(i + 1, now - i * 1000));
    list = upsertConversation(list, conv(99, now + 1));
    expect(list).toHaveLength(CONVERSATIONS_KEEP);
    expect(list[0]!.id).toBe(99);
    expect(list.some((c) => c.id === 10)).toBe(false);
    list = upsertConversation(list, { ...conv(5, now + 2), title: "yangilandi" });
    expect(list[0]).toMatchObject({ id: 5, title: "yangilandi" });
    expect(list.filter((c) => c.id === 5)).toHaveLength(1);
    expect(upsertConversation(list, { ...conv(5, now + 3), turns: [] }).some((c) => c.id === 5)).toBe(false);
  });

  it("o'qishda: muddati o'tgan, kelajakdagi, bo'sh va buzilgan yozuvlar tashlanadi; tartib — yangisi birinchi", () => {
    const raw = serializeConversations([
      conv(1, now - CONVERSATION_TTL_MS - 1),
      conv(2, now - 5000),
      conv(3, now + 120_000),
      { ...conv(4, now - 1000), turns: [] },
      conv(5, now - 100),
    ]);
    const parsed = parseStoredConversations<{ q: string }>(raw, now);
    expect(parsed.map((c) => c.id)).toEqual([5, 2]);
    expect(parseStoredConversations("{bad", now)).toEqual([]);
    expect(parseStoredConversations(JSON.stringify([{ id: "x" }, null, 5]), now)).toEqual([]);
  });
});
