import { describe, expect, test } from "vitest";
import {
  WEIGHTS,
  ageFromBirthDate,
  ceilKm,
  computeMatch,
  createMatchEngine,
  distanceKm,
  educationRank,
  experienceLevelMonths,
  languageLevelRank,
  matchTone,
  professionRelation,
  roundNumeric,
  ruleBasedEngine,
  summarizeReasons,
} from "./engine";
import type { MatchReason, MatchResult, VacancyMatchInput, WorkerMatchInput, WorkerMatchPreferences } from "./types";

/** Determinizm uchun qat'iy "hozir" (UTC). */
const NOW = new Date("2026-09-26T12:00:00Z");

// Toshkent tumanlari (seed'dagi koordinatalar)
const CHILONZOR = { lat: 41.2753, lng: 69.204 };
const MIROBOD = { lat: 41.287, lng: 69.287 }; // ~7.06 km → km 8
const NEAR = { lat: 41.29, lng: 69.22 }; // ~2.1 km → km 3
const SAMARKAND = { lat: 39.6542, lng: 66.9597 }; // ~261.8 km

function perfectPreferences(): WorkerMatchPreferences {
  return {
    employmentTypes: ["full_time", "part_time"],
    schedules: ["5_2", "2_2"],
    salaryMin: 4_000_000,
    salaryExpected: 6_000_000,
    salaryType: "monthly",
  };
}

function perfectWorker(): WorkerMatchInput {
  return {
    categoryId: "cat-sales",
    subcategoryId: "sub-manager",
    districtId: "d-chilonzor",
    regionId: "r-tashkent",
    workDistrictIds: ["d-yakkasaroy"],
    remotePreference: "any",
    workFormat: "official",
    experienceLevel: "1_2y", // 24 oy
    birthDate: "1995-06-15", // 31 yosh (NOW)
    preferences: perfectPreferences(),
    skillIds: ["s-pos", "s-cash", "s-click"],
    languages: [
      { code: "uz", level: "native" },
      { code: "ru", level: "b2" },
      { code: "en", level: "a2" },
    ],
    educationLevels: ["vocational"],
    geo: { ...CHILONZOR },
  };
}

function perfectVacancy(): VacancyMatchInput {
  return {
    categoryId: "cat-sales",
    subcategoryId: "sub-manager",
    districtId: "d-chilonzor",
    regionId: "r-tashkent",
    isRemote: false,
    lat: CHILONZOR.lat,
    lng: CHILONZOR.lng,
    salaryFrom: 5_000_000,
    salaryTo: 7_000_000,
    salaryNegotiable: false,
    salaryType: "monthly",
    experienceMinMonths: 12,
    employmentType: "full_time",
    schedule: "5_2",
    workFormat: "official",
    skills: [
      { skillId: "s-pos", isRequired: true },
      { skillId: "s-cash", isRequired: true },
      { skillId: "s-1c", isRequired: false }, // ixtiyoriy — nomzodda yo'q, hisobga olinmaydi
    ],
    languages: [
      { code: "ru", minLevel: "b1" },
      { code: "uz", minLevel: "b1" },
    ],
    educationMin: "secondary",
    ageMin: 20,
    ageMax: 40,
  };
}

const PERFECT_REASONS: MatchReason[] = [
  { key: "category_match", ok: true },
  { key: "district_match", ok: true, km: 1 },
  { key: "salary_ok", ok: true },
  { key: "experience_ok", ok: true },
  { key: "skills_matched", ok: true, matched: 2, required: 2 },
  { key: "schedule_ok", ok: true },
  { key: "employment_ok", ok: true },
  { key: "work_format_ok", ok: true },
  { key: "languages_ok", ok: true },
];

function run(w: Partial<WorkerMatchInput> = {}, v: Partial<VacancyMatchInput> = {}): MatchResult {
  return computeMatch({ ...perfectWorker(), ...w }, { ...perfectVacancy(), ...v }, { now: NOW });
}

function skills(required: string[], optional: string[] = []): VacancyMatchInput["skills"] {
  return [...required.map((skillId) => ({ skillId, isRequired: true })), ...optional.map((skillId) => ({ skillId, isRequired: false }))];
}

function find(result: MatchResult, key: string): MatchReason | undefined {
  return result.reasons.find((item) => item.key === key);
}

function keys(result: MatchResult): string[] {
  return result.reasons.map((item) => item.key);
}

describe("WEIGHTS", () => {
  test("sum to 100", () => {
    expect(Object.values(WEIGHTS).reduce((a, b) => a + b, 0)).toBe(100);
  });
});

