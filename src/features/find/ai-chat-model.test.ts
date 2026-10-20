import { describe, expect, it } from "vitest";
import { CHAT_KEEP, CHAT_TTL_MS, parseStoredChat, refineOptions, refineQuery, serializeChat, speechLang } from "./ai-chat-model";

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
  it("oxirgi 5 ta xabar saqlanadi va qayta o'qiladi", () => {
    const turns = Array.from({ length: 8 }, (_, i) => ({ id: i }));
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
