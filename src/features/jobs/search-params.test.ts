import { describe, expect, it } from "vitest";
import {
  DEFAULT_JOBS_PARAMS,
  clearFilters,
  countActiveFilters,
  jobsHref,
  matchQueryToCategory,
  parseJobsSearchParams,
  serializeJobsSearchParams,
  toSearchVacanciesArgs,
} from "./search-params";

const D1 = "11111111-1111-4111-8111-111111111111";
const D2 = "22222222-2222-4222-8222-222222222222";

describe("parseJobsSearchParams", () => {
  it("bo'sh obyekt → standart qiymatlar", () => {
    expect(parseJobsSearchParams({})).toEqual(DEFAULT_JOBS_PARAMS);
    expect(parseJobsSearchParams(new URLSearchParams())).toEqual(DEFAULT_JOBS_PARAMS);
  });

  it("to'liq URL ni o'qiydi (Record va URLSearchParams)", () => {
    const qs = `q=%20kassir%20&category=sales&subcategory=cashier&region=tashkent_city&district=${D1},${D2}&salary_min=5000000&employment=full_time,part_time&schedule=5_2,6_1&format=official&experience_max=12&remote=1&benefits=food,transport&verified=1&gov=1&no_experience=true&profession=medicine-doctors&sort=newest&page=3`;
    const parsed = parseJobsSearchParams(new URLSearchParams(qs));
    expect(parsed).toEqual({
      q: "kassir",
      category: "sales",
      subcategory: "cashier",
      profession: "medicine-doctors",
      region: "tashkent_city",
      district: [D1, D2],
      salaryMin: 5_000_000,
      employment: ["full_time", "part_time"],
      schedule: ["5_2", "6_1"],
      format: "official",
      experienceMax: 12,
      remote: true,
      benefits: ["food", "transport"],
      verified: true,
      government: true,
      noExperience: true,
      opportunity: [],
      students: false,
      sort: "newest",
      page: 3,
      exact: false,
      from: "",
    });
    expect(parseJobsSearchParams(Object.fromEntries(new URLSearchParams(qs)))).toEqual(parsed);
  });

  it("noto'g'ri qiymatlarni tashlab yuboradi", () => {
    const parsed = parseJobsSearchParams({
      category: "../etc",
      district: `${D1},not-a-uuid,${D1}`,
      salary_min: "-5",
      employment: "full_time,hacker",
      schedule: "9_9",
      format: "any",
      experience_max: "13",
      remote: "yes",
      benefits: "food,DROP TABLE",
      sort: "asc",
      page: "0",
    });
    expect(parsed.category).toBeNull();
    expect(parsed.district).toEqual([D1]);
    expect(parsed.salaryMin).toBeNull();
    expect(parsed.employment).toEqual(["full_time"]);
    expect(parsed.schedule).toEqual([]);
    expect(parsed.format).toBeNull();
    expect(parsed.experienceMax).toBeNull();
    expect(parsed.remote).toBe(false);
    expect(parsed.benefits).toEqual(["food"]);
    expect(parsed.sort).toBe("relevant");
    expect(parsed.page).toBe(1);
  });

  it("massiv qiymatdan birinchisini oladi, q ni qisqartiradi, experience_max=0 ni qabul qiladi", () => {
    const parsed = parseJobsSearchParams({ q: ["a".repeat(200), "b"], page: ["2", "5"], experience_max: "0" });
    expect(parsed.q).toHaveLength(120);
    expect(parsed.page).toBe(2);
    expect(parsed.experienceMax).toBe(0);
  });
});

describe("serializeJobsSearchParams / jobsHref", () => {
  it("standart qiymatlarni yozmaydi", () => {
    expect(serializeJobsSearchParams(DEFAULT_JOBS_PARAMS)).toBe("");
    expect(jobsHref(DEFAULT_JOBS_PARAMS)).toBe("/jobs");
  });

  it("parse ↔ serialize teskari (round-trip)", () => {
    const params = parseJobsSearchParams({
      q: "kassir",
      category: "sales",
      district: `${D1},${D2}`,
      salary_min: "5000000",
      schedule: "5_2",
      experience_max: "0",
      remote: "1",
      sort: "salary",
      page: "2",
    });
    const qs = serializeJobsSearchParams(params);
    expect(parseJobsSearchParams(new URLSearchParams(qs))).toEqual(params);
    expect(qs).toContain("experience_max=0");
  });

  it("overrides bilan havola: page qayta 1 bo'lsa yozilmaydi", () => {
    const params = parseJobsSearchParams({ category: "sales", page: "4" });
    expect(jobsHref(params, { page: 1 })).toBe("/jobs?category=sales");
    expect(jobsHref(params, { sort: "newest" })).toBe("/jobs?category=sales&sort=newest&page=4");
  });
});