describe("helpers", () => {
  test("experienceLevelMonths mirrors public.experience_level_months (upper bounds)", () => {
    expect(experienceLevelMonths("none")).toBe(0);
    expect(experienceLevelMonths("lt_6m")).toBe(6);
    expect(experienceLevelMonths("6_12m")).toBe(12);
    expect(experienceLevelMonths("1_2y")).toBe(24);
    expect(experienceLevelMonths("2_3y")).toBe(36);
    expect(experienceLevelMonths("3_5y")).toBe(60);
    expect(experienceLevelMonths("5y_plus")).toBe(96);
  });

  test("educationRank mirrors public.education_rank", () => {
    expect(educationRank("secondary")).toBe(1);
    expect(educationRank("vocational")).toBe(2);
    expect(educationRank("incomplete_higher")).toBe(3);
    expect(educationRank("higher")).toBe(4);
    expect(educationRank("master")).toBe(5);
    expect(educationRank(null)).toBe(0);
  });

  test("languageLevelRank mirrors public.language_level_rank", () => {
    expect(["a1", "a2", "b1", "b2", "c1", "c2", "native"].map((l) => languageLevelRank(l as "a1"))).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(languageLevelRank(null)).toBe(0);
  });

  test("distanceKm is the SQL haversine (R = 6371)", () => {
    expect(distanceKm(null, 1, 1, 1)).toBeNull();
    expect(distanceKm(1, 1, 1, null)).toBeNull();
    expect(distanceKm(CHILONZOR.lat, CHILONZOR.lng, CHILONZOR.lat, CHILONZOR.lng)).toBe(0);
    expect(distanceKm(CHILONZOR.lat, CHILONZOR.lng, MIROBOD.lat, MIROBOD.lng)).toBeCloseTo(7.056519373471198, 9);
    expect(distanceKm(CHILONZOR.lat, CHILONZOR.lng, SAMARKAND.lat, SAMARKAND.lng)).toBeCloseTo(261.78463970914237, 9);
  });

  test("ceilKm mirrors greatest(1, ceil(km))", () => {
    expect(ceilKm(0)).toBe(1);
    expect(ceilKm(0.3)).toBe(1);
    expect(ceilKm(1)).toBe(1);
    expect(ceilKm(1.0001)).toBe(2);
    expect(ceilKm(7.056519373471198)).toBe(8);
    expect(ceilKm(15)).toBe(15);
  });

  test("roundNumeric rounds half away from zero like Postgres round(numeric)", () => {
    expect(roundNumeric(2.5)).toBe(3);
    expect(roundNumeric(3.5)).toBe(4);
    expect(roundNumeric(-2.5)).toBe(-3);
    expect(roundNumeric(7.5)).toBe(8);
    expect(roundNumeric(0)).toBe(0);
    expect(roundNumeric(-0.2)).toBe(0);
    // ko'nikma/til nisbatlari
    expect(roundNumeric((15 * 1) / 3)).toBe(5);
    expect(roundNumeric((15 * 2) / 3)).toBe(10);
    expect(roundNumeric((15 * 1) / 2)).toBe(8);
    expect(roundNumeric((15 * 1) / 6)).toBe(3);
    expect(roundNumeric((5 * 1) / 2)).toBe(3);
    expect(roundNumeric((5 * 1) / 3)).toBe(2);
    expect(roundNumeric((5 * 2) / 3)).toBe(3);
    // o'nlik — float8::numeric (15 muhim raqam) so'ng yaxlitlash
    expect(roundNumeric(1.15, 1)).toBe(1.2);
    expect(roundNumeric(3.25, 1)).toBe(3.3);
    expect(roundNumeric(0.04, 1)).toBe(0);
    expect(roundNumeric(0.05, 1)).toBe(0.1);
  });

  test("ageFromBirthDate mirrors extract(year from age(birth_date))", () => {
    expect(ageFromBirthDate("1995-06-15", NOW)).toBe(31);
    expect(ageFromBirthDate("1995-06-15", new Date("2026-06-14T23:00:00Z"))).toBe(30);
    expect(ageFromBirthDate("1995-06-15", new Date("2026-06-15T00:00:00Z"))).toBe(31);
    expect(ageFromBirthDate("2000-02-29", new Date("2024-02-28T00:00:00Z"))).toBe(23);
    expect(ageFromBirthDate("2000-02-29", new Date("2024-03-01T00:00:00Z"))).toBe(24);
    expect(ageFromBirthDate("1995-06-15T00:00:00Z", NOW)).toBe(31);
    expect(ageFromBirthDate("abc", NOW)).toBeNull();
    expect(ageFromBirthDate("1995-13-01", NOW)).toBeNull();
  });
});

