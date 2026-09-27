/**
 * Worklyn — moslik dvigateli (rule-based).
 *
 * Bu fayl `public.compute_match(worker_id, vacancy_id)` SQL funksiyasining
 * (supabase/migrations/0008_functions.sql) AYNAN nusxasi: bir xil og'irliklar,
 * bir xil darajalar (tier), bir xil yaxlitlash, bir xil sabab kalitlari/parametrlari.
 * SQL ro'yxatlarni saralash uchun (search/recommended), TS esa UI'da tushuntirish,
 * "nima uchun mos" bloklari va testlar uchun ishlatiladi.
 *
 * Ikkalasi sinxron ekanini `engine.parity.test.ts` (haqiqiy Postgres) tekshiradi.
 */
import type { Enums } from "@/types/database.types";
import type {
  MatchEngine,
  MatchEngineKind,
  MatchOptions,
  MatchReason,
  MatchResult,
  MatchTone,
  ReasonSummary,
  VacancyMatchInput,
  WorkerMatchInput,
} from "./types";

/** Og'irliklar (jami 100). SQL: kategoriya 25, joylashuv 15, maosh 15, tajriba 10, ko'nikma 15, grafik 10, bandlik 5, til 5. */
export const WEIGHTS = {
  category: 25,
  location: 15,
  salary: 15,
  experience: 10,
  skills: 15,
  schedule: 10,
  employment: 5,
  language: 5,
} as const;

// ---------------------------------------------------------------------------
// Yordamchi funksiyalar — 0001_extensions_types.sql nusxasi
// ---------------------------------------------------------------------------

/** public.experience_level_months — tajriba darajasining yuqori chegarasi (oy). */
const EXPERIENCE_LEVEL_MONTHS: Record<Enums<"experience_level">, number> = {
  none: 0,
  lt_6m: 6,
  "6_12m": 12,
  "1_2y": 24,
  "2_3y": 36,
  "3_5y": 60,
  "5y_plus": 96,
};

export function experienceLevelMonths(level: Enums<"experience_level">): number {
  return EXPERIENCE_LEVEL_MONTHS[level];
}

/** public.education_rank */
const EDUCATION_RANK: Record<Enums<"education_level">, number> = {
  secondary: 1,
  vocational: 2,
  incomplete_higher: 3,
  higher: 4,
  master: 5,
};

export function educationRank(level: Enums<"education_level"> | null | undefined): number {
  return level ? EDUCATION_RANK[level] : 0;
}

/** public.language_level_rank */
const LANGUAGE_LEVEL_RANK: Record<Enums<"language_level">, number> = {
  a1: 1,
  a2: 2,
  b1: 3,
  b2: 4,
  c1: 5,
  c2: 6,
  native: 7,
};

export function languageLevelRank(level: Enums<"language_level"> | null | undefined): number {
  return level ? LANGUAGE_LEVEL_RANK[level] : 0;
}

const EARTH_RADIUS_KM = 6371.0;

function radians(deg: number): number {
  return deg * (Math.PI / 180);
}

/** public.distance_km — haversine (R = 6371 km). Birorta koordinata null bo'lsa null. */
export function distanceKm(
  lat1: number | null,
  lng1: number | null,
  lat2: number | null,
  lng2: number | null,
): number | null {
  if (lat1 === null || lng1 === null || lat2 === null || lng2 === null) return null;
  const sinLat = Math.sin(radians(lat2 - lat1) / 2);
  const sinLng = Math.sin(radians(lng2 - lng1) / 2);
  return (
    EARTH_RADIUS_KM *
    2 *
    Math.asin(Math.sqrt(sinLat * sinLat + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * sinLng * sinLng))
  );
}

/**
 * Postgres `round(numeric[, n])` nusxasi: 0.5 noldan uzoqqa yaxlitlanadi (2.5 → 3, -2.5 → -3),
 * JS `Math.round` (2.5 → 3, -2.5 → -2) va bankir yaxlitlashidan farqli.
 * Qiymat avval float8 → numeric kabi 15 muhim raqamgacha qisqartiriladi
 * (Postgres `float8::numeric` shunday qiladi), keyin o'nlik raqamlar bo'yicha yaxlitlanadi:
 * masalan `round(1.15::float8::numeric, 1)` = 1.2 (float 1.1499999… bo'lsa ham).
 */
