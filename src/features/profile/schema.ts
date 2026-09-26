import { z } from "zod";
import { Constants } from "@/types/database.types";
import { EDIT_SECTIONS, PORTFOLIO_MAX_FILES, THEMES } from "./pure";

const E = Constants.public.Enums;

export const MAX_SKILLS = 30;
export const MAX_LANGUAGES = 15;
export const MAX_WORK_DISTRICTS = 30;

const uuid = z.uuid();
const isoDate = z.iso.date();
const optionalText = (max: number) => z.string().trim().max(max).default("");
const nullableUuid = uuid.nullable();

/** YYYY-MM-DD → yosh 14..90 (DB check bilan bir xil) */
function ageOk(iso: string): boolean {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age >= 14 && age <= 90;
}

export const workerStatusSchema = z.object({ status: z.enum(E.worker_status) });

export const personalSchema = z.object({
  first_name: z.string().trim().min(2).max(60),
  last_name: z.string().trim().min(1).max(60),
  birth_date: isoDate.refine(ageOk, { message: "invalid_birth_date" }).nullable(),
  gender: z.enum(E.gender).nullable(),
});
export type PersonalInput = z.infer<typeof personalSchema>;

export const avatarPathSchema = z.object({ path: z.string().min(3).max(200) });

export const aboutSchema = z.object({
  headline: optionalText(80),
  about: optionalText(2000),
});
export type AboutInput = z.infer<typeof aboutSchema>;

export const geoSchema = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) });

export const locationSchema = z.object({
  region_id: nullableUuid,
  district_id: nullableUuid,
  area_hint: optionalText(120),
  work_district_ids: z.array(uuid).max(MAX_WORK_DISTRICTS).default([]),
  remote_preference: z.enum(E.remote_preference),
  geo: geoSchema.nullable(),
});
export type LocationInput = z.infer<typeof locationSchema>;

export const categorySchema = z.object({
  category_id: uuid,
  subcategory_id: nullableUuid,
  experience_level: z.enum(E.experience_level),
});
export type CategoryInput = z.infer<typeof categorySchema>;

export const experienceSchema = z
  .object({
    id: uuid.optional(),
    company_name: z.string().trim().min(2).max(120),
    position: z.string().trim().min(2).max(120),
    started_on: isoDate,
    ended_on: isoDate.nullable(),
    is_current: z.boolean(),
    responsibilities: optionalText(2000),
    achievements: optionalText(2000),
  })
  .refine((d) => d.is_current || !!d.ended_on, { message: "required", path: ["ended_on"] })
  .refine((d) => d.is_current || !d.ended_on || d.ended_on >= d.started_on, { message: "invalid_dates", path: ["ended_on"] });
export type ExperienceInput = z.infer<typeof experienceSchema>;

export const idSchema = z.object({ id: uuid });

export const skillsSchema = z.object({
  skills: z.array(z.object({ skill_id: uuid, level: z.enum(E.skill_level) })).max(MAX_SKILLS),
});
export type SkillsInput = z.infer<typeof skillsSchema>;

export const customSkillSchema = z.object({ name: z.string().trim().min(2).max(60), category_id: nullableUuid.optional() });

export const languagesSchema = z.object({
  languages: z.array(z.object({ code: z.string().min(2).max(8), level: z.enum(E.language_level) })).max(MAX_LANGUAGES),
});
export type LanguagesInput = z.infer<typeof languagesSchema>;

const year = z.number().int().min(1950).max(2100);
export const educationSchema = z
  .object({
    id: uuid.optional(),
    level: z.enum(E.education_level),
    institution: optionalText(160),
    field: optionalText(160),
    started_year: year.nullable(),
    ended_year: year.nullable(),
  })
  .refine((d) => !d.started_year || !d.ended_year || d.ended_year >= d.started_year, { message: "invalid_dates", path: ["ended_year"] });
export type EducationInput = z.infer<typeof educationSchema>;

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const money = z.number().int().min(0).max(1_000_000_000);
export const preferencesSchema = z
  .object({
    employment_types: z.array(z.enum(E.employment_type)).max(8),
    schedules: z.array(z.enum(E.work_schedule)).max(6),
    work_time_from: hhmm.nullable(),
    work_time_to: hhmm.nullable(),
    salary_min: money.nullable(),
    salary_expected: money.nullable(),
    salary_type: z.enum(E.salary_type),
    availability: z.enum(E.availability),
    official_terms: z.array(z.string().min(1).max(60)).max(20),
    work_format: z.enum(E.work_format),
  })
  .refine((d) => d.salary_min === null || d.salary_expected === null || d.salary_expected >= d.salary_min, { message: "salary_range", path: ["salary_expected"] });
export type PreferencesInput = z.infer<typeof preferencesSchema>;

export const visibilitySchema = z.object({ is_public: z.boolean() });

const httpsUrl = z.url({ protocol: /^https?$/ }).max(500);
export const portfolioItemSchema = z
  .object({
    id: uuid.optional(),
    title: z.string().trim().min(2).max(120),
    description: optionalText(1000),
    type: z.enum(E.portfolio_type),
    media_paths: z.array(z.string().min(3).max(300)).max(PORTFOLIO_MAX_FILES),
    link_url: httpsUrl.nullable(),
  })
  .refine((d) => d.type !== "link" || !!d.link_url, { message: "link_required", path: ["link_url"] })
  .refine((d) => d.type === "link" || d.media_paths.length > 0, { message: "media_required", path: ["media_paths"] });
export type PortfolioItemInput = z.infer<typeof portfolioItemSchema>;

export const moveSchema = z.object({ id: uuid, direction: z.enum(["up", "down"]) });

export const phoneVisibilitySchema = z.object({ phone_visibility: z.enum(E.phone_visibility) });
export const revokeGrantSchema = z.object({ grantee_profile_id: uuid });
export const themeSchema = z.object({ theme: z.enum(THEMES) });

export const editSectionSchema = z.enum(EDIT_SECTIONS);