describe("computeMatch — perfect match", () => {
  test("scores 100 with the expected reasons in SQL order", () => {
    const result = run();
    expect(result.score).toBe(100);
    expect(result.reasons).toEqual(PERFECT_REASONS);
  });
});

describe("computeMatch — 1. category (25)", () => {
  test("mismatch loses 25", () => {
    const result = run({ categoryId: "cat-it" });
    expect(result.score).toBe(75);
    expect(result.reasons[0]).toEqual({ key: "category_mismatch", ok: false });
  });

  test("null category on either side is a mismatch (SQL null = x is not true)", () => {
    expect(find(run({ categoryId: null }), "category_mismatch")).toBeDefined();
    expect(find(run({}, { categoryId: null }), "category_mismatch")).toBeDefined();
    expect(find(run({ categoryId: null }, { categoryId: null }), "category_mismatch")).toBeDefined();
  });

  test("subcategory differs → partial 18 with warn", () => {
    const result = run({}, { subcategoryId: "sub-agent" });
    expect(result.score).toBe(93);
    expect(result.reasons[0]).toEqual({ key: "category_match_partial", ok: "warn" });
  });

  test("worker without subcategory but vacancy requires one → partial", () => {
    const result = run({ subcategoryId: null });
    expect(result.score).toBe(93);
    expect(result.reasons[0]?.key).toBe("category_match_partial");
  });

  test("vacancy without subcategory → full match", () => {
    const result = run({ subcategoryId: "sub-other" }, { subcategoryId: null });
    expect(result.score).toBe(100);
    expect(result.reasons[0]?.key).toBe("category_match");
  });
});

describe("computeMatch — 2. location (15)", () => {
  test("remote vacancy + worker 'any'/'yes' → remote_ok regardless of geo/district", () => {
    const any = run({ districtId: null, regionId: null, geo: null, workDistrictIds: [] }, { isRemote: true });
    expect(any.score).toBe(100);
    expect(any.reasons[1]).toEqual({ key: "remote_ok", ok: true });
    expect(find(run({ remotePreference: "yes" }, { isRemote: true }), "remote_ok")).toBeDefined();
  });

  test("remote vacancy + worker 'no' → falls through to district logic", () => {
    const result = run({ remotePreference: "no" }, { isRemote: true });
    expect(find(result, "remote_ok")).toBeUndefined();
    expect(find(result, "district_match")).toEqual({ key: "district_match", ok: true, km: 1 });
  });

  test("worker 'yes' + on-site vacancy → 5 remote_preferred (warn), district is not considered", () => {
    const result = run({ remotePreference: "yes" });
    expect(result.score).toBe(90);
    expect(result.reasons[1]).toEqual({ key: "remote_preferred", ok: "warn" });
    expect(find(result, "district_match")).toBeUndefined();
  });

  test("district match via worker_locations", () => {
    const result = run({ districtId: "d-other" }, { districtId: "d-yakkasaroy", lat: null, lng: null });
    expect(result.score).toBe(100);
    expect(find(result, "district_match")).toEqual({ key: "district_match", ok: true, km: null });
  });

  test("district match keeps km (integer, ≥1) when geo is known, null otherwise", () => {
    expect(find(run({}, { lat: MIROBOD.lat, lng: MIROBOD.lng }), "district_match")).toEqual({ key: "district_match", ok: true, km: 8 });
    expect(find(run({ geo: null }), "district_match")).toEqual({ key: "district_match", ok: true, km: null });
    expect(find(run({}, { lat: null, lng: null }), "district_match")).toEqual({ key: "district_match", ok: true, km: null });
  });

  test("distance ≤ 5 km → 15 distance_near", () => {
    const result = run({}, { districtId: "d-other", ...NEAR });
    expect(result.score).toBe(100);
    expect(find(result, "distance_near")).toEqual({ key: "distance_near", ok: true, km: 3 });
  });

  test("distance ≤ 15 km → 10 distance_ok (warn)", () => {
    const result = run({}, { districtId: "d-other", ...MIROBOD });
    expect(result.score).toBe(95);
    expect(find(result, "distance_ok")).toEqual({ key: "distance_ok", ok: "warn", km: 8 });
  });

  test("same region only → 8 region_match (warn)", () => {
    const result = run({}, { districtId: "d-other", lat: null, lng: null });
    expect(result.score).toBe(93);
    expect(find(result, "region_match")).toEqual({ key: "region_match", ok: "warn" });
    // > 15 km but same region → still region_match
    expect(find(run({}, { districtId: "d-other", ...SAMARKAND }), "region_match")).toBeDefined();
  });

  test("far → 0 location_far", () => {
    const result = run({}, { districtId: "d-sam", regionId: "r-samarkand", ...SAMARKAND });
    expect(result.score).toBe(85);
    expect(find(result, "location_far")).toEqual({ key: "location_far", ok: false });
    // vacancy without district/region/coords
    expect(find(run({}, { districtId: null, regionId: null, lat: null, lng: null }), "location_far")).toBeDefined();
  });
});

