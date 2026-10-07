import { z } from "zod";
import type { Enums } from "@/types/database.types";

/** Xato xabarlari — i18n kalitlari (UI: t(message)) */
const E = {
  title: "vacancies.errors.title_length",
  category: "vacancies.errors.category_required",
  region: "vacancies.errors.region_required",
  salary: "vacancies.errors.salary_range",
  age: "vacancies.errors.age_range",
  time: "vacancies.errors.time_format",
  description: "vacancies.errors.description_max",
  coords: "vacancies.errors.coords_invalid",
  language: "vacancies.errors.duplicate_language",
  skillName: "vacancies.errors.skill_name",
  address: "vacancies.errors.address_max",
} as const;

export const EMPLOYMENT_TYPES = ["full_time", "part_time", "permanent", "temporary", "shift", "remote", "freelance", "internship"] as const satisfies readonly Enums<"employment_type">[];
export const WORK_SCHEDULES = ["5_2", "6_1", "2_2", "shift", "flexible", "negotiable"] as const satisfies readonly Enums<"work_schedule">[];
export const SALARY_TYPES = ["monthly", "daily", "hourly", "piecework", "negotiable"] as const satisfies readonly Enums<"salary_type">[];
export const EDUCATION_LEVELS = ["secondary", "vocational", "incomplete_higher", "higher", "master"] as const satisfies readonly Enums<"education_level">[];
export const LANGUAGE_LEVELS = ["a1", "a2", "b1", "b2", "c1", "c2", "native"] as const satisfies readonly Enums<"language_level">[];
export const GENDERS = ["male", "female"] as const satisfies readonly Enums<"gender">[];
export const EXPERIENCE_OPTIONS = [0, 6, 12, 24, 36, 60] as const;
export const WORK_FORMATS = ["official", "unofficial"] as const satisfies readonly Enums<"work_format">[];

export const DESCRIPTION_MAX = 5000;
export const MAX_SKILLS = 30;
export const MAX_LANGUAGES = 10;

const uuid = z.uuid();
const timeHHMM = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, E.time);

export const titleSchema = z.object({
  title: z.string().trim().min(2, E.title).max(120, E.title),
  /** Taklifdan tanlanganda kategoriya/yo'nalish ham darhol o'rnatiladi */
  subcategoryId: uuid.nullable().optional(),
  /** 1-qadamda kasblar daraxtidan tanlangan kasb (lavozim nomi undan olinadi) */
  professionNodeId: uuid.nullable().optional(),
  /** Daraxtda yo'q — o'zi yozgan kasb + eng yaqin soha */
  customProfession: z.string().trim().min(2).max(120).nullable().optional(),
  categoryId: uuid.nullable().optional(),
});

export const categorySchema = z.object({
  categoryId: uuid.nullable().refine((v): v is string => v !== null, E.category),
  subcategoryId: uuid.nullable(),
  /** kasblar daraxtidagi aniq kasb (ishchilar bilan bir xil daraxt) */
  professionNodeId: uuid.nullable().optional(),
  /** katalogda topilmagan kasb (asl matn) */
  customProfession: z.string().trim().min(2).max(120).nullable().optional(),
});

export const locationSchema = z
  .object({
    isRemote: z.boolean(),
    regionId: uuid.nullable(),
    districtId: uuid.nullable(),
    address: z.string().trim().max(200, E.address).nullable(),
    lat: z.number().min(-90).max(90).nullable(),
    lng: z.number().min(-180).max(180).nullable(),
  })
  .superRefine((d, ctx) => {
    if (!d.isRemote && !d.regionId) ctx.addIssue({ code: "custom", path: ["regionId"], message: E.region });
    if ((d.lat === null) !== (d.lng === null)) ctx.addIssue({ code: "custom", path: ["lat"], message: E.coords });
  });

export const salarySchema = z
  .object({
    salaryNegotiable: z.boolean(),
    salaryFrom: z.number().int().min(0).max(10_000_000_000).nullable(),
    salaryTo: z.number().int().min(0).max(10_000_000_000).nullable(),
    salaryType: z.enum(SALARY_TYPES),
  })
  .superRefine((d, ctx) => {
    if (d.salaryFrom !== null && d.salaryTo !== null && d.salaryTo < d.salaryFrom) ctx.addIssue({ code: "custom", path: ["salaryTo"], message: E.salary });
  });

export const OPPORTUNITY_TYPES = ["job", "fixed_term", "one_time", "seasonal", "internship", "practice", "apprenticeship"] as const satisfies readonly Enums<"opportunity_type">[];
export const LEARNING_OPPORTUNITIES = ["internship", "practice", "apprenticeship"] as const;

