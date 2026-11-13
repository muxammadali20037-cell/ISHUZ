import { describe, expect, it } from "vitest";
import { checkMasterText } from "./content-check";

describe("checkMasterText — ustalar e'lonlari, so'rovlar, sharhlar", () => {
  it("oddiy xizmat e'loni o'tadi (ogohlantirishsiz)", () => {
    const v = checkMasterText({ title: "Konditsioner o'rnatish va tozalash", description: "Split konditsionerlarni o'rnataman, freon quyaman. Kafolat 6 oy.", services: ["Tozalash", "Freon"] });
    expect(v).toEqual({ blocked: false, category: null, rule: null, flags: [] });
  });

  it("massaj — har qanday ko'rinishda taqiqlangan (ega, 2026-11-13: \"massaj, spa kerak emas\")", () => {
    const v = checkMasterText({ title: "Davolovchi massaj", description: "Tibbiy massaj, bel og'rig'i uchun, uyga borib." });
    expect(v.blocked).toBe(true);
    expect(v.rule).toBe("strict_massage");
    expect(v.category).toBe("sexual_services");
  });

  it("intim xizmat — bloklanadi (kirill va yashirilgan yozuvda ham)", () => {
    expect(checkMasterText({ description: "Intim xizmat ko'rsatamiz, soatbay" }).blocked).toBe(true);
    expect(checkMasterText({ title: "Эротический массаж на дому" }).category).toBe("sexual_services");
    expect(checkMasterText({ description: "1nt1m uslugi 24/7" }).blocked).toBe(true);
  });

  it("giyohvand moddalar, karta sotib olish, soxta hujjat, akkaunt buzish — bloklanadi", () => {
    expect(checkMasterText({ description: "Zakladchik kerak, yaxshi pul" }).category).toBe("illegal_activity");
    expect(checkMasterText({ description: "Bank kartalarni ijaraga olamiz" }).blocked).toBe(true);
    expect(checkMasterText({ services: ["Soxta diplom tayyorlash"] }).blocked).toBe(true);
    expect(checkMasterText({ title: "Telegram akkaunt buzish xizmati" }).blocked).toBe(true);
  });

  it("shubhali (savdo, oldindan to'lov) — saqlanadi, lekin admin uchun ogohlantirish", () => {
    const v = checkMasterText({ description: "Konditsionerlar sotiladi, optom narxda. Oldindan to'lov 50%." });
    expect(v.blocked).toBe(false);
    expect(v.flags).toEqual(expect.arrayContaining(["sale", "scam_prepay"]));
  });

  it("so'rov va sharh matni ham tekshiriladi", () => {
    expect(checkMasterText({ message: "Kokain sotamiz, yetkazib beramiz" }).blocked).toBe(true);
    expect(checkMasterText({ text: "Juda yaxshi usta, tez va toza ishladi" }).blocked).toBe(false);
  });
});
