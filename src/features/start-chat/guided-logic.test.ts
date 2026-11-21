import { describe, expect, it } from "vitest";
import { NO_FILTERS, type QuickForm } from "@/features/find/quick-types";
import { draftFromForm, nextAsk, placeChoices, roleOfMode, shownWord } from "./guided-logic";

const base = { nodeId: "n1", profession: "Haydovchi", placeKnown: true, askedProfession: false };

describe("chat: keyingi savol (bittadan, bir marta aytilgani qayta so'ralmaydi)", () => {
  it("rol noma'lum — avval rol", () => {
    expect(nextAsk(base, null)).toBe("role");
  });
  it("kasb yo'q — kasb so'raladi", () => {
    expect(nextAsk({ ...base, nodeId: null, profession: "" }, "workers")).toBe("profession");
  });
  it("kasb tushunilmadi — bir marta aniqlashtiriladi, keyin yozilgan so'z bilan qidiriladi", () => {
    expect(nextAsk({ ...base, nodeId: null, profession: "asdkjhqwe" }, "jobs")).toBe("profession");
    expect(nextAsk({ ...base, nodeId: null, profession: "korzinka", askedProfession: true }, "jobs")).toBeNull();
  });
  it("hudud aytilmagan va eslab qolinmagan — hudud", () => {
    expect(nextAsk({ ...base, placeKnown: false }, "jobs")).toBe("place");
  });
  it("hammasi bor — qidiriladi (savolsiz)", () => {
    expect(nextAsk(base, "workers")).toBeNull();
  });
  it("kasb aytilmagan, lekin turi aytilgan («kunlik ish», «masofaviy ish») — kasb so'ralmaydi, faqat hudud", () => {
    const none = { ...base, nodeId: null, profession: "", placeKnown: false };
    expect(nextAsk({ ...none, filters: { ...NO_FILTERS, pay: "daily" } }, "jobs")).toBe("place");
    expect(nextAsk({ ...none, filters: { ...NO_FILTERS, noexp: true } }, "jobs")).toBe("place");
    expect(nextAsk({ ...none, placeKnown: true, place: "remote", filters: NO_FILTERS }, "jobs")).toBeNull();
    // tushunilmagan so'z bilan — baribir bir marta so'raladi
    expect(nextAsk({ ...none, profession: "qwerty", filters: { ...NO_FILTERS, pay: "daily" } }, "jobs")).toBe("profession");
    // filtr ham yo'q — kasb so'raladi
    expect(nextAsk({ ...none, filters: NO_FILTERS }, "jobs")).toBe("profession");
  });
});

describe("hudud tugmalari", () => {
  const places = [
    { value: "all", label: "Butun O'zbekiston" },
    { value: "tashkent_city~d1", label: "Toshkent shahri, Chilonzor" },
    { value: "remote", label: "Masofaviy" },
    { value: "tashkent_city", label: "Toshkent shahri" },
    { value: "samarkand", label: "Samarqand" },
  ];
  it("avval viloyatlar, keyin butun O'zbekiston; masofaviy — faqat ish qidirishda", () => {
    expect(placeChoices(places, "jobs").map((p) => p.value)).toEqual(["tashkent_city", "samarkand", "all", "remote"]);
    expect(placeChoices(places, "workers").map((p) => p.value)).toEqual(["tashkent_city", "samarkand", "all"]);
  });
});

describe("rol va oyna javobi", () => {
  it("rejim → qidiruv yo'nalishi", () => {
    expect(roleOfMode("worker")).toBe("jobs");
    expect(roleOfMode("employer")).toBe("workers");
    expect(roleOfMode(null)).toBeNull();
  });
  it("tushunilgan javoblar chat qoralamasiga", () => {
    const form: QuickForm = { mode: "jobs", text: "toshkentda haydovchi", profession: "Haydovchi", nodeId: "n1", place: "tashkent_city", salary: null, filters: NO_FILTERS, places: [], placeKnown: true, intent: "jobs" };
    expect(draftFromForm(form)).toMatchObject({ profession: "Haydovchi", nodeId: "n1", place: "tashkent_city", placeKnown: true, formMode: "jobs", askedProfession: false });
    expect(draftFromForm({ ...form, placeKnown: undefined }).placeKnown).toBe(false);
  });
});

describe("tushunilmagan so'z — odam yozganidek", () => {
  it("katta harf saqlanadi; topilmasa — tushunilgan shakli", () => {
    expect(shownWord("kosmonavt", "Kosmonavt")).toBe("Kosmonavt");
    expect(shownWord("asdkjhqwe", "Menga ASDKJHQWE kerak")).toBe("ASDKJHQWE");
    expect(shownWord("oshpaz", "boshqa matn")).toBe("oshpaz");
  });
});