describe("computeMatch — 3. salary (15)", () => {
  test("worker without preferences → 10 salary_unspecified (warn)", () => {
    const result = run({ preferences: null });
    // preferences=null also makes schedule/employment ok, so only salary loses 5
    expect(result.score).toBe(95);
    expect(find(result, "salary_unspecified")).toEqual({ key: "salary_unspecified", ok: "warn" });
  });

  test("preferences with no salary → salary_unspecified", () => {
    const result = run({ preferences: { ...perfectPreferences(), salaryMin: null, salaryExpected: null } });
    expect(result.score).toBe(95);
    expect(find(result, "salary_unspecified")).toBeDefined();
  });

  test("negotiable vacancy → 8 salary_negotiable (warn), checked before salary type", () => {
    const result = run({}, { salaryNegotiable: true, salaryType: "daily" });
    expect(result.score).toBe(93);
    expect(find(result, "salary_negotiable")).toEqual({ key: "salary_negotiable", ok: "warn" });
  });

  test("vacancy without salary → salary_negotiable", () => {
    const result = run({}, { salaryFrom: null, salaryTo: null });
    expect(result.score).toBe(93);
    expect(find(result, "salary_negotiable")).toBeDefined();
  });

  test("different salary types → 8 salary_type_differs (warn) with vacancy_type", () => {
    const result = run({}, { salaryType: "daily" });
    expect(result.score).toBe(93);
    expect(find(result, "salary_type_differs")).toEqual({ key: "salary_type_differs", ok: "warn", vacancy_type: "daily" });
    expect(find(run({ preferences: { ...perfectPreferences(), salaryType: "hourly" } }), "salary_type_differs")).toEqual({
      key: "salary_type_differs",
      ok: "warn",
      vacancy_type: "monthly",
    });
  });

  test("'negotiable' salary type on either side skips the type check", () => {
    expect(find(run({}, { salaryType: "negotiable" }), "salary_ok")).toBeDefined();
    expect(find(run({ preferences: { ...perfectPreferences(), salaryType: "negotiable" } }, { salaryType: "daily" }), "salary_ok")).toBeDefined();
    expect(find(run({ preferences: { ...perfectPreferences(), salaryType: "piecework" } }, { salaryType: "piecework" }), "salary_ok")).toBeDefined();
  });

  test("vacancy max ≥ expected → 15 salary_ok", () => {
    expect(find(run({}, { salaryTo: 6_000_000 }), "salary_ok")).toEqual({ key: "salary_ok", ok: true });
    // salary_to null → salary_from is used
    expect(find(run({}, { salaryFrom: 6_000_000, salaryTo: null }), "salary_ok")).toBeDefined();
  });

  test("vacancy max ≥ min but < expected → 12 salary_min_ok", () => {
    const result = run({}, { salaryTo: 5_000_000 });
    expect(result.score).toBe(97);
    expect(find(result, "salary_min_ok")).toEqual({ key: "salary_min_ok", ok: true });
  });

  test("below minimum → 0 salary_below with vacancy_max/worker_min", () => {
    const result = run({}, { salaryFrom: 3_000_000, salaryTo: 3_500_000 });
    expect(result.score).toBe(85);
    expect(find(result, "salary_below")).toEqual({ key: "salary_below", ok: false, vacancy_max: 3_500_000, worker_min: 4_000_000 });
  });

  test("coalesce semantics: expected falls back to min, min falls back to expected", () => {
    // expected null → threshold is min → salary_ok at exactly min
    expect(find(run({ preferences: { ...perfectPreferences(), salaryExpected: null } }, { salaryTo: 4_000_000 }), "salary_ok")).toBeDefined();
    // min null → worker_min = expected
    expect(find(run({ preferences: { ...perfectPreferences(), salaryMin: null } }, { salaryTo: 5_000_000 }), "salary_below")).toEqual({
      key: "salary_below",
      ok: false,
      vacancy_max: 5_000_000,
      worker_min: 6_000_000,
    });
  });
});

