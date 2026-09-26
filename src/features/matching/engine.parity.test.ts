/**
 * Paritet testi: TS dvigatel === public.compute_match (haqiqiy Postgres).
 *
 * Ishlash sharti: DATABASE_URL yoki lokal postgres://postgres:postgres@127.0.0.1:5432/ishuz_dev
 * ulanishi mumkin bo'lsa. Ulanib bo'lmasa — suite skip qilinadi (ogohlantirish bilan).
 * Baza migratsiya fayllaridan ORQADA qolgan bo'lsa (compute_match yoki yordamchi funksiyalarning
 * tanasi supabase/migrations dagi bilan mos kelmasa) ham skip qilinadi — bu holda TS bilan
 * solishtirish ma'nosiz; `npm run db:local` bilan bazani yangilang.
 *
 * Barcha yozuvlar bitta tranzaksiyada yaratiladi va oxirida ROLLBACK qilinadi.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Client } from "pg";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { computeMatch, distanceKm, educationRank, experienceLevelMonths, languageLevelRank } from "./engine";
import type { MatchResult, VacancyMatchInput, WorkerMatchInput } from "./types";

const DEFAULT_URL = "postgres://postgres:postgres@127.0.0.1:5432/ishuz_dev";
const MIGRATIONS_DIR = fileURLToPath(new URL("../../../supabase/migrations/", import.meta.url));
const TAG = "[matching parity]";

/** Dvigatel tayanadigan SQL funksiyalar: fayl ↔ baza tanasi solishtiriladi. */
const TRACKED_FUNCTIONS = [
  { file: "0001_extensions_types.sql", name: "experience_level_months", signature: "public.experience_level_months(public.experience_level)" },
  { file: "0001_extensions_types.sql", name: "education_rank", signature: "public.education_rank(public.education_level)" },
  { file: "0001_extensions_types.sql", name: "language_level_rank", signature: "public.language_level_rank(public.language_level)" },
  { file: "0001_extensions_types.sql", name: "distance_km", signature: "public.distance_km(double precision, double precision, double precision, double precision)" },
  { file: "0008_functions.sql", name: "compute_match", signature: "public.compute_match(uuid, uuid)" },
];

