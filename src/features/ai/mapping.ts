import type { ExperienceInput, LocationInput, PreferencesInput, ProfessionInput, SkillsInput } from "@/features/onboarding/schema";
import type { z } from "zod";
import type { stepPayloadSchema } from "@/features/vacancies/schema";
import { EXPERIENCE_OPTIONS } from "@/features/vacancies/schema";
import type { WorkerExtract, VacancyExtract } from "./extract";

/** Katalog xaritalari (AiCatalog'ning tekshiruv uchun kerakli qismi) */
export interface CatalogMaps {
  category: Map<string, string>;
  subcategory: Map<string, { id: string; categoryId: string }>;
  region: Map<string, string>;
  district: Map<string, { id: string; regionId: string }>;
  skill: Map<string, { id: string; categoryId: string | null }>;
  languageCodes: Set<string>;
  benefitCodes: Set<string>;
  officialTermCodes: Set<string>;
}

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function clampText(v: string | null | undefined, max: number): string {
  return (v ?? "").trim().slice(0, max);
}
function money(v: number | null | undefined): number | null {
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.round(v) : null;
}

/** Kategoriya/yo'nalish: yo'nalish bo'lsa, kategoriya undan olinadi (izchillik) */
export function resolveCategory(maps: CatalogMaps, category: string | null, subcategory: string | null) {
  const sub = subcategory ? maps.subcategory.get(subcategory) : undefined;
  const categoryId = sub?.categoryId ?? (category ? (maps.category.get(category) ?? null) : null);
  return { categoryId, subcategoryId: sub && sub.categoryId === categoryId ? sub.id : null };
}

/** Viloyat/tuman: tuman bo'lsa, viloyat undan olinadi */
export function resolvePlace(maps: CatalogMaps, region: string | null, district: string | null) {
  const d = district ? maps.district.get(district) : undefined;
  const regionId = d?.regionId ?? (region ? (maps.region.get(region) ?? null) : null);
  return { regionId, districtId: d && d.regionId === regionId ? d.id : null };
}

// ---------------------------------------------------------------------------
// Ishchi
// ---------------------------------------------------------------------------

export interface WorkerPlan {
  personal: { first_name: string; last_name: string; birth_date: string; gender: WorkerExtract["gender"] };
  location: LocationInput | null;
  profession: ProfessionInput | null;
  experience: ExperienceInput;
  skills: SkillsInput;
  education: { level: NonNullable<WorkerExtract["education_level"]>; entries: { institution: string; field: string; started_year: null; ended_year: null }[] } | null;
  preferences: PreferencesInput | null;
  about: string;
}

export function planWorker(maps: CatalogMaps, x: WorkerExtract): WorkerPlan {
  const { regionId, districtId } = resolvePlace(maps, x.region, x.district);
  const extra = x.extra_districts
    .map((c) => maps.district.get(c))
    .filter((d): d is { id: string; regionId: string } => !!d)
    .map((d) => d.id);
  const location: LocationInput | null =
    regionId && districtId
      ? { region_id: regionId, district_id: districtId, area_hint: "", work_districts: [...new Set([districtId, ...extra])].slice(0, 60), remote_preference: x.remote_preference ?? "no" }
      : null;

  const cat = resolveCategory(maps, x.category, x.subcategory);
  const headline = clampText(x.headline, 80);
  const profession: ProfessionInput | null = cat.categoryId && headline.length >= 2 ? { category_id: cat.categoryId, subcategory_id: cat.subcategoryId, headline } : null;

  const entries = x.experience
    .map((e) => ({
      company_name: clampText(e.company_name, 120),
      position: clampText(e.position, 120),
      started_on: e.started_on && MONTH_RE.test(e.started_on) ? e.started_on : "",
      ended_on: e.ended_on && MONTH_RE.test(e.ended_on) ? e.ended_on : null,
      is_current: e.is_current,
      responsibilities: clampText(e.responsibilities, 1000),
      achievements: "",
    }))
    // Sanasiz yoki to'liqsiz yozuvlar saqlanmaydi (sxema rad etadi) — daraja baribir saqlanadi
    .filter((e) => e.company_name.length >= 2 && e.position.length >= 2 && e.started_on && (e.is_current || e.ended_on) && (!e.ended_on || e.ended_on >= e.started_on))
    .slice(0, 20);

  const skillRows = x.skills
    .map((s) => ({ id: maps.skill.get(s.code)?.id, level: s.level }))
    .filter((s): s is { id: string; level: typeof s.level } => !!s.id);
  const uniqueSkills = [...new Map(skillRows.map((s) => [s.id, s])).values()].slice(0, 30).map((s) => ({ skill_id: s.id, level: s.level }));
  const langs = [...new Map(x.languages.filter((l) => maps.languageCodes.has(l.code)).map((l) => [l.code, { language_code: l.code, level: l.level }])).values()].slice(0, 12);

  const salaryMin = money(x.salary_min);
  let salaryExpected = money(x.salary_expected);
  if (salaryMin !== null && salaryExpected !== null && salaryExpected < salaryMin) salaryExpected = salaryMin;
  const preferences: PreferencesInput | null =
    x.availability && x.work_format
      ? {
          employment_types: [...new Set(x.employment_types)],
          schedules: [...new Set(x.schedules)],
          work_time_from: "",
          work_time_to: "",
          salary_min: salaryMin,
          salary_expected: salaryExpected,
          salary_type: x.salary_type ?? "monthly",
          availability: x.availability,
          work_format: x.work_format,
          official_terms: [],
        }
      : null;

  return {
    personal: { first_name: clampText(x.first_name, 60), last_name: clampText(x.last_name, 60), birth_date: x.birth_date && DATE_RE.test(x.birth_date) ? x.birth_date : "", gender: x.gender },
    location,
    profession,
    experience: { experience_level: x.experience_level ?? (entries.length ? "1_2y" : "none"), entries },
    skills: { skills: uniqueSkills, languages: langs.length ? langs : [{ language_code: "uz", level: "native" }] },
    education: x.education_level
      ? {
          level: x.education_level,
          entries: x.education
            .map((e) => ({ institution: clampText(e.institution, 160), field: clampText(e.field, 160), started_year: null, ended_year: null }))
            .filter((e) => e.institution.length >= 2)
            .slice(0, 10),
        }
      : null,
    preferences,
    about: clampText(x.about, 2000),
  };
}