describe("computeMatch — 4. experience (10)", () => {
  test("months ≥ required → 10 experience_ok", () => {
    expect(find(run({}, { experienceMinMonths: 24 }), "experience_ok")).toEqual({ key: "experience_ok", ok: true });
    expect(find(run({ experienceLevel: "none" }, { experienceMinMonths: 0 }), "experience_ok")).toBeDefined();
    expect(find(run({ experienceLevel: "5y_plus" }, { experienceMinMonths: 96 }), "experience_ok")).toBeDefined();
  });

  test("within 6 months → 5 experience_close (warn) with required_months", () => {
    const result = run({}, { experienceMinMonths: 30 });
    expect(result.score).toBe(95);
    expect(find(result, "experience_close")).toEqual({ key: "experience_close", ok: "warn", required_months: 30 });
    expect(find(run({ experienceLevel: "none" }, { experienceMinMonths: 6 }), "experience_close")).toBeDefined();
  });

  test("too low → 0 experience_low with required_months", () => {
    const result = run({}, { experienceMinMonths: 31 });
    expect(result.score).toBe(90);
    expect(find(result, "experience_low")).toEqual({ key: "experience_low", ok: false, required_months: 31 });
    expect(find(run({ experienceLevel: "5y_plus" }, { experienceMinMonths: 240 }), "experience_low")).toBeDefined();
  });
});

describe("computeMatch — 5. skills (15)", () => {
  test("no skills at all → 15 skills_not_required", () => {
    const result = run({}, { skills: [] });
    expect(result.score).toBe(100);
    expect(find(result, "skills_not_required")).toEqual({ key: "skills_not_required", ok: true });
    expect(find(result, "skills_matched")).toBeUndefined();
  });

  test("only required skills count when any exist; optional ones are ignored", () => {
    const result = run({}, { skills: skills(["s-pos", "s-cash"], ["s-x", "s-y", "s-z"]) });
    expect(result.score).toBe(100);
    expect(find(result, "skills_matched")).toEqual({ key: "skills_matched", ok: true, matched: 2, required: 2 });
    const half = run({}, { skills: skills(["s-pos", "s-x"], ["s-cash"]) });
    expect(half.score).toBe(93); // round(7.5) = 8
    expect(find(half, "skills_matched")).toEqual({ key: "skills_matched", ok: "warn", matched: 1, required: 2 });
  });

  test("no required skills but optional ones → ratio over all skills", () => {
    const result = run({}, { skills: skills([], ["s-pos", "s-cash", "s-y"]) });
    expect(result.score).toBe(95);
    expect(find(result, "skills_matched")).toEqual({ key: "skills_matched", ok: "warn", matched: 2, required: 3 });
    const none = run({}, { skills: skills([], ["s-x"]) });
    expect(none.score).toBe(85);
    expect(find(none, "skills_matched")).toEqual({ key: "skills_matched", ok: false, matched: 0, required: 1 });
  });

  test("ratio rounding: 1 of 3 → 5, 2 of 3 → 10 (warn)", () => {
    const one = run({}, { skills: skills(["s-pos", "s-x", "s-y"]) });
    expect(one.score).toBe(90);
    expect(find(one, "skills_matched")).toEqual({ key: "skills_matched", ok: "warn", matched: 1, required: 3 });
    const two = run({}, { skills: skills(["s-pos", "s-cash", "s-y"]) });
    expect(two.score).toBe(95);
    expect(find(two, "skills_matched")).toEqual({ key: "skills_matched", ok: "warn", matched: 2, required: 3 });
  });

  test("half rounds away from zero: 1 of 2 → 8, 1 of 6 → 3", () => {
    expect(run({}, { skills: skills(["s-pos", "s-x"]) }).score).toBe(93);
    expect(run({}, { skills: skills(["s-pos", "a", "b", "c", "d", "e"]) }).score).toBe(88);
  });

  test("none matched → 0 with ok=false", () => {
    const result = run({}, { skills: skills(["s-x", "s-y"]) });
    expect(result.score).toBe(85);
    expect(find(result, "skills_matched")).toEqual({ key: "skills_matched", ok: false, matched: 0, required: 2 });
  });

  test("duplicate ids are counted once (PK semantics)", () => {
    const result = run({ skillIds: ["s-pos", "s-pos"] }, { skills: skills(["s-pos", "s-pos"]) });
    expect(find(result, "skills_matched")).toEqual({ key: "skills_matched", ok: true, matched: 1, required: 1 });
  });
});