export function roundNumeric(value: number, decimals = 0): number {
  if (!Number.isFinite(value)) return value;
  const negative = value < 0;
  const abs = Math.abs(value);
  const text = abs.toPrecision(15);
  let result: number;
  if (text.includes("e")) {
    // |x| < 1e-6 yoki ≥ 1e21 — bunday qiymatlar uchun oddiy yaxlitlash yetarli.
    const factor = 10 ** decimals;
    result = Math.round(abs * factor) / factor;
  } else {
    const [intPart = "0", fracPart = ""] = text.split(".");
    const kept = fracPart.slice(0, decimals).padEnd(decimals, "0");
    const nextDigit = Number(fracPart[decimals] ?? "0");
    let scaled = Number(intPart + kept);
    if (nextDigit >= 5) scaled += 1;
    result = scaled / 10 ** decimals;
  }
  if (result === 0) return 0;
  return negative ? -result : result;
}

/**
 * SQL `greatest(1, ceil(km))::int` — masofa butun km gacha yuqoriga yaxlitlanadi (aniq koordinata
 * oshkor bo'lmasligi uchun), minimal qiymat 1.
 */
export function ceilKm(km: number): number {
  return Math.max(1, Math.ceil(km));
}

/**
 * Postgres `extract(year from age(birth_date))` nusxasi: to'liq yillar soni.
 * `now` ning UTC sanasi ishlatiladi (Supabase sessiyasi UTC). Noto'g'ri sana → null.
 */
export function ageFromBirthDate(birthDate: string, now: Date = new Date()): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(birthDate);
  if (!m) return null;
  const by = Number(m[1]);
  const bm = Number(m[2]);
  const bd = Number(m[3]);
  if (!Number.isFinite(by) || bm < 1 || bm > 12 || bd < 1 || bd > 31) return null;
  const ny = now.getUTCFullYear();
  const nm = now.getUTCMonth() + 1;
  const nd = now.getUTCDate();
  let age = ny - by;
  if (nm < bm || (nm === bm && nd < bd)) age -= 1;
  return age;
}

// ---------------------------------------------------------------------------
// compute_match
// ---------------------------------------------------------------------------

function reason(key: string, ok: boolean | "warn", params?: Record<string, unknown>): MatchReason {
  return { key, ok, ...params };
}

/**
 * `public.compute_match` ning TS nusxasi. Har bir blok SQL'dagi raqamlangan bo'limga mos keladi.
 * Sabablar SQL bilan bir xil tartibda qo'shiladi; natija 0..100 oralig'iga qisiladi.
 */
