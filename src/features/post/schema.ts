import { z } from "zod";

const schedule = z.enum(["5_2", "6_1", "2_2", "shift", "flexible", "negotiable"]);
const phone = z.string().regex(/^\+998\d{9}$/);

/** Ishchi e'loni (server ham, mijoz ham shu bilan tekshiradi) */
export const workerListingSchema = z.object({
  professionNodeId: z.uuid(),
  headline: z.string().trim().max(80).optional(),
  regionId: z.uuid(),
  districtId: z.uuid().nullable(),
  remoteOk: z.boolean(),
  firstName: z.string().trim().min(2).max(60),
  lastName: z.string().trim().max(60),
  about: z.string().trim().min(10).max(1000),
  experience: z.enum(["none", "lt1", "1_3", "3plus"]),
  salary: z.number().int().min(0).max(1_000_000_000).nullable(),
  schedule: schedule.nullable(),
  showPhone: z.boolean(),
  /** "ai" — AI bilan tez tayyorlangan (statistika uchun) */
  source: z.enum(["manual", "ai"]).optional(),
});
export type WorkerListingInput = z.infer<typeof workerListingSchema>;

/** Ish beruvchi e'loni */
export const vacancyListingSchema = z
  .object({
    vacancyId: z.uuid().nullable(),
    clientRef: z.uuid(),
    professionNodeId: z.uuid(),
    title: z.string().trim().max(120),
    regionId: z.uuid().nullable(),
    districtId: z.uuid().nullable(),
    remote: z.boolean(),
    employerType: z.enum(["company", "government", "individual_entrepreneur", "person"]),
    orgName: z.string().trim().min(2).max(120),
    phone,
    description: z.string().trim().min(10).max(4000),
    negotiable: z.boolean(),
    salaryFrom: z.number().int().min(0).max(1_000_000_000).nullable(),
    salaryTo: z.number().int().min(0).max(1_000_000_000).nullable(),
    schedule: schedule.nullable(),
    experienceMonths: z.union([z.literal(0), z.literal(12), z.literal(36)]),
    showPhone: z.boolean(),
    source: z.enum(["manual", "ai"]).optional(),
    photoPath: z.string().regex(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/).nullable().optional(),
  })
  .refine((v) => v.remote || !!v.regionId, { path: ["regionId"] })
  .refine((v) => v.negotiable || v.salaryFrom !== null || v.salaryTo !== null, { path: ["salaryFrom"] })
  .refine((v) => v.salaryFrom === null || v.salaryTo === null || v.salaryTo >= v.salaryFrom, { path: ["salaryTo"] });
export type VacancyListingInput = z.infer<typeof vacancyListingSchema>;

// pul matni yordamchilari zod'siz faylda — formalar va qidiruv sahifasi zod'ni brauzerga yuklamasin
export { formatMoneyInput, parseMoney } from "./money";