describe("computeMatch — 6. schedule (10)", () => {
  test("ok: matching, no preferences, empty schedules, or 'negotiable' in worker schedules", () => {
    expect(find(run(), "schedule_ok")).toEqual({ key: "schedule_ok", ok: true });
    expect(find(run({ preferences: null }, { schedule: "6_1" }), "schedule_ok")).toBeDefined();
    expect(find(run({ preferences: { ...perfectPreferences(), schedules: [] } }, { schedule: "6_1" }), "schedule_ok")).toBeDefined();
    expect(find(run({ preferences: { ...perfectPreferences(), schedules: ["negotiable"] } }, { schedule: "6_1" }), "schedule_ok")).toBeDefined();
  });

  test("partial 5 (warn): worker flexible, or vacancy flexible/negotiable", () => {
    const flexWorker = run({ preferences: { ...perfectPreferences(), schedules: ["flexible"] } }, { schedule: "6_1" });
    expect(flexWorker.score).toBe(95);
    expect(find(flexWorker, "schedule_partial")).toEqual({ key: "schedule_partial", ok: "warn" });
    expect(find(run({}, { schedule: "flexible" }), "schedule_partial")).toBeDefined();
    expect(find(run({}, { schedule: "negotiable" }), "schedule_partial")).toBeDefined();
  });

  test("mismatch → 0 with vacancy_schedule", () => {
    const result = run({}, { schedule: "6_1" });
    expect(result.score).toBe(90);
    expect(find(result, "schedule_mismatch")).toEqual({ key: "schedule_mismatch", ok: false, vacancy_schedule: "6_1" });
  });
});

describe("computeMatch — 7. employment (3) + work format (2)", () => {
  test("employment ok: matching, no preferences, empty list", () => {
    expect(find(run(), "employment_ok")).toEqual({ key: "employment_ok", ok: true });
    expect(find(run({ preferences: null }, { employmentType: "shift" }), "employment_ok")).toBeDefined();
    expect(find(run({ preferences: { ...perfectPreferences(), employmentTypes: [] } }, { employmentType: "shift" }), "employment_ok")).toBeDefined();
  });

  test("employment mismatch → 0 with vacancy_type", () => {
    const result = run({}, { employmentType: "temporary" });
    expect(result.score).toBe(97);
    expect(find(result, "employment_mismatch")).toEqual({ key: "employment_mismatch", ok: false, vacancy_type: "temporary" });
  });

  test("work format: 'any' on either side or equal → 2, otherwise 0 with vacancy_format", () => {
    expect(find(run({ workFormat: "any" }, { workFormat: "unofficial" }), "work_format_ok")).toEqual({ key: "work_format_ok", ok: true });
    expect(find(run({ workFormat: "unofficial" }, { workFormat: "any" }), "work_format_ok")).toBeDefined();
    const result = run({}, { workFormat: "unofficial" });
    expect(result.score).toBe(98);
    expect(find(result, "work_format_mismatch")).toEqual({ key: "work_format_mismatch", ok: false, vacancy_format: "unofficial" });
  });
});

