import { z } from "zod";
import { Constants } from "@/types/database.types";
import { isBirthDateValid, monthIndex } from "./utils";
import { PORTFOLIO_MAX_FILES } from "./types";

/**
 * Har qadam uchun zod sxemalar. Xabarlar — i18n kalitlari (UI `t(message)` qiladi).
 * Kirish va chiqish tiplari bir xil (transform yo'q) — react-hook-form bilan to'g'ridan-to'g'ri ishlaydi.
 */
const E = Constants.public.Enums;
const err = (key: string) => ({ error: `onboarding.worker.errors.${key}` });

const uuid = z.uuid(err("required"));
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// ---------- 1. Shaxsiy ma'lumot ----------
export const personalSchema = z.object({
  first_name: z.string(err("required")).trim().min(2, err("name_min")).max(60, err("too_long")),
  last_name: z.string(err("required")).trim().min(2, err("name_min")).max(60, err("too_long")),
  birth_date: z
    .string(err("required"))
    .regex(/^\d{4}-\d{2}-\d{2}$/, err("birth_date_invalid"))
    .refine((v) => isBirthDateValid(v), err("age_range")),
  gender: z.enum(E.gender, err("required")),
  telegram_username: z
    .string()
    .trim()
    .regex(/^@?[A-Za-z][A-Za-z0-9_]{4,31}$/, err("telegram_invalid"))
    .or(z.literal("")),
});
export type PersonalInput = z.infer<typeof personalSchema>;

export const avatarSchema = z.object({ url: z.string().url().max(600).nullable() });
export type AvatarInput = z.infer<typeof avatarSchema>;

export const phoneSchema = z.object({ phone: z.string().min(9).max(20) });
export const phoneCodeSchema = z.object({ phone: z.string().min(9).max(20), token: z.string().regex(/^\d{4,8}$/) });

// ---------- 2. Joylashuv ----------
export const locationSchema = z.object({
  region_id: uuid,
  district_id: uuid,
  area_hint: z.string().trim().max(120, err("too_long")),
  work_districts: z.array(z.uuid()).min(1, err("work_districts_min")).max(60, err("too_many")),
  remote_preference: z.enum(E.remote_preference, err("required")),
});
export type LocationInput = z.infer<typeof locationSchema>;

export const geoSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
export type GeoInput = z.infer<typeof geoSchema>;

// ---------- 3. Kasb ----------
export const professionSchema = z.object({
  category_id: uuid,
  subcategory_id: z.uuid().nullable(),
  /** kasblar daraxtidan tanlangan tugun; bo'lsa category/subcategory undan olinadi */
  profession_node_id: z.uuid().nullable().optional(),
  /** katalogda topilmagan kasb — foydalanuvchi o'zi yozgan asl matn */
  custom_profession: z.string().trim().min(2).max(120).nullable().optional(),
  headline: z.string(err("required")).trim().min(2, err("headline_min")).max(80, err("too_long")),
});
export type ProfessionInput = z.infer<typeof professionSchema>;

// ---------- 4. Tajriba ----------
export const experienceEntrySchema = z
  .object({
    company_name: z.string(err("required")).trim().min(2, err("company_min")).max(120, err("too_long")),
    position: z.string(err("required")).trim().min(2, err("position_min")).max(120, err("too_long")),
    started_on: z.string(err("started_required")).regex(MONTH_RE, err("started_required")),
    ended_on: z.string().regex(MONTH_RE, err("ended_required")).nullable(),
    is_current: z.boolean(),
    responsibilities: z.string().trim().max(1000, err("too_long")),
    achievements: z.string().trim().max(1000, err("too_long")),
  })
  .refine((e) => e.is_current || !!e.ended_on, { ...err("ended_required"), path: ["ended_on"] })
  .refine((e) => e.is_current || !e.ended_on || monthIndex(e.ended_on) >= monthIndex(e.started_on), { ...err("ended_before_start"), path: ["ended_on"] });

export const experienceSchema = z.object({
  experience_level: z.enum(E.experience_level, err("required")),
  entries: z.array(experienceEntrySchema).max(20, err("too_many")),
});
export type ExperienceInput = z.infer<typeof experienceSchema>;
export type ExperienceEntryInput = z.infer<typeof experienceEntrySchema>;

