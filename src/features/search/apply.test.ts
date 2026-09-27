import { describe, expect, it } from "vitest";
import { DEFAULT_JOBS_PARAMS } from "@/features/jobs/search-params";
import { EMPTY_WORKER_SEARCH } from "@/features/workers/search-params";
import { jobsRelaxations } from "@/features/jobs/relax";
import { workerRelaxations } from "@/features/workers/relax";
import { applyUnderstoodToJobs, applyUnderstoodToWorkers, monthlyEquivalent } from "./apply";
import { emptyUnderstood, type Understood } from "./understand";

const u = (patch: Partial<Understood>): Understood => ({ ...emptyUnderstood(), any: true, ...patch });
const cook = { id: "s1", slug: "cook", name_uz: "Oshpaz", name_ru: "Повар" };
const rest = { id: "c1", slug: "restaurant", name_uz: "Restoran", name_ru: "Ресторан" };
const tash = { id: "r1", slug: "tashkent_city", name_uz: "Toshkent", name_ru: "Ташкент" };
const chil = { id: "d1", slug: "chilonzor", name_uz: "Chilonzor", name_ru: "Чиланзар" };

describe("applyUnderstoodToJobs", () => {
  it("tushunilmasa null", () => {
    expect(applyUnderstoodToJobs({ ...DEFAULT_JOBS_PARAMS, q: "anor" }, emptyUnderstood(), "anor")).toBeNull();
  });
  it("bo'sh filtrlarni to'ldiradi, q = qolgan so'zlar, from = asl so'rov", () => {
    const next = applyUnderstoodToJobs({ ...DEFAULT_JOBS_PARAMS, q: "x", page: 3 }, u({ category: rest, subcategory: cook, region: tash, districts: [chil], salaryMin: 300_000, salaryKind: "daily", schedules: ["shift"], rest: "mers" }), "x");
    expect(next).toMatchObject({ category: "restaurant", subcategory: "cook", region: "tashkent_city", district: ["d1"], salaryMin: 6_600_000, schedule: ["shift"], q: "mers", from: "x", page: 1 });
  });
  it("foydalanuvchi qo'ygan filtr ustun", () => {
    const next = applyUnderstoodToJobs({ ...DEFAULT_JOBS_PARAMS, q: "x", category: "it", salaryMin: 1 }, u({ category: rest, subcategory: cook, salaryMin: 5_000_000 }), "x");
    expect(next?.category).toBe("it");
    expect(next?.subcategory).toBeNull();
    expect(next?.salaryMin).toBe(1);
  });
  it("tajriba → experience_max", () => {
    expect(applyUnderstoodToJobs(DEFAULT_JOBS_PARAMS, u({ experienceMonths: 30 }), "x")?.experienceMax).toBe(36);
  });
});

describe("applyUnderstoodToWorkers", () => {
  it("byudjet → salary_max, tajriba → experience_min", () => {
    const next = applyUnderstoodToWorkers({ ...EMPTY_WORKER_SEARCH, q: "x" }, u({ category: rest, subcategory: cook, salaryMin: 5_000_000, salaryKind: "monthly", experienceMonths: 30 }), "x");
    expect(next).toMatchObject({ category: "restaurant", subcategory: "cook", salary_max: 5_000_000, experience_min: 24, q: null, from: "x" });
  });
});

describe("relaxations", () => {
  it("jobs: har bir faol filtr uchun bitta variant", () => {
    const keys = jobsRelaxations({ ...DEFAULT_JOBS_PARAMS, q: "a", category: "it", subcategory: "qa", region: "r", district: ["d"], salaryMin: 5 }).map((r) => r.key);
    expect(keys).toEqual(["q", "subcategory", "district", "salary", "profession_only"]);
    expect(jobsRelaxations(DEFAULT_JOBS_PARAMS)).toEqual([]);
  });
  it("workers", () => {
    expect(workerRelaxations({ ...EMPTY_WORKER_SEARCH, category: "it", salary_max: 1, experience_min: 12 }).map((r) => r.key)).toEqual(["category", "salary", "experience", "profession_only"]);
  });
  it("monthlyEquivalent", () => {
    expect(monthlyEquivalent(50_000, "hourly")).toBe(8_800_000);
    expect(monthlyEquivalent(5, null)).toBe(5);
  });
});