function normalizeSql(body: string): string {
  return body
    .replace(/--[^\n]*/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function fileFunctionBody(file: string, name: string): string | null {
  const sql = readFileSync(MIGRATIONS_DIR + file, "utf8");
  const head = sql.indexOf(`create or replace function public.${name}(`);
  if (head < 0) return null;
  const open = sql.indexOf("$$", head);
  const close = open < 0 ? -1 : sql.indexOf("$$", open + 2);
  if (open < 0 || close < 0) return null;
  return normalizeSql(sql.slice(open + 2, close));
}

async function dbFunctionBody(db: Client, signature: string): Promise<string | null> {
  try {
    const res = await db.query<{ def: string }>("select pg_get_functiondef($1::regprocedure) as def", [signature]);
    const def = res.rows[0]?.def;
    if (!def) return null;
    const marker = "$function$";
    const open = def.indexOf(marker);
    const close = def.lastIndexOf(marker);
    if (open < 0 || close <= open) return null;
    return normalizeSql(def.slice(open + marker.length, close));
  } catch {
    return null;
  }
}

async function connect(): Promise<Client | null> {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL ?? DEFAULT_URL, connectionTimeoutMillis: 3000 });
  try {
    await client.connect();
    return client;
  } catch (error) {
    console.warn(`${TAG} Postgres ulanmadi, suite skip: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

async function staleFunctions(db: Client): Promise<string[]> {
  const stale: string[] = [];
  for (const fn of TRACKED_FUNCTIONS) {
    const fileBody = fileFunctionBody(fn.file, fn.name);
    const dbBody = await dbFunctionBody(db, fn.signature);
    if (fileBody === null || dbBody === null || fileBody !== dbBody) stale.push(fn.name);
  }
  return stale;
}

const client = await connect();
const stale = client ? await staleFunctions(client) : [];
if (client && stale.length > 0) {
  console.warn(
    `${TAG} baza migratsiya fayllaridan orqada (${stale.join(", ")} tanasi farq qiladi) — suite skip. ` +
      `Yangilash: npm run db:local (yoki DATABASE_URL bilan yangi bazaga yo'naltiring).`,
  );
  await client.end();
}
const enabled = client !== null && stale.length === 0;
const suite = enabled ? describe : describe.skip;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

interface Refs {
  cat: Record<"sales" | "marketing", string>;
  sub: Record<"sales_manager" | "agent", string>;
  region: Record<"tashkent_city", string>;
  district: Record<"chilonzor" | "mirobod" | "yunusobod" | "yakkasaroy", { id: string; lat: number; lng: number }>;
  skill: Record<"sales_pos" | "sales_cash" | "sales_click" | "sales_1c" | "sales_reporting", string>;
}

async function one<T extends pg.QueryResultRow>(db: Client, sql: string, params: unknown[] = []): Promise<T> {
  const res = await db.query<T>(sql, params);
  const row = res.rows[0];
  if (!row) throw new Error(`Qator topilmadi: ${sql} ${JSON.stringify(params)}`);
  return row;
}

async function loadRefs(db: Client): Promise<Refs> {
  const id = async (table: string, slug: string) => (await one<{ id: string }>(db, `select id from public.${table} where slug = $1`, [slug])).id;
  const sub = async (slug: string) =>
    (await one<{ id: string }>(db, "select s.id from public.subcategories s join public.categories c on c.id = s.category_id where c.slug = 'sales' and s.slug = $1", [slug])).id;
  const district = async (slug: string) =>
    one<{ id: string; lat: number; lng: number }>(
      db,
      "select d.id, d.lat, d.lng from public.districts d join public.regions r on r.id = d.region_id where r.slug = 'tashkent_city' and d.slug = $1",
      [slug],
    );
  return {
    cat: { sales: await id("categories", "sales"), marketing: await id("categories", "marketing") },
    sub: { sales_manager: await sub("sales_manager"), agent: await sub("agent") },
    region: { tashkent_city: await id("regions", "tashkent_city") },
    district: {
      chilonzor: await district("chilonzor"),
      mirobod: await district("mirobod"),
      yunusobod: await district("yunusobod"),
      yakkasaroy: await district("yakkasaroy"),
    },
    skill: {
      sales_pos: await id("skills", "sales_pos"),
      sales_cash: await id("skills", "sales_cash"),
      sales_click: await id("skills", "sales_click"),
      sales_1c: await id("skills", "sales_1c"),
      sales_reporting: await id("skills", "sales_reporting"),
    },
  };
}

/** To'liq profil: savdo, Chilonzor, 1–2 yil, maosh 4–6 mln, 3 ko'nikma, 3 til, o'rta-maxsus, 31 yosh. */
function fullWorker(r: Refs): WorkerMatchInput {
  return {
    categoryId: r.cat.sales,
    subcategoryId: r.sub.sales_manager,
    districtId: r.district.chilonzor.id,
    regionId: r.region.tashkent_city,
    workDistrictIds: [r.district.yakkasaroy.id],
    remotePreference: "any",
    workFormat: "official",
    experienceLevel: "1_2y",
    birthDate: "1995-06-15",
    preferences: { employmentTypes: ["full_time", "part_time"], schedules: ["5_2", "2_2"], salaryMin: 4_000_000, salaryExpected: 6_000_000 },
    skillIds: [r.skill.sales_pos, r.skill.sales_cash, r.skill.sales_click],
    languages: [
      { code: "uz", level: "native" },
      { code: "ru", level: "b2" },
      { code: "en", level: "a2" },
    ],
    educationLevels: ["vocational"],
    geo: { lat: r.district.chilonzor.lat, lng: r.district.chilonzor.lng },
  };
}

/** Bo'sh profil: kategoriya/hudud/istak/ko'nikma/til/ta'lim/geo/tug'ilgan sana yo'q, masofaviy ishlamaydi. */
function emptyWorker(): WorkerMatchInput {
  return {
    categoryId: null,
    subcategoryId: null,
    districtId: null,
    regionId: null,
    workDistrictIds: [],
    remotePreference: "no",
    workFormat: "any",
    experienceLevel: "none",
    birthDate: null,
    preferences: null,
    skillIds: [],
    languages: [],
    educationLevels: [],
    geo: null,
  };
}

const VACANCY_NAMES = ["perfect", "partial", "remote_negotiable", "region_min_salary", "near_negotiable"] as const;
type VacancyName = (typeof VACANCY_NAMES)[number];

function vacancies(r: Refs): Record<VacancyName, VacancyMatchInput> {
  return {
    // Hammasi mos: 100
    perfect: {
      categoryId: r.cat.sales,
      subcategoryId: r.sub.sales_manager,
      districtId: r.district.chilonzor.id,
      regionId: r.region.tashkent_city,
      isRemote: false,
      lat: r.district.chilonzor.lat,
      lng: r.district.chilonzor.lng,
      salaryFrom: 5_000_000,
      salaryTo: 7_000_000,
      salaryNegotiable: false,
      experienceMinMonths: 12,
      employmentType: "full_time",
      schedule: "5_2",
      workFormat: "official",
      requiredSkillIds: [r.skill.sales_pos, r.skill.sales_cash],
      languages: [
        { code: "ru", minLevel: "b1" },
        { code: "uz", minLevel: "b1" },
      ],
      educationMin: "secondary",
      ageMin: 20,
      ageMax: 40,
    },
    // Qisman kategoriya, 7 km, maosh past, tajriba kam, 2/3 ko'nikma, grafik/bandlik/rasmiylik mos emas, 1/2 til, ta'lim/yosh ogohlantirish
    partial: {
      categoryId: r.cat.sales,
      subcategoryId: r.sub.agent,
      districtId: r.district.mirobod.id,
      regionId: r.region.tashkent_city,
      isRemote: false,
      lat: r.district.mirobod.lat,
      lng: r.district.mirobod.lng,
      salaryFrom: 3_000_000,
      salaryTo: 3_500_000,
      salaryNegotiable: false,
      experienceMinMonths: 36,
      employmentType: "temporary",
      schedule: "shift",
      workFormat: "unofficial",
      requiredSkillIds: [r.skill.sales_pos, r.skill.sales_click, r.skill.sales_1c],
      languages: [
        { code: "en", minLevel: "b2" },
        { code: "ru", minLevel: "b1" },
      ],
      educationMin: "higher",
      ageMin: 18,
      ageMax: 25,
    },
    // Boshqa kategoriya, masofaviy, kelishiladigan maosh, ko'nikma/til talab yo'q, moslashuvchan grafik, faqat age_max
    remote_negotiable: {
      categoryId: r.cat.marketing,
      subcategoryId: null,
      districtId: null,
      regionId: null,
      isRemote: true,
      lat: null,
      lng: null,
      salaryFrom: null,
      salaryTo: null,
      salaryNegotiable: true,
      experienceMinMonths: 0,
      employmentType: "remote",
      schedule: "flexible",
      workFormat: "any",
      requiredSkillIds: [],
      languages: [],
      educationMin: null,
      ageMin: null,
      ageMax: 30,
    },
    // Subkategoriyasiz, koordinatasiz boshqa tuman (region_match), faqat salary_from, tajriba aynan chegarada, 0/1 ko'nikma, til yo'q, faqat age_min
    region_min_salary: {
      categoryId: r.cat.sales,
      subcategoryId: null,
      districtId: r.district.yunusobod.id,
      regionId: r.region.tashkent_city,
      isRemote: false,
      lat: null,
      lng: null,
      salaryFrom: 4_500_000,
      salaryTo: null,
      salaryNegotiable: false,
      experienceMinMonths: 24,
      employmentType: "full_time",
      schedule: "6_1",
      workFormat: "any",
      requiredSkillIds: [r.skill.sales_reporting],
      languages: [{ code: "tr", minLevel: "b1" }],
      educationMin: null,
      ageMin: 35,
      ageMax: null,
    },
    // ~2 km (distance_near), faqat salary_to, tajriba juda kam, kelishiladigan grafik, til mos, magistr talabi
    near_negotiable: {
      categoryId: r.cat.sales,
      subcategoryId: r.sub.sales_manager,
      districtId: r.district.mirobod.id,
      regionId: r.region.tashkent_city,
      isRemote: false,
      lat: 41.29,
      lng: 69.22,
      salaryFrom: null,
      salaryTo: 8_000_000,
      salaryNegotiable: false,
      experienceMinMonths: 60,
      employmentType: "part_time",
      schedule: "negotiable",
      workFormat: "official",
      requiredSkillIds: [],
      languages: [{ code: "uz", minLevel: "c1" }],
      educationMin: "master",
      ageMin: null,
      ageMax: null,
    },
  };
}

// ---------------------------------------------------------------------------
// DB yozish
// ---------------------------------------------------------------------------

async function insertWorker(db: Client, w: WorkerMatchInput): Promise<string> {
  const { id: profileId } = await one<{ id: string }>(db, "insert into auth.users default values returning id");
  if (w.birthDate) await db.query("update public.profiles set birth_date = $2 where id = $1", [profileId, w.birthDate]);
  const { id } = await one<{ id: string }>(
    db,
    `insert into public.worker_profiles (profile_id, category_id, subcategory_id, experience_level, region_id, district_id, remote_preference, work_format)
     values ($1, $2, $3, $4, $5, $6, $7, $8) returning id`,
    [profileId, w.categoryId, w.subcategoryId, w.experienceLevel, w.regionId, w.districtId, w.remotePreference, w.workFormat],
  );
  if (w.preferences) {
    await db.query(
      "insert into public.worker_preferences (worker_id, employment_types, schedules, salary_min, salary_expected) values ($1, $2::public.employment_type[], $3::public.work_schedule[], $4, $5)",
      [id, w.preferences.employmentTypes, w.preferences.schedules, w.preferences.salaryMin, w.preferences.salaryExpected],
    );
  }
  for (const districtId of w.workDistrictIds) {
    await db.query("insert into public.worker_locations (worker_id, district_id) values ($1, $2)", [id, districtId]);
  }
  for (const skillId of w.skillIds) {
    await db.query("insert into public.worker_skills (worker_id, skill_id) values ($1, $2)", [id, skillId]);
  }
  for (const lang of w.languages) {
    await db.query("insert into public.worker_languages (worker_id, language_code, level) values ($1, $2, $3)", [id, lang.code, lang.level]);
  }
  for (const level of w.educationLevels) {
    await db.query("insert into public.worker_education (worker_id, level) values ($1, $2)", [id, level]);
  }
  if (w.geo) await db.query("insert into public.worker_geo (worker_id, lat, lng) values ($1, $2, $3)", [id, w.geo.lat, w.geo.lng]);
  return id;
}

async function insertVacancy(db: Client, ownerProfileId: string, title: string, v: VacancyMatchInput): Promise<string> {
  const { id } = await one<{ id: string }>(
    db,
    `insert into public.vacancies (owner_profile_id, title, category_id, subcategory_id, region_id, district_id, lat, lng, is_remote,
       salary_from, salary_to, salary_negotiable, employment_type, schedule, work_format, experience_min_months, education_min, age_min, age_max, status)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, 'draft') returning id`,
    [
      ownerProfileId,
      title,
      v.categoryId,
      v.subcategoryId,
      v.regionId,
      v.districtId,
      v.lat,
      v.lng,
      v.isRemote,
      v.salaryFrom,
      v.salaryTo,
      v.salaryNegotiable,
      v.employmentType,
      v.schedule,
      v.workFormat,
      v.experienceMinMonths,
      v.educationMin,
      v.ageMin,
      v.ageMax,
    ],
  );
  for (const skillId of v.requiredSkillIds) {
    await db.query("insert into public.vacancy_skills (vacancy_id, skill_id) values ($1, $2)", [id, skillId]);
  }
  // SQL loop'da ORDER BY yo'q; kiritish tartibi = TS tartibi (kodlar alifbo tartibida, PK bilan ham mos).
  for (const lang of v.languages) {
    await db.query("insert into public.vacancy_languages (vacancy_id, language_code, min_level) values ($1, $2, $3)", [id, lang.code, lang.minLevel]);
  }
  return id;
}

async function dbComputeMatch(db: Client, workerId: string, vacancyId: string): Promise<MatchResult> {
  const row = await one<{ score: number; reasons: MatchResult["reasons"] }>(db, "select score, reasons from public.compute_match($1::uuid, $2::uuid)", [
    workerId,
    vacancyId,
  ]);
  // pg jsonb'ni JSON.parse qiladi: km → number, null → null. Har ehtimolga qarshi qayta normalizatsiya.
  return JSON.parse(JSON.stringify({ score: row.score, reasons: row.reasons })) as MatchResult;
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

const WORKER_NAMES = ["full", "empty"] as const;
type WorkerName = (typeof WORKER_NAMES)[number];

/** Fixture'lar mo'ljallangan darajalarni qamrab olganini tekshirish uchun kutilgan ballar. */
const EXPECTED_SCORES: Record<WorkerName, Record<VacancyName, number>> = {
  full: { perfect: 100, partial: 41, remote_negotiable: 60, region_min_salary: 60, near_negotiable: 85 },
  empty: { perfect: 25, partial: 25, remote_negotiable: 55, region_min_salary: 25, near_negotiable: 40 },
};

suite("compute_match parity (Postgres)", () => {
  const db = client as Client;
  let refs: Refs;
  const results = new Map<string, { db: MatchResult; ts: MatchResult }>();

  beforeAll(async () => {
    await db.query("begin");
    refs = await loadRefs(db);
    const workers: Record<WorkerName, WorkerMatchInput> = { full: fullWorker(refs), empty: emptyWorker() };
    const workerIds: Record<WorkerName, string> = { full: await insertWorker(db, workers.full), empty: await insertWorker(db, workers.empty) };
    const { id: ownerProfileId } = await one<{ profile_id: string; id: string }>(db, "select profile_id as id from public.worker_profiles where id = $1", [
      workerIds.full,
    ]);
    const vacancyInputs = vacancies(refs);
    const now = new Date();
    for (const vName of VACANCY_NAMES) {
      const vacancyId = await insertVacancy(db, ownerProfileId, `parity ${vName}`, vacancyInputs[vName]);
      for (const wName of WORKER_NAMES) {
        results.set(`${wName}/${vName}`, {
          db: await dbComputeMatch(db, workerIds[wName], vacancyId),
          ts: computeMatch(workers[wName], vacancyInputs[vName], { now }),
        });
      }
    }
  });

  afterAll(async () => {
    try {
      await db.query("rollback");
    } finally {
      await db.end();
    }
  });

  test("experience_level_months / education_rank / language_level_rank match the DB", async () => {
    const exp = await db.query<{ level: "none"; months: number }>(
      "select level, public.experience_level_months(level) as months from unnest(enum_range(null::public.experience_level)) level",
    );
    for (const row of exp.rows) expect({ level: row.level, months: experienceLevelMonths(row.level) }).toEqual(row);
    const edu = await db.query<{ level: "secondary"; rank: number }>(
      "select level, public.education_rank(level) as rank from unnest(enum_range(null::public.education_level)) level",
    );
    for (const row of edu.rows) expect({ level: row.level, rank: educationRank(row.level) }).toEqual(row);
    const lang = await db.query<{ level: "a1"; rank: number }>(
      "select level, public.language_level_rank(level) as rank from unnest(enum_range(null::public.language_level)) level",
    );
    for (const row of lang.rows) expect({ level: row.level, rank: languageLevelRank(row.level) }).toEqual(row);
  });

  test("distance_km matches the DB haversine", async () => {
    const pairs: Array<[number, number, number, number]> = [
      [41.2753, 69.204, 41.287, 69.287],
      [41.2753, 69.204, 41.364, 69.286],
      [41.2753, 69.204, 39.6542, 66.9597],
      [41.2753, 69.204, 41.2753, 69.204],
    ];
    for (const [a, b, c, d] of pairs) {
      const row = await one<{ km: number | null }>(db, "select public.distance_km($1, $2, $3, $4) as km", [a, b, c, d]);
      expect(distanceKm(a, b, c, d)).toBeCloseTo(row.km ?? Number.NaN, 9);
    }
    const nul = await one<{ km: number | null }>(db, "select public.distance_km($1, $2, null, $3) as km", [1, 2, 3]);
    expect(nul.km).toBeNull();
  });

  for (const wName of WORKER_NAMES) {
    for (const vName of VACANCY_NAMES) {
      test(`${wName} worker × ${vName}: identical score and reasons`, () => {
        const pair = results.get(`${wName}/${vName}`);
        expect(pair).toBeDefined();
        if (!pair) return;
        expect(pair.ts.score).toBe(pair.db.score);
        expect(pair.ts.reasons).toEqual(pair.db.reasons);
        expect(pair.ts).toEqual(pair.db);
      });
    }
  }

  test("fixtures cover the intended tiers (DB scores)", () => {
    const actual: Record<string, number> = {};
    for (const [key, pair] of results) actual[key] = pair.db.score;
    const expected: Record<string, number> = {};
    for (const wName of WORKER_NAMES) for (const vName of VACANCY_NAMES) expected[`${wName}/${vName}`] = EXPECTED_SCORES[wName][vName];
    expect(actual).toEqual(expected);
    const seen = new Set<string>();
    for (const pair of results.values()) for (const item of pair.db.reasons) seen.add(item.key);
    for (const key of [
      "category_match",
      "category_match_partial",
      "category_mismatch",
      "remote_ok",
      "district_match",
      "distance_near",
      "distance_ok",
      "region_match",
      "location_far",
      "salary_unspecified",
      "salary_negotiable",
      "salary_ok",
      "salary_min_ok",
      "salary_below",
      "experience_ok",
      "experience_low",
      "skills_not_required",
      "skills_matched",
      "schedule_ok",
      "schedule_partial",
      "schedule_mismatch",
      "employment_ok",
      "employment_mismatch",
      "work_format_ok",
      "work_format_mismatch",
      "language_required",
      "languages_ok",
      "education_required",
      "age_out_of_range",
    ]) {
      expect(seen.has(key), `reason ${key} not covered`).toBe(true);
    }
  });
});