export const scheduleSchema = z
  .object({
  opportunityType: z.enum(OPPORTUNITY_TYPES).default("job"),
  /** faqat stajirovka/amaliyot/shogirdlikda: haq to'lanadimi (null — ko'rsatilmagan) */
  isPaid: z.boolean().nullable().default(null),
  studentFriendly: z.boolean().default(false),
  employmentType: z.enum(EMPLOYMENT_TYPES),
  schedule: z.enum(WORK_SCHEDULES),
  workTimeFrom: timeHHMM.nullable(),
  workTimeTo: timeHHMM.nullable(),
  })
  .refine((d) => d.isPaid !== false || (LEARNING_OPPORTUNITIES as readonly string[]).includes(d.opportunityType), { path: ["isPaid"], message: "vacancies.wizard.schedule.unpaid_only_learning" });

export const languageRequirementSchema = z.object({
  code: z.string().min(2).max(8),
  minLevel: z.enum(LANGUAGE_LEVELS),
});

export const requirementsSchema = z
  .object({
    experienceMinMonths: z.number().int().refine((v) => (EXPERIENCE_OPTIONS as readonly number[]).includes(v)),
    /** nechta xodim kerak */
    positionsCount: z.number().int().min(1).max(1000).optional(),
    ageMin: z.number().int().min(14, E.age).max(80, E.age).nullable(),
    ageMax: z.number().int().min(14, E.age).max(80, E.age).nullable(),
    educationMin: z.enum(EDUCATION_LEVELS).nullable(),
    gender: z.enum(GENDERS).nullable(),
    languages: z.array(languageRequirementSchema).max(MAX_LANGUAGES),
  })
  .superRefine((d, ctx) => {
    if (d.ageMin !== null && d.ageMax !== null && d.ageMax < d.ageMin) ctx.addIssue({ code: "custom", path: ["ageMax"], message: E.age });
    const seen = new Set<string>();
    d.languages.forEach((l, i) => {
      if (seen.has(l.code)) ctx.addIssue({ code: "custom", path: ["languages", i, "code"], message: E.language });
      seen.add(l.code);
    });
  });

export const skillsSchema = z.object({
  skills: z.array(z.object({ skillId: uuid, isRequired: z.boolean() })).max(MAX_SKILLS),
});

export const workFormatSchema = z.object({
  workFormat: z.enum(WORK_FORMATS),
  officialTerms: z.array(z.string().min(1).max(64)).max(20),
});

export const descriptionSchema = z.object({
  description: z.string().max(DESCRIPTION_MAX, E.description),
});

export const benefitsSchema = z.object({
  benefits: z.array(z.string().min(1).max(64)).max(30),
});

/** Qadam ma'lumotlari — server action bitta kirish nuqtasi orqali qabul qiladi */
export const stepPayloadSchema = z.discriminatedUnion("step", [
  z.object({ step: z.literal("title"), data: titleSchema }),
  z.object({ step: z.literal("category"), data: categorySchema }),
  z.object({ step: z.literal("location"), data: locationSchema }),
  z.object({ step: z.literal("salary"), data: salarySchema }),
  z.object({ step: z.literal("schedule"), data: scheduleSchema }),
  z.object({ step: z.literal("requirements"), data: requirementsSchema }),
  z.object({ step: z.literal("skills"), data: skillsSchema }),
  z.object({ step: z.literal("work_format"), data: workFormatSchema }),
  z.object({ step: z.literal("description"), data: descriptionSchema }),
  z.object({ step: z.literal("benefits"), data: benefitsSchema }),
]);

export const saveStepInputSchema = z.object({
  vacancyId: uuid,
  payload: stepPayloadSchema,
});

export const vacancyIdSchema = z.object({ vacancyId: uuid });

export const statusChangeSchema = z.object({
  vacancyId: uuid,
  status: z.enum(["paused", "closed", "draft"]),
});

export const customSkillSchema = z.object({
  name: z.string().trim().min(2, E.skillName).max(60, E.skillName),
  categoryId: uuid.nullable(),
});

export type TitleInput = z.infer<typeof titleSchema>;
export type CategoryInput = z.infer<typeof categorySchema>;
export type LocationInput = z.infer<typeof locationSchema>;
export type SalaryInput = z.infer<typeof salarySchema>;
export type ScheduleInput = z.input<typeof scheduleSchema>;
export type ScheduleValues = z.output<typeof scheduleSchema>;
export type RequirementsInput = z.infer<typeof requirementsSchema>;
export type SkillsInput = z.infer<typeof skillsSchema>;
export type WorkFormatInput = z.infer<typeof workFormatSchema>;
export type DescriptionInput = z.infer<typeof descriptionSchema>;
export type BenefitsInput = z.infer<typeof benefitsSchema>;
export type StepPayload = z.infer<typeof stepPayloadSchema>;
export type SaveStepInput = z.infer<typeof saveStepInputSchema>;
export type StatusChangeInput = z.infer<typeof statusChangeSchema>;
export type CustomSkillInput = z.infer<typeof customSkillSchema>;