describe("countActiveFilters / clearFilters", () => {
  it("q, sort, page hisoblanmaydi", () => {
    expect(countActiveFilters(parseJobsSearchParams({ q: "x", sort: "newest", page: "3" }))).toBe(0);
    expect(countActiveFilters(parseJobsSearchParams({ category: "sales", district: D1, remote: "1", benefits: "food" }))).toBe(4);
  });
  it("clearFilters q va sort ni saqlaydi", () => {
    const cleared = clearFilters(parseJobsSearchParams({ q: "x", sort: "newest", page: "3", category: "sales" }));
    expect(cleared).toEqual({ ...DEFAULT_JOBS_PARAMS, q: "x", sort: "newest" });
  });
});

describe("toSearchVacanciesArgs", () => {
  it("faqat o'rnatilgan filtrlarni RPC ga uzatadi", () => {
    const params = parseJobsSearchParams({ q: "kassir", district: D1, page: "2", verified: "1" });
    expect(toSearchVacanciesArgs(params, { categoryId: "cat-1", regionId: null })).toEqual({
      p_query: "kassir",
      p_category_id: "cat-1",
      p_district_ids: [D1],
      p_sort: "relevant",
      p_limit: 20,
      p_offset: 20,
      p_verified_only: true,
      p_government_only: false,
      p_no_experience: false,
      p_student_friendly: false,
    });
  });
  it("gov=1 → p_government_only", () => {
    expect(toSearchVacanciesArgs(parseJobsSearchParams({ gov: "1" }), {}).p_government_only).toBe(true);
    expect(parseJobsSearchParams({ gov: "yes" }).government).toBe(false);
  });
  it("experience_max=0 va remote to'g'ri uzatiladi, limit sozlanadi", () => {
    const params = parseJobsSearchParams({ experience_max: "0", remote: "1", format: "unofficial", salary_min: "3000000" });
    const args = toSearchVacanciesArgs(params, {}, 5);
    expect(args.p_experience_max_months).toBe(0);
    expect(args.p_is_remote).toBe(true);
    expect(args.p_work_format).toBe("unofficial");
    expect(args.p_salary_min).toBe(3_000_000);
    expect(args.p_limit).toBe(5);
    expect(args.p_offset).toBe(0);
  });
});

describe("matchQueryToCategory", () => {
  const categories = [
    { id: "c1", slug: "sales", name_uz: "Savdo", name_ru: "Продажи" },
    { id: "c2", slug: "it", name_uz: "IT va dasturlash", name_ru: "IT и программирование" },
  ];
  const subcategories = [
    { id: "s1", category_id: "c1", slug: "cashier", name_uz: "Kassir", name_ru: "Кассир" },
    { id: "s2", category_id: "c2", slug: "frontend", name_uz: "Frontend dasturchi", name_ru: "Frontend-разработчик" },
  ];
  it("kategoriya nomi (uz/ru, harf farqsiz)", () => {
    expect(matchQueryToCategory("savdo", categories, subcategories)?.category.slug).toBe("sales");
    expect(matchQueryToCategory("ПРОДАЖИ", categories, subcategories)?.category.slug).toBe("sales");
    expect(matchQueryToCategory("  it va   dasturlash ", categories, subcategories)?.category.slug).toBe("it");
  });
  it("yo'nalish nomi → ota kategoriya + yo'nalish", () => {
    const m = matchQueryToCategory("Кассир", categories, subcategories);
    expect(m?.category.slug).toBe("sales");
    expect(m?.subcategory?.slug).toBe("cashier");
  });
  it("mos kelmasa null", () => {
    expect(matchQueryToCategory("kassir kerak", categories, subcategories)).toBeNull();
    expect(matchQueryToCategory("k", categories, subcategories)).toBeNull();
  });
});

describe("imkoniyat turi va talabalar filtri", () => {
  it("opportunity va students URL ↔ RPC", () => {
    const p = parseJobsSearchParams({ opportunity: "internship,apprenticeship,bad", students: "1" });
    expect(p.opportunity).toEqual(["internship", "apprenticeship"]);
    expect(p.students).toBe(true);
    const args = toSearchVacanciesArgs(p, {});
    expect(args.p_opportunity_types).toEqual(["internship", "apprenticeship"]);
    expect(args.p_student_friendly).toBe(true);
    expect(serializeJobsSearchParams(p)).toContain("opportunity=internship%2Capprenticeship");
  });
});
