import { describe, expect, it } from "vitest";
import { hasJobIntent, nameFit, offTopic, professionMentioned } from "./post-intent";

describe("ish so'zi (oyna ochiladimi)", () => {
  it("ish haqidagi gaplar", () => {
    for (const s of ["ish kerak", "ishga kiraman", "menga ish", "e'lon joylamoqchiman", "elon berish", "работа нужна", "нужна подработка", "иш керак", "vakansiya bormi", "I need a job"]) {
      expect(hasJobIntent(s), s).toBe(true);
    }
  });
  it("o'xshash, lekin ish emas", () => {
    for (const s of ["ishonch", "ishtaham yo'q", "bugun havo zo'r", "salom"]) expect(hasJobIntent(s), s).toBe(false);
  });
});

describe("boshqa mavzu", () => {
  it("salomlashish, rahmat, kimsan — doim boshqa mavzu", () => {
    expect(offTopic("salom", false)).toBe("greeting");
    expect(offTopic("Assalomu alaykum!", true)).toBe("greeting");
    expect(offTopic("qalaysiz", false)).toBe("greeting");
    expect(offTopic("rahmat", false)).toBe("thanks");
    expect(offTopic("sen kimsan", false)).toBe("who");
  });
  it("ish bilan bog'liq bo'lmagan savol", () => {
    expect(offTopic("ob-havo qanday?", false)).toBe("other");
    expect(offTopic("как дела у тебя сегодня?", false)).toBe("other");
    expect(offTopic("what is the capital of France?", false)).toBe("other");
    expect(offTopic("rezyume qanday yoziladi", false)).toBe("other");
  });
  it("ish so'rovi yoki kasb — boshqa mavzu emas", () => {
    expect(offTopic("men o'qituvchiman", true)).toBeNull();
    expect(offTopic("qayerda ish bor?", false)).toBeNull();
    expect(offTopic("oshpaz maoshi qancha?", true)).toBeNull();
    expect(offTopic("menga ish toping", false)).toBeNull();
    expect(offTopic("korzinka", false)).toBeNull();
    expect(offTopic("", false)).toBeNull();
  });
});

describe("kasb nomi gapda bormi", async () => {
  const { normalizeText } = await import("@/features/search/understand");
  const m = (text: string, ...names: string[]) => professionMentioned(text, names, normalizeText);
  it("aniq, qo'shimcha bilan, imlo xatosi bilan, kirill/rus", () => {
    expect(m("men o'qituvchiman", "O'qituvchi")).toBe(true);
    expect(m("oqtvchi", "O'qituvchi")).toBe(true);
    expect(m("uqituvchi", "O'qituvchi")).toBe(true);
    expect(m("ingliz tili o'qituvchisiman", "Ingliz tili o'qituvchisi")).toBe(true);
    expect(m("men haydovchiman, Samarqand", "Haydovchi")).toBe(true);
    expect(m("мен ўқитувчиман", "O'qituvchi")).toBe(true);
    expect(m("я водитель", "Haydovchi", "Водитель")).toBe(true);
    expect(m("avtobus haydovchiman", "Avtobus haydovchisi")).toBe(true);
    expect(m("ingliz tili o'qituvchiman", "Ingliz tili o'qituvchisi")).toBe(true);
    expect(m("sotuv menejeri", "Sotuv bo'yicha menejer")).toBe(true);
    expect(m("santexnk kerakmi", "Santexnik")).toBe(true);
  });
  it("tasodifiy bitta so'z — uzun boshqa kasb emas", () => {
    expect(m("bugun havo zo'r", "Havo elektr uzatish liniyalari elektromontyori", "lep", "havo liniyasi")).toBe(false);
    expect(m("haydovchiman", "Avtobus haydovchisi")).toBe(false);
    expect(m("men o'qituvchiman", "Loyiha menejeri")).toBe(false);
    expect(m("o'qituvchi", "Avtoinstruktor")).toBe(false);
  });
});

describe("kasb nomining gapga mosligi (qidiruvda tartiblash)", async () => {
  const { normalizeText } = await import("@/features/search/understand");
  const fit = (said: string, name: string) => {
    const f = nameFit(normalizeText(said).split(" "), name, normalizeText);
    return f.covered * 0.8 - f.extra * 0.4;
  };
  it("«oila shifokori» — Oilaviy shifokor, Oila huquqi yuristi emas", () => {
    expect(fit("oila shifokori", "Oilaviy shifokor")).toBeGreaterThan(fit("oila shifokori", "Oila huquqi yuristi") + 1);
    expect(fit("oila shifokori", "Oilaviy shifokor")).toBeGreaterThan(fit("oila shifokori", "Klinik laboratoriya shifokori") + 1);
  });
  it("aniq nom — eng yuqori", () => {
    expect(fit("enaga", "Enaga")).toBeGreaterThan(fit("enaga", "Tarbiyachi yordamchisi"));
    expect(fit("haydovchi", "Haydovchi")).toBeGreaterThan(fit("haydovchi", "Avtobus haydovchisi"));
  });
});