describe("computeMatch — 8. languages (5)", () => {
  test("no languages required → +5 and no language reason", () => {
    const result = run({}, { languages: [] });
    expect(result.score).toBe(100);
    expect(keys(result).some((k) => k.startsWith("language"))).toBe(false);
    expect(result.reasons).toHaveLength(8);
  });

  test("all satisfied → languages_ok; equal level counts", () => {
    expect(find(run(), "languages_ok")).toEqual({ key: "languages_ok", ok: true });
    expect(find(run({}, { languages: [{ code: "ru", minLevel: "b2" }] }), "languages_ok")).toBeDefined();
  });

  test("partial: round(2.5)=3 for 1 of 2, plus languages_partial after language_required", () => {
    const half = run({}, { languages: [{ code: "en", minLevel: "b2" }, { code: "ru", minLevel: "b1" }] });
    expect(half.score).toBe(98);
    expect(half.reasons.slice(-2)).toEqual([
      { key: "language_required", ok: false, lang: "en", level: "b2" },
      { key: "languages_partial", ok: "warn", matched: 1, required: 2 },
    ]);
    expect(find(half, "languages_ok")).toBeUndefined();
    const third = run({}, { languages: [{ code: "en", minLevel: "b2" }, { code: "ru", minLevel: "b1" }, { code: "tr", minLevel: "a1" }] });
    expect(third.score).toBe(97);
    expect(find(third, "languages_partial")).toEqual({ key: "languages_partial", ok: "warn", matched: 1, required: 3 });
  });

  test("level below minimum → language_required, no partial when nothing matched", () => {
    const result = run({}, { languages: [{ code: "ru", minLevel: "c1" }] });
    expect(result.score).toBe(95);
    expect(find(result, "language_required")).toEqual({ key: "language_required", ok: false, lang: "ru", level: "c1" });
    expect(find(result, "languages_partial")).toBeUndefined();
  });

  test("all missing → 0, reasons in vacancy order, no languages_partial", () => {
    const result = run({}, { languages: [{ code: "tr", minLevel: "b1" }, { code: "de", minLevel: "a2" }] });
    expect(result.score).toBe(95);
    expect(keys(result).slice(-2)).toEqual(["language_required", "language_required"]);
    expect(result.reasons.filter((item) => item.key === "language_required")).toEqual([
      { key: "language_required", ok: false, lang: "tr", level: "b1" },
      { key: "language_required", ok: false, lang: "de", level: "a2" },
    ]);
    expect(find(result, "languages_partial")).toBeUndefined();
  });
});

describe("computeMatch — warnings do not change the score", () => {
  test("education_required when no education meets the minimum", () => {
    const result = run({}, { educationMin: "higher" });
    expect(result.score).toBe(100);
    expect(find(result, "education_required")).toEqual({ key: "education_required", ok: "warn", level: "higher" });
    expect(find(run({ educationLevels: [] }, { educationMin: "secondary" }), "education_required")).toBeDefined();
    expect(find(run({}, { educationMin: "vocational" }), "education_required")).toBeUndefined();
    expect(find(run({}, { educationMin: null }), "education_required")).toBeUndefined();
  });

  test("age_out_of_range keeps null bounds (jsonb_build_object keeps nulls)", () => {
    const tooOld = run({}, { ageMax: 25 });
    expect(tooOld.score).toBe(100);
    expect(find(tooOld, "age_out_of_range")).toEqual({ key: "age_out_of_range", ok: "warn", min: 20, max: 25 });
    expect(find(run({}, { ageMin: 35, ageMax: null }), "age_out_of_range")).toEqual({ key: "age_out_of_range", ok: "warn", min: 35, max: null });
    expect(find(run({}, { ageMin: null, ageMax: 30 }), "age_out_of_range")).toEqual({ key: "age_out_of_range", ok: "warn", min: null, max: 30 });
  });

  test("no age warning without birth date, without bounds, or when in range", () => {
    expect(find(run({ birthDate: null }, { ageMax: 25 }), "age_out_of_range")).toBeUndefined();
    expect(find(run({}, { ageMin: null, ageMax: null }), "age_out_of_range")).toBeUndefined();
    expect(find(run(), "age_out_of_range")).toBeUndefined();
  });

  test("age depends on `now`", () => {
    const young = computeMatch(perfectWorker(), perfectVacancy(), { now: new Date("2015-01-01T00:00:00Z") });
    expect(find(young, "age_out_of_range")).toEqual({ key: "age_out_of_range", ok: "warn", min: 20, max: 40 });
  });

  test("warnings are appended last, in SQL order (education, then age)", () => {
    const result = run({}, { educationMin: "master", ageMax: 25 });
    expect(keys(result).slice(-2)).toEqual(["education_required", "age_out_of_range"]);
  });
});