// ---------- 5. Ko'nikma va tillar ----------
export const skillsSchema = z.object({
  skills: z
    .array(z.object({ skill_id: z.uuid(), level: z.enum(E.skill_level) }))
    .min(1, err("skills_min"))
    .max(30, err("too_many")),
  languages: z
    .array(z.object({ language_code: z.string().min(2).max(8), level: z.enum(E.language_level) }))
    .min(1, err("languages_min"))
    .max(12, err("too_many")),
});
export type SkillsInput = z.infer<typeof skillsSchema>;

export const customSkillSchema = z.object({
  name: z.string(err("required")).trim().min(2, err("custom_skill_min")).max(60, err("too_long")),
  category_id: z.uuid().nullable(),
});
export type CustomSkillInput = z.infer<typeof customSkillSchema>;

// ---------- 6. Ta'lim ----------
const year = z.number().int().min(1950, err("year_invalid")).max(2100, err("year_invalid")).nullable();
export const educationEntrySchema = z
  .object({
    institution: z.string(err("required")).trim().min(2, err("institution_min")).max(160, err("too_long")),
    field: z.string().trim().max(160, err("too_long")),
    started_year: year,
    ended_year: year,
  })
  .refine((e) => e.started_year === null || e.ended_year === null || e.ended_year >= e.started_year, { ...err("years_order"), path: ["ended_year"] });

export const educationSchema = z.object({
  level: z.enum(E.education_level, err("required")),
  entries: z.array(educationEntrySchema).max(10, err("too_many")),
});
export type EducationInput = z.infer<typeof educationSchema>;
export type EducationEntryInput = z.infer<typeof educationEntrySchema>;

// ---------- 7. Portfolio ----------
const httpsUrl = z.string().trim().regex(/^https:\/\/[^\s]{3,}$/i, err("link_invalid")).max(500, err("too_long"));
export const portfolioItemSchema = z
  .object({
    title: z.string(err("required")).trim().min(2, err("title_min")).max(120, err("too_long")),
    description: z.string().trim().max(1000, err("too_long")),
    type: z.enum(E.portfolio_type, err("required")),
    media_paths: z.array(z.string().min(3).max(300)).max(PORTFOLIO_MAX_FILES, err("max_files")),
    link_url: httpsUrl.or(z.literal("")),
  })
  .refine((i) => (i.type === "link" ? i.link_url.length > 0 : true), { ...err("link_required"), path: ["link_url"] })
  .refine((i) => (i.type !== "link" ? i.media_paths.length > 0 : true), { ...err("media_required"), path: ["media_paths"] });

export const portfolioSchema = z.object({ items: z.array(portfolioItemSchema).max(20, err("too_many")) });
export type PortfolioInput = z.infer<typeof portfolioSchema>;
export type PortfolioItemInput = z.infer<typeof portfolioItemSchema>;

// ---------- 8. Ish istagi ----------
const money = z.number().int().min(0, err("salary_invalid")).max(1_000_000_000, err("salary_invalid")).nullable();
export const preferencesSchema = z
  .object({
    employment_types: z.array(z.enum(E.employment_type)).max(8),
    schedules: z.array(z.enum(E.work_schedule)).max(6),
    work_time_from: z.string().regex(TIME_RE, err("time_invalid")).or(z.literal("")),
    work_time_to: z.string().regex(TIME_RE, err("time_invalid")).or(z.literal("")),
    salary_min: money,
    salary_expected: money,
    salary_type: z.enum(E.salary_type, err("required")),
    availability: z.enum(E.availability, err("required")),
    work_format: z.enum(E.work_format, err("required")),
    official_terms: z.array(z.string().max(50)).max(20),
  })
  .refine((p) => p.salary_min === null || p.salary_expected === null || p.salary_expected >= p.salary_min, {
    ...err("salary_order"),
    path: ["salary_expected"],
  });
export type PreferencesInput = z.infer<typeof preferencesSchema>;

// ---------- boshqa ----------
export const skipStepSchema = z.object({ step: z.union([z.literal(6), z.literal(7)]) });
