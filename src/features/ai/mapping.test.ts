import { describe, expect, it } from "vitest";
import { personalSchema, locationSchema, professionSchema, experienceSchema, skillsSchema, preferencesSchema } from "@/features/onboarding/schema";
import { stepPayloadSchema } from "@/features/vacancies/schema";
import { planVacancy, planWorker, type CatalogMaps } from "./mapping";
import type { VacancyExtract, WorkerExtract } from "./extract";

const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const maps: CatalogMaps = {
  category: new Map([
    ["c1", U(1)],
    ["c2", U(2)],
  ]),
  subcategory: new Map([
    ["s1", { id: U(11), categoryId: U(1) }],
    ["s2", { id: U(12), categoryId: U(2) }],
  ]),
  region: new Map([
    ["r1", U(21)],
    ["r2", U(22)],
  ]),
  district: new Map([
    ["d1", { id: U(31), regionId: U(21) }],
    ["d2", { id: U(32), regionId: U(21) }],
    ["d3", { id: U(33), regionId: U(22) }],
  ]),
  skill: new Map([
    ["k1", { id: U(41), categoryId: U(1) }],
    ["k2", { id: U(42), categoryId: U(1) }],
  ]),
  languageCodes: new Set(["uz", "ru", "en"]),
  benefitCodes: new Set(["meals", "transport"]),
  officialTermCodes: new Set(["labor_book"]),
};

const worker: WorkerExtract = {
  first_name: "Aziza",
  last_name: "Karimova",
  birth_date: null,
  gender: "female",
  region: "r2", // noto'g'ri — tuman r1 da; tuman ustun
  district: "d1",
  extra_districts: ["d2", "d99"],
  remote_preference: null,
  category: "c2",
  subcategory: "s1", // yo'nalish c1 ga tegishli — kategoriya undan olinadi
  headline: "Sotuvchi",
  about: "3 yillik tajribali sotuvchi.",
  experience_level: "2_3y",
  experience: [
    { company_name: "Korzinka", position: "Sotuvchi", started_on: "2021-03", ended_on: "2024-02", is_current: false, responsibilities: "Kassa" },
    { company_name: "X", position: "Y", started_on: null, ended_on: null, is_current: false, responsibilities: "" },
  ],
  skills: [
    { code: "k1", level: "good" },
    { code: "k1", level: "professional" },
    { code: "k404", level: "good" },
  ],
  languages: [
    { code: "uz", level: "native" },
    { code: "xx", level: "b1" },
  ],
  education_level: null,
  education: [],
  employment_types: ["full_time", "full_time"],
  schedules: ["5_2"],
  salary_min: 5_000_000,
  salary_expected: 4_000_000,
  salary_type: null,
  availability: "tomorrow",
  work_format: "official",
};