// ---------------------------------------------------------------------------
// Vakansiya
// ---------------------------------------------------------------------------

/** Kirish tipi: majburiy maydonlar null bo'lishi mumkin — saveStep o'zi rad etadi */
type StepPayload = z.input<typeof stepPayloadSchema>;

export interface VacancyPlan {
  title: string;
  /** Tartib bilan saqlanadigan qadamlar (majburiylari birinchi) */
  steps: StepPayload[];
}

function nearestExperience(months: number): (typeof EXPERIENCE_OPTIONS)[number] {
  return EXPERIENCE_OPTIONS.reduce((best, o) => (Math.abs(o - months) < Math.abs(best - months) ? o : best), EXPERIENCE_OPTIONS[0]);
}
function age(v: number | null): number | null {
  return typeof v === "number" && v >= 14 && v <= 80 ? v : null;
}

export function planVacancy(maps: CatalogMaps, x: VacancyExtract): VacancyPlan {
  const title = clampText(x.title, 120);
  const cat = resolveCategory(maps, x.category, x.subcategory);
  const place = resolvePlace(maps, x.region, x.district);
  const steps: StepPayload[] = [];

  steps.push({ step: "category", data: { categoryId: cat.categoryId, subcategoryId: cat.subcategoryId } });
  steps.push({ step: "location", data: { isRemote: x.is_remote, regionId: place.regionId, districtId: place.districtId, address: x.address ? clampText(x.address, 200) : null, lat: null, lng: null } });

  let from = money(x.salary_from);
  let to = money(x.salary_to);
  if (from !== null && to !== null && to < from) [from, to] = [to, from];
  const negotiable = x.salary_negotiable || (from === null && to === null);
  steps.push({ step: "salary", data: { salaryNegotiable: negotiable, salaryFrom: negotiable ? null : from, salaryTo: negotiable ? null : to, salaryType: x.salary_type } });

  if (x.employment_type && x.schedule) {
    const tf = x.work_time_from && TIME_RE.test(x.work_time_from) ? x.work_time_from : null;
    const tt = x.work_time_to && TIME_RE.test(x.work_time_to) ? x.work_time_to : null;
    steps.push({ step: "schedule", data: { employmentType: x.employment_type, schedule: x.schedule, workTimeFrom: tf, workTimeTo: tt } });
  }

  let ageMin = age(x.age_min);
  let ageMax = age(x.age_max);
  if (ageMin !== null && ageMax !== null && ageMax < ageMin) [ageMin, ageMax] = [ageMax, ageMin];
  const languages = [...new Map(x.languages.filter((l) => maps.languageCodes.has(l.code)).map((l) => [l.code, { code: l.code, minLevel: l.min_level }])).values()].slice(0, 10);
  steps.push({ step: "requirements", data: { experienceMinMonths: nearestExperience(x.experience_min_months), ageMin, ageMax, educationMin: x.education_min, gender: x.gender, languages } });

  const skills = [...new Map(x.skills.map((s) => [maps.skill.get(s.code)?.id, s.required] as const).filter((e): e is readonly [string, boolean] => !!e[0])).entries()]
    .slice(0, 30)
    .map(([skillId, isRequired]) => ({ skillId, isRequired }));
  if (skills.length) steps.push({ step: "skills", data: { skills } });

  if (x.work_format && x.work_format !== "any") {
    steps.push({ step: "work_format", data: { workFormat: x.work_format, officialTerms: x.work_format === "official" ? x.official_terms.filter((c) => maps.officialTermCodes.has(c)).slice(0, 20) : [] } });
  }
  const description = x.description.trim().slice(0, 5000);
  if (description) steps.push({ step: "description", data: { description } });
  const benefits = [...new Set(x.benefits.filter((c) => maps.benefitCodes.has(c)))].slice(0, 30);
  if (benefits.length) steps.push({ step: "benefits", data: { benefits } });

  return { title: title.length >= 2 ? title : "", steps };
}