export function computeMatch(worker: WorkerMatchInput, vacancy: VacancyMatchInput, opts: MatchOptions = {}): MatchResult {
  const now = opts.now ?? new Date();
  const pr = worker.preferences;
  let s = 0;
  const r: MatchReason[] = [];

  // -- 1. Kategoriya (25)
  //   w.category_id is not null and w.category_id = v.category_id
  //     v.subcategory_id is null or w.subcategory_id = v.subcategory_id  → 25 category_match
  //     aks holda                                                       → 18 category_match_partial (warn)
  //   aks holda                                                         →  0 category_mismatch
  if (worker.categoryId !== null && worker.categoryId === vacancy.categoryId) {
    if (vacancy.subcategoryId === null || (worker.subcategoryId !== null && worker.subcategoryId === vacancy.subcategoryId)) {
      s += 25;
      r.push(reason("category_match", true));
    } else {
      s += 18;
      r.push(reason("category_match_partial", "warn"));
    }
  } else {
    r.push(reason("category_mismatch", false));
  }

  // -- 2. Joylashuv (15). km = greatest(1, ceil(km)) — butun son
  //   v.is_remote and w.remote_preference <> 'no'                        → 15 remote_ok
  //   w.remote_preference = 'yes' and not v.is_remote                    →  5 remote_preferred (warn)
  //   aks holda km := distance_km(worker_geo, v.lat/lng) (null bo'lishi mumkin):
  //     v.district_id = w.district_id yoki worker_locations ichida        → 15 district_match {km|null}
  //     km <= 5                                                          → 15 distance_near {km}
  //     km <= 15                                                         → 10 distance_ok {km} (warn)
  //     v.region_id = w.region_id                                        →  8 region_match (warn)
  //     aks holda                                                        →  0 location_far
  if (vacancy.isRemote && worker.remotePreference !== "no") {
    s += 15;
    r.push(reason("remote_ok", true));
  } else if (worker.remotePreference === "yes" && !vacancy.isRemote) {
    s += 5;
    r.push(reason("remote_preferred", "warn"));
  } else {
    const km = worker.geo ? distanceKm(worker.geo.lat, worker.geo.lng, vacancy.lat, vacancy.lng) : null;
    const districtMatch =
      vacancy.districtId !== null &&
      (vacancy.districtId === worker.districtId || worker.workDistrictIds.includes(vacancy.districtId));
    if (districtMatch) {
      s += 15;
      r.push(reason("district_match", true, { km: km !== null ? ceilKm(km) : null }));
    } else if (km !== null && km <= 5) {
      s += 15;
      r.push(reason("distance_near", true, { km: ceilKm(km) }));
    } else if (km !== null && km <= 15) {
      s += 10;
      r.push(reason("distance_ok", "warn", { km: ceilKm(km) }));
    } else if (vacancy.regionId !== null && vacancy.regionId === worker.regionId) {
      s += 8;
      r.push(reason("region_match", "warn"));
    } else {
      r.push(reason("location_far", false));
    }
  }

  // -- 3. Maosh (15). Turlari (oylik/kunlik/soatlik) farq qilsa taqqoslanmaydi
  //   worker_min := coalesce(pr.salary_min, pr.salary_expected)
  //   worker_min is null                                                 → 10 salary_unspecified (warn)
  //   v.salary_negotiable or (from is null and to is null)               →  8 salary_negotiable (warn)
  //   pr.salary_type <> 'negotiable' and v.salary_type <> 'negotiable'
  //     and pr.salary_type <> v.salary_type                              →  8 salary_type_differs {vacancy_type} (warn)
  //   coalesce(to, from) >= coalesce(pr.salary_expected, worker_min)     → 15 salary_ok
  //   coalesce(to, from) >= worker_min                                   → 12 salary_min_ok
  //   aks holda                                                          →  0 salary_below {vacancy_max, worker_min}
  const workerMin = pr?.salaryMin ?? pr?.salaryExpected ?? null;
  if (workerMin === null || pr === null) {
    s += 10;
    r.push(reason("salary_unspecified", "warn"));
  } else if (vacancy.salaryNegotiable || (vacancy.salaryFrom === null && vacancy.salaryTo === null)) {
    s += 8;
    r.push(reason("salary_negotiable", "warn"));
  } else if (pr.salaryType !== "negotiable" && vacancy.salaryType !== "negotiable" && pr.salaryType !== vacancy.salaryType) {
    s += 8;
    r.push(reason("salary_type_differs", "warn", { vacancy_type: vacancy.salaryType }));
  } else {
    // Bu yerda kamida bittasi null emas (yuqoridagi shart).
    const vacancyMax = (vacancy.salaryTo ?? vacancy.salaryFrom) as number;
    const expected = pr.salaryExpected ?? workerMin;
    if (vacancyMax >= expected) {
      s += 15;
      r.push(reason("salary_ok", true));
    } else if (vacancyMax >= workerMin) {
      s += 12;
      r.push(reason("salary_min_ok", true));
    } else {
      r.push(reason("salary_below", false, { vacancy_max: vacancyMax, worker_min: workerMin }));
    }
  }

  // -- 4. Tajriba (10)
  //   worker_months := experience_level_months(w.experience_level)
  //   worker_months >= v.experience_min_months                           → 10 experience_ok
  //   worker_months + 6 >= v.experience_min_months                       →  5 experience_close {required_months} (warn)
  //   aks holda                                                          →  0 experience_low {required_months}
  const workerMonths = experienceLevelMonths(worker.experienceLevel);
  if (workerMonths >= vacancy.experienceMinMonths) {
    s += 10;
    r.push(reason("experience_ok", true));
  } else if (workerMonths + 6 >= vacancy.experienceMinMonths) {
    s += 5;
    r.push(reason("experience_close", "warn", { required_months: vacancy.experienceMinMonths }));
  } else {
    r.push(reason("experience_low", false, { required_months: vacancy.experienceMinMonths }));
  }

  // -- 5. Ko'nikmalar (15): faqat majburiy (is_required) ko'nikmalar; majburiysi bo'lmasa — barchasi
  //   req_skills = count(vacancy_skills where is_required)
  //   req_skills = 0 → req_skills = count(vacancy_skills), matched = count(barchasi ∩ worker_skills)
  //   aks holda        matched = count(majburiylar ∩ worker_skills)
  //   req_skills = 0                                                     → 15 skills_not_required
  //   aks holda s += round(15.0 * matched / req)  (numeric: 0.5 noldan uzoqqa)
  //     skills_matched {matched, required}, ok: matched = req → true, > 0 → 'warn', 0 → false
  const vacancySkills = new Map<string, boolean>(); // PK (vacancy_id, skill_id): bitta skill bir marta
  for (const skill of vacancy.skills) vacancySkills.set(skill.skillId, skill.isRequired);
  let countedSkills = [...vacancySkills].filter(([, isRequired]) => isRequired).map(([id]) => id);
  if (countedSkills.length === 0) countedSkills = [...vacancySkills.keys()];
  const reqSkills = countedSkills.length;
  if (reqSkills === 0) {
    s += 15;
    r.push(reason("skills_not_required", true));
  } else {
    const workerSkills = new Set(worker.skillIds);
    let matchedSkills = 0;
    for (const id of countedSkills) if (workerSkills.has(id)) matchedSkills += 1;
    s += roundNumeric((15 * matchedSkills) / reqSkills);
    r.push(
      reason("skills_matched", matchedSkills === reqSkills ? true : matchedSkills > 0 ? "warn" : false, {
        matched: matchedSkills,
        required: reqSkills,
      }),
    );
  }

  // -- 6. Grafik (10)
  //   pr yo'q or schedules bo'sh or v.schedule ∈ schedules or 'negotiable' ∈ schedules → 10 schedule_ok
  //   'flexible' ∈ schedules or v.schedule in ('flexible','negotiable')                →  5 schedule_partial (warn)
  //   aks holda                                                                        →  0 schedule_mismatch {vacancy_schedule}
  const schedules = pr?.schedules ?? [];
  if (pr === null || schedules.length === 0 || schedules.includes(vacancy.schedule) || schedules.includes("negotiable")) {
    s += 10;
    r.push(reason("schedule_ok", true));
  } else if (schedules.includes("flexible") || vacancy.schedule === "flexible" || vacancy.schedule === "negotiable") {
    s += 5;
    r.push(reason("schedule_partial", "warn"));
  } else {
    r.push(reason("schedule_mismatch", false, { vacancy_schedule: vacancy.schedule }));
  }

  // -- 7. Bandlik turi (3) + rasmiylik (2)
  //   pr yo'q or employment_types bo'sh or v.employment_type ∈ employment_types → 3 employment_ok
  //   aks holda                                                                → 0 employment_mismatch {vacancy_type}
  //   w.work_format = 'any' or v.work_format = 'any' or teng                   → 2 work_format_ok
  //   aks holda                                                                → 0 work_format_mismatch {vacancy_format}
  const employmentTypes = pr?.employmentTypes ?? [];
  if (pr === null || employmentTypes.length === 0 || employmentTypes.includes(vacancy.employmentType)) {
    s += 3;
    r.push(reason("employment_ok", true));
  } else {
    r.push(reason("employment_mismatch", false, { vacancy_type: vacancy.employmentType }));
  }
  if (worker.workFormat === "any" || vacancy.workFormat === "any" || worker.workFormat === vacancy.workFormat) {
    s += 2;
    r.push(reason("work_format_ok", true));
  } else {
    r.push(reason("work_format_mismatch", false, { vacancy_format: vacancy.workFormat }));
  }

  // -- 8. Til (5)
  //   har bir vacancy_languages uchun: worker_languages'da shu kod va rank(level) >= rank(min_level)
  //     bo'lsa matched++, aks holda language_required {lang, level} (false)
  //   lang_total = 0                                                     → 5 (sababsiz)
  //   aks holda s += round(5.0 * matched / total);
  //     hammasi mos                                                      → languages_ok
  //     qismi mos (matched > 0)                                          → languages_partial {matched, required} (warn)
  let langTotal = 0;
  let langMatched = 0;
  let langOk = true;
  for (const lang of vacancy.languages) {
    langTotal += 1;
    const minRank = languageLevelRank(lang.minLevel);
    const has = worker.languages.some((wl) => wl.code === lang.code && languageLevelRank(wl.level) >= minRank);
    if (has) {
      langMatched += 1;
    } else {
      langOk = false;
      r.push(reason("language_required", false, { lang: lang.code, level: lang.minLevel }));
    }
  }
  if (langTotal === 0) {
    s += 5;
  } else {
    s += roundNumeric((5 * langMatched) / langTotal);
    if (langOk) r.push(reason("languages_ok", true));
    else if (langMatched > 0) r.push(reason("languages_partial", "warn", { matched: langMatched, required: langTotal }));
  }

  // -- Ogohlantirishlar (ballga ta'sir qilmaydi)
  //   v.education_min is not null va worker_education'da rank >= rank(min) yo'q → education_required {level} (warn)
  //   birth_date bor va (age_min yoki age_max bor) va yosh oraliqdan tashqarida  → age_out_of_range {min, max} (warn)
  if (vacancy.educationMin !== null) {
    const minRank = educationRank(vacancy.educationMin);
    if (!worker.educationLevels.some((level) => educationRank(level) >= minRank)) {
      r.push(reason("education_required", "warn", { level: vacancy.educationMin }));
    }
  }
  if (worker.birthDate !== null && (vacancy.ageMin !== null || vacancy.ageMax !== null)) {
    const age = ageFromBirthDate(worker.birthDate, now);
    if (age !== null && ((vacancy.ageMin !== null && age < vacancy.ageMin) || (vacancy.ageMax !== null && age > vacancy.ageMax))) {
      r.push(reason("age_out_of_range", "warn", { min: vacancy.ageMin, max: vacancy.ageMax }));
    }
  }

  // score := greatest(0, least(100, s))
  return { score: Math.max(0, Math.min(100, s)), reasons: r };
}