describe("computeMatch — clamp and determinism", () => {
  test("worst case is exactly 0 and never negative", () => {
    const result = run(
      { categoryId: "cat-it", regionId: "r-other", geo: null, workDistrictIds: [], workFormat: "unofficial" },
      {
        districtId: "d-x",
        regionId: "r-y",
        lat: null,
        lng: null,
        salaryFrom: 1_000_000,
        salaryTo: 1_000_000,
        experienceMinMonths: 120,
        skills: skills(["s-none"]),
        schedule: "6_1",
        employmentType: "internship",
        workFormat: "official",
        languages: [{ code: "de", minLevel: "c2" }],
        educationMin: "master",
        ageMax: 18,
      },
    );
    expect(result.score).toBe(0);
    expect(summarizeReasons(result.reasons)).toEqual({ positives: 0, warnings: 2, negatives: 9 });
  });

  test("score is always an integer in 0..100", () => {
    const variants: Array<[Partial<WorkerMatchInput>, Partial<VacancyMatchInput>]> = [
      [{}, {}],
      [{ preferences: null }, { skills: skills(["a", "b", "c", "d", "e", "f", "g"]) }],
      [
        { skillIds: ["a"] },
        {
          skills: skills([], ["a", "b", "c", "d", "e", "f", "g"]),
          languages: [{ code: "uz", minLevel: "a1" }, { code: "x", minLevel: "a1" }, { code: "y", minLevel: "a1" }],
        },
      ],
      [{ categoryId: null, remotePreference: "yes" }, { salaryNegotiable: true }],
      [{ categoryId: null }, { isRemote: true, salaryNegotiable: true }],
    ];
    for (const [w, v] of variants) {
      const { score } = run(w, v);
      expect(Number.isInteger(score)).toBe(true);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });

  test("same inputs → identical output, inputs untouched", () => {
    const w = perfectWorker();
    const v = perfectVacancy();
    const before = structuredClone({ w, v });
    const a = computeMatch(w, v, { now: NOW });
    const b = computeMatch(w, v, { now: NOW });
    expect(a).toEqual(b);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect({ w, v }).toEqual(before);
  });
});

describe("engine API", () => {
  test("ruleBasedEngine / createMatchEngine", () => {
    expect(ruleBasedEngine.name).toBe("rule_based");
    expect(createMatchEngine()).toBe(ruleBasedEngine);
    expect(createMatchEngine("rule_based").compute(perfectWorker(), perfectVacancy(), { now: NOW })).toEqual(run());
  });

  test("matchTone thresholds", () => {
    expect(matchTone(100)).toBe("high");
    expect(matchTone(75)).toBe("high");
    expect(matchTone(74)).toBe("medium");
    expect(matchTone(50)).toBe("medium");
    expect(matchTone(49)).toBe("low");
    expect(matchTone(0)).toBe("low");
  });

  test("summarizeReasons counts ok/warn/false", () => {
    expect(summarizeReasons(PERFECT_REASONS)).toEqual({ positives: 9, warnings: 0, negatives: 0 });
    expect(
      summarizeReasons([
        { key: "a", ok: true },
        { key: "b", ok: "warn" },
        { key: "c", ok: false },
        { key: "d", ok: false },
      ]),
    ).toEqual({ positives: 1, warnings: 1, negatives: 2 });
    expect(summarizeReasons([])).toEqual({ positives: 0, warnings: 0, negatives: 0 });
  });
});

describe("kasblar daraxti (profession_relation)", () => {
  const MED = "n-med", DOC = "n-doctors", SURG = "n-surgery", CARD = "n-cardiac", URO = "n-urolog", NURSE = "n-nurse";
  test("munosabat darajalari", () => {
    expect(professionRelation([MED, DOC, SURG, CARD], [MED, DOC, SURG, CARD])).toBe(3);
    expect(professionRelation([MED, DOC, SURG, CARD], [MED, DOC, SURG])).toBe(2);
    expect(professionRelation([MED, DOC], [MED, DOC, SURG])).toBe(1);
    expect(professionRelation([MED, DOC, URO], [MED, DOC, SURG])).toBe(0);
    expect(professionRelation([NURSE], [MED, DOC])).toBe(-1);
    expect(professionRelation([], [MED])).toBeNull();
  });
  test("aynan kasb — 25, boshqa shoxdagi shifokor — kam", () => {
    const exact = run({ professionPaths: [[DOC, SURG, CARD]] }, { professionPath: [DOC, SURG, CARD] });
    expect(find(exact, "profession_exact")?.ok).toBe(true);
    const sibling = run({ professionPaths: [[DOC, URO]] }, { professionPath: [DOC, SURG, CARD] });
    expect(find(sibling, "profession_related")?.ok).toBe("warn");
    expect(exact.score - sibling.score).toBe(13);
    const other = run({ professionPaths: [[NURSE]] }, { professionPath: [DOC, SURG, CARD] });
    expect(find(other, "profession_other_branch")).toBeDefined();
  });
  test("qo'shimcha kasblardan eng yaqini olinadi", () => {
    const res = run({ professionPaths: [[NURSE], [DOC, SURG, CARD, "n-kids"]] }, { professionPath: [DOC, SURG, CARD] });
    expect(find(res, "profession_specialist")?.ok).toBe(true);
  });
  test("tugun bo'lmasa eski mantiq", () => {
    expect(find(run({}, { professionPath: [DOC] }), "category_match")).toBeDefined();
  });
});
