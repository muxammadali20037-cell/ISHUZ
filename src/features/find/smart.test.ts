import { describe, expect, it } from "vitest";
import { aiRemote, needsAi, professionQueries, smartFilters, type AiSearchParse, type RulesResolved } from "./smart";

const rules = (p: Partial<RulesResolved> = {}): RulesResolved => ({
  mode: null,
  nodeId: null,
  regionSlug: null,
  districtId: null,
  remote: false,
  salaryMin: null,
  salaryKind: null,
  schedules: [],
  noExperience: false,
  experienceMonths: null,
  ...p,
});

const ai = (p: Partial<AiSearchParse> = {}): AiSearchParse => ({
  intent: null,
  profession: null,
  specialization: null,
  region: null,
  district: null,
  remote: null,
  salary_min: null,
  pay_period: null,
  experience: null,
  schedule: null,
  employment: null,
  skills: [],
  ...p,
});

describe("aqlli qidiruv: qoidalar + AI", () => {
  it("kasb topilmasa yoki maosh tushunilmasa AI chaqiriladi", () => {
    expect(needsAi("Buxgalter Toshkent", rules({ nodeId: "n1" }))).toBe(false);
    expect(needsAi("hisobchi kerak", rules())).toBe(true);
    expect(needsAi("Buxgalter 5 mln dan", rules({ nodeId: "n1" }))).toBe(true);
    expect(needsAi("Buxgalter 5 mln dan", rules({ nodeId: "n1", salaryMin: 5_000_000 }))).toBe(false);
  });

  it("oylik maosh filtri: AI summasi matnda bo'lishi shart", () => {
    const q = "Toshkentda buxgalter ishi 5 mln dan yuqori";
    expect(smartFilters(q, "jobs", rules(), ai({ salary_min: 5_000_000, pay_period: "month" })).salary).toBe(5_000_000);
    expect(smartFilters(q, "jobs", rules(), ai({ salary_min: 7_000_000 })).salary).toBeNull();
  });

  it("kunlik maosh oylikka tenglashtirilmaydi", () => {
    const q = "kunlik 300 ming ish";
    expect(smartFilters(q, "jobs", rules(), ai({ salary_min: 300_000, pay_period: "day" })).salary).toBeNull();
    expect(smartFilters(q, "jobs", rules({ salaryMin: 300_000, salaryKind: "daily" }), null).salary).toBeNull();
  });

  it("jadval va tajriba faqat matnda aytilgan bo'lsa", () => {
    expect(smartFilters("oshpaz ishi 6/1", "jobs", rules(), ai({ schedule: "6_1" })).schedule).toBe("6_1");
    expect(smartFilters("oshpaz ishi", "jobs", rules(), ai({ schedule: "6_1" })).schedule).toBeNull();
    expect(smartFilters("tajribasiz ish kerak", "jobs", rules(), ai({ experience: "none" })).noexp).toBe(true);
    expect(smartFilters("ish kerak", "jobs", rules(), ai({ experience: "none" })).noexp).toBe(false);
    expect(smartFilters("tajribali oshpaz kerak", "workers", rules(), ai({ experience: "experienced" })).exp).toBe(true);
  });

  it("ishchi qidirishda ish filtrlari qo'llanmaydi", () => {
    const f = smartFilters("oshpaz kerak 5 mln", "workers", rules({ salaryMin: 5_000_000, salaryKind: "monthly" }), null);
    expect(f.salary).toBeNull();
    expect(f.schedule).toBeNull();
  });

  it("masofaviy ish — faqat matnda ishora bo'lsa", () => {
    expect(aiRemote("uydan ishlash, operator", ai({ remote: true }))).toBe(true);
    expect(aiRemote("operator kerak", ai({ remote: true }))).toBe(false);
  });

  it("kasb so'rovlari: aniqrog'i birinchi", () => {
    expect(professionQueries(ai({ profession: "haydovchi", specialization: "yuk mashinasi" }))).toEqual(["yuk mashinasi haydovchi", "yuk mashinasi", "haydovchi"]);
    expect(professionQueries(null)).toEqual([]);
  });
});