// ---------------------------------------------------------------------------
// Dvigatel interfeysi (kengaytma nuqtasi)
// ---------------------------------------------------------------------------

/** SQL compute_match bilan bir xil natija beradigan rule-based dvigatel. */
export const ruleBasedEngine: MatchEngine = {
  name: "rule_based",
  compute: computeMatch,
};

/**
 * Dvigatel fabrikasi. Hozircha faqat `rule_based`.
 *
 * Kelajakda AI dvigatel qo'shish uchun:
 *  1. `MatchEngineKind` ga yangi qiymat qo'shing (types.ts), masalan `"ai"`.
 *  2. `MatchEngine` ni amalga oshiruvchi obyekt yozing (`name`, `compute(worker, vacancy, opts)`),
 *     natija baribir `MatchResult` (0..100 ball + `MatchReason[]`) bo'lishi shart — UI (MatchScore/MatchReasons)
 *     va i18n kalitlari (`enums.match_reason.<key>`) shunga bog'langan.
 *  3. Quyidagi `switch` ga tarmoq qo'shing. SQL tomonidagi saralash (search/recommended) esa
 *     `matches` keshini AI natijasi bilan to'ldirish orqali almashtiriladi.
 */
export function createMatchEngine(kind: MatchEngineKind = "rule_based"): MatchEngine {
  switch (kind) {
    case "rule_based":
      return ruleBasedEngine;
  }
}

/** UI rang/ohangi: ≥75 high, ≥50 medium, aks holda low. */
export function matchTone(score: number): MatchTone {
  if (score >= 75) return "high";
  if (score >= 50) return "medium";
  return "low";
}

/** Sabablarni sanash: ok=true → positives, 'warn' → warnings, false → negatives. */
export function summarizeReasons(reasons: readonly MatchReason[]): ReasonSummary {
  const summary: ReasonSummary = { positives: 0, warnings: 0, negatives: 0 };
  for (const item of reasons) {
    if (item.ok === true) summary.positives += 1;
    else if (item.ok === "warn") summary.warnings += 1;
    else summary.negatives += 1;
  }
  return summary;
}