describe("planWorker", () => {
  const plan = planWorker(maps, worker);

  it("tuman viloyatni belgilaydi, noma'lum kodlar tashlanadi", () => {
    expect(plan.location?.region_id).toBe(U(21));
    expect(plan.location?.district_id).toBe(U(31));
    expect(plan.location?.work_districts).toEqual([U(31), U(32)]);
    expect(plan.location?.remote_preference).toBe("no");
    expect(locationSchema.safeParse(plan.location).success).toBe(true);
  });

  it("yo'nalish kategoriyani belgilaydi", () => {
    expect(plan.profession).toEqual({ category_id: U(1), subcategory_id: U(11), headline: "Sotuvchi" });
    expect(professionSchema.safeParse(plan.profession).success).toBe(true);
  });

  it("to'liqsiz tajriba yozuvlari tashlanadi, qolgani sxemadan o'tadi", () => {
    expect(plan.experience.entries).toHaveLength(1);
    expect(experienceSchema.safeParse(plan.experience).success).toBe(true);
  });

  it("ko'nikma va tillar takrorsiz, faqat katalogdagilar", () => {
    expect(plan.skills.skills).toEqual([{ skill_id: U(41), level: "professional" }]);
    expect(plan.skills.languages).toEqual([{ language_code: "uz", level: "native" }]);
    expect(skillsSchema.safeParse(plan.skills).success).toBe(true);
  });

  it("maosh tartibi tuzatiladi, istaklar sxemadan o'tadi", () => {
    expect(plan.preferences?.salary_expected).toBe(5_000_000);
    expect(plan.preferences?.salary_type).toBe("monthly");
    expect(preferencesSchema.safeParse(plan.preferences).success).toBe(true);
  });

  it("tug'ilgan sana bo'lmasa shaxsiy qadam o'tmaydi (foydalanuvchidan so'raladi)", () => {
    expect(plan.personal.birth_date).toBe("");
    expect(personalSchema.safeParse({ ...plan.personal, telegram_username: "" }).success).toBe(false);
    expect(personalSchema.safeParse({ ...plan.personal, birth_date: "2000-03-14", telegram_username: "" }).success).toBe(true);
  });

  it("majburiy ma'lumot bo'lmasa qadam null", () => {
    const p = planWorker(maps, { ...worker, district: null, category: null, subcategory: null, availability: null, languages: [] });
    expect(p.location).toBeNull();
    expect(p.profession).toBeNull();
    expect(p.preferences).toBeNull();
    expect(p.skills.languages).toEqual([{ language_code: "uz", level: "native" }]);
  });
});

const vacancy: VacancyExtract = {
  title: "Oshpaz",
  category: "c1",
  subcategory: "s1",
  is_remote: false,
  region: "r1",
  district: "d2",
  address: "Chilonzor 9",
  salary_negotiable: false,
  salary_from: 8_000_000,
  salary_to: 6_000_000,
  salary_type: "monthly",
  employment_type: "full_time",
  schedule: "2_2",
  work_time_from: "09:00",
  work_time_to: "25:00",
  experience_min_months: 14,
  age_min: 50,
  age_max: 20,
  education_min: null,
  gender: null,
  languages: [{ code: "ru", min_level: "b1" }],
  skills: [{ code: "k2", required: true }],
  work_format: "official",
  official_terms: ["labor_book", "nope"],
  benefits: ["meals", "meals", "gym"],
  description: "📋 **Vazifalar:**\n- Taom tayyorlash",
};

describe("planVacancy", () => {
  const plan = planVacancy(maps, vacancy);
  const byStep = Object.fromEntries(plan.steps.map((s) => [s.step, s.data]));

  it("barcha qadamlar sxemadan o'tadi", () => {
    for (const s of plan.steps) expect(stepPayloadSchema.safeParse(s).success, s.step).toBe(true);
  });

  it("qiymatlar tuzatiladi: maosh/yosh tartibi, noto'g'ri vaqt, eng yaqin tajriba", () => {
    expect(byStep.salary).toMatchObject({ salaryFrom: 6_000_000, salaryTo: 8_000_000, salaryNegotiable: false });
    expect(byStep.requirements).toMatchObject({ experienceMinMonths: 12, ageMin: 20, ageMax: 50 });
    expect(byStep.schedule).toMatchObject({ workTimeFrom: "09:00", workTimeTo: null });
    expect(byStep.work_format).toEqual({ workFormat: "official", officialTerms: ["labor_book"] });
    expect(byStep.benefits).toEqual({ benefits: ["meals"] });
    expect(byStep.location).toMatchObject({ regionId: U(21), districtId: U(32) });
  });

  it("kategoriya/hudud topilmasa — qadam yuboriladi, lekin sxema rad etadi (foydalanuvchi tanlaydi)", () => {
    const p = planVacancy(maps, { ...vacancy, category: null, subcategory: null, region: null, district: null, salary_from: null, salary_to: null, salary_negotiable: false });
    const steps = Object.fromEntries(p.steps.map((s) => [s.step, s]));
    expect(stepPayloadSchema.safeParse(steps.category).success).toBe(false);
    expect(stepPayloadSchema.safeParse(steps.location).success).toBe(false);
    expect(steps.salary?.data).toMatchObject({ salaryNegotiable: true });
  });
});
