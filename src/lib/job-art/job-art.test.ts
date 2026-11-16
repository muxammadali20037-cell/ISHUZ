import { describe, expect, it } from "vitest";
import { jobArchetype } from "./archetype";
import { ARCHETYPES, lookFor, personDataUri, personSvg } from "./person";

const a = (names: string[], categorySlug: string | null = null) => jobArchetype({ names, categorySlug });

describe("kasb → kiyim turi", () => {
  it("oddiy kasblar (o'zbekcha, ruscha, inglizcha nomidan)", () => {
    expect(a(["Family doctor", "Семейный врач", "Oilaviy shifokor"])).toBe("doctor");
    expect(a(["Oilaviy shifokor"])).toBe("doctor");
    expect(a(["Оилавий шифокор"], "medicine")).toBe("doctor");
    expect(a(["Hamshira"])).toBe("nurse");
    expect(a(["Oshpaz"])).toBe("chef");
    expect(a(["Повар"])).toBe("chef");
    expect(a(["Sotuvchi"])).toBe("seller");
    expect(a(["Kassir"])).toBe("cashier");
    expect(a(["Ofitsiant"])).toBe("waiter");
    expect(a(["Haydovchi"])).toBe("driver");
    expect(a(["Taksi haydovchisi"])).toBe("driver");
    expect(a(["Kuryer"])).toBe("courier");
    expect(a(["Farrosh"])).toBe("cleaner");
    expect(a(["Quruvchi"])).toBe("builder");
    expect(a(["Santexnik"])).toBe("plumber");
    expect(a(["Elektrik"])).toBe("electrician");
    expect(a(["Payvandchi"])).toBe("welder");
    expect(a(["Avtomexanik"])).toBe("mechanic");
    expect(a(["Dasturchi"])).toBe("it");
    expect(a(["Buxgalter"])).toBe("office");
    expect(a(["Enaga"])).toBe("nanny");
    expect(a(["Tikuvchi"])).toBe("tailor");
    expect(a(["Sartarosh"])).toBe("barber");
    expect(a(["Qo'riqchi"])).toBe("security");
    expect(a(["Omborchi"])).toBe("warehouse");
    expect(a(["Bog'bon"])).toBe("farmer");
    expect(a(["Barista"])).toBe("barista");
  });

  it("adashtiradigan so'zlar: «делопроизводитель» haydovchi emas, «livestock» ombor emas, «nursery» hamshira emas", () => {
    expect(a(["Records clerk", "Делопроизводитель"])).toBe("office");
    expect(a(["Branch manager", "Руководитель филиала"])).toBe("office");
    expect(a(["Livestock farmer", "Фермер-животновод"])).toBe("farmer");
    expect(a(["Plant nursery worker", "Работник питомника"], "agriculture")).toBe("farmer");
    expect(a(["Ocean container forwarder", "Экспедитор", "Dengiz konteyner ekspeditori"], "logistics")).toBe("warehouse");
    expect(a(["Cybersecurity specialist"], "it")).toBe("it");
    expect(a(["Pharmacy delivery courier"], "courier")).toBe("courier");
  });

  it("nomdan topilmasa — kategoriya; u ham bo'lmasa — umumiy", () => {
    expect(a([], "medicine")).toBe("doctor");
    expect(a(["Xyz"], "restaurant")).toBe("chef");
    expect(a(["Xyz"], null)).toBe("generic");
  });
});

describe("odam chizmasi", () => {
  it("har kiyim turi va har ko'rinish uchun to'g'ri SVG", () => {
    for (const arch of ARCHETYPES) {
      for (const look of [
        { female: false, skin: 0, hair: 0, style: 0 },
        { female: false, skin: 2, hair: 2, style: 1 },
        { female: true, skin: 1, hair: 1, style: 0 },
        { female: true, skin: 0, hair: 2, style: 1 },
        { female: true, skin: 2, hair: 0, style: 2 },
      ]) {
        const svg = personSvg(arch, look);
        expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 460"'), arch).toBe(true);
        expect(svg.endsWith("</svg>"), arch).toBe(true);
        expect(svg, arch).not.toMatch(/undefined|NaN|null/);
        // ochilgan va yopilgan teglar mos (o'z-o'zini yopuvchilardan tashqari)
        const open = (svg.match(/<(svg|g|clipPath)[\s>]/g) ?? []).length;
        const close = (svg.match(/<\/(svg|g|clipPath)>/g) ?? []).length;
        expect(open, arch).toBe(close);
      }
    }
  });

  it("bir kasb — doim bir xil ko'rinish (urug'dan); kasblar orasida turlicha", () => {
    expect(lookFor("doctor", "abc")).toEqual(lookFor("doctor", "abc"));
    const looks = new Set(Array.from({ length: 40 }, (_, i) => JSON.stringify(lookFor("seller", `id-${i}`))));
    expect(looks.size).toBeGreaterThan(6);
    const female = Array.from({ length: 200 }, (_, i) => lookFor("office", `n${i}`).female).filter(Boolean).length;
    expect(female).toBeGreaterThan(60);
    expect(female).toBeLessThan(140);
  });

  it("shapka bilan ro'mol birga chiqmaydi", () => {
    for (let i = 0; i < 200; i++) {
      const l = lookFor("chef", `x${i}`);
      expect(l.style === 2 && l.female).toBe(false);
    }
  });

  it("next/og uchun data URI", () => {
    expect(personDataUri("chef", "1")).toMatch(/^data:image\/svg\+xml;base64,/);
  });
});
