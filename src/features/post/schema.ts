import { z } from "zod";

const schedule = z.enum(["5_2", "6_1", "2_2", "shift", "flexible", "negotiable"]);
/** "Kasbim topilmadi": asl nom (bo'shliqlar ixchamlanadi) + eng yaqin soha */
const customProfession = z
  .object({ text: z.string().trim().transform((s) => s.replace(/\s+/g, " ")).pipe(z.string().min(2).max(120)), categoryId: z.uuid() })
  .nullable()
  .optional();
/** katalog kasbi YOKI custom kasb — aynan bittasi */
const oneProfession = (v: { professionNodeId: string | null; customProfession?: { text: string; categoryId: string } | null }) =>
  (v.professionNodeId === null) !== !v.customProfession;
const phone = z.string().regex(/^\+998\d{9}$/);

/** Ishchi e'loni (server ham, mijoz ham shu bilan tekshiradi) */
export const workerListingSchema = z
  .object({
  professionNodeId: z.uuid().nullable(),
  customProfession,
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
  })
  .refine(oneProfession, { path: ["professionNodeId"] });
export type WorkerListingInput = z.infer<typeof workerListingSchema>;

/** Ish beruvchi e'loni */
export const vacancyListingSchema = z
  .object({
    vacancyId: z.uuid().nullable(),
    clientRef: z.uuid(),
    professionNodeId: z.uuid().nullable(),
    customProfession,
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
    /** oddiy formada: oylik yoki kunlik (0060); berilmasa — mavjud tur saqlanadi (yangi e'lon — oylik) */
    salaryType: z.enum(["monthly", "daily"]).optional(),
    experienceMonths: z.union([z.literal(0), z.literal(12), z.literal(36)]),
    showPhone: z.boolean(),
    source: z.enum(["manual", "ai"]).optional(),
    photoPath: z.string().regex(/^[0-9a-f-]{36}\/(?:[0-9a-f-]{36}\.(?:jpg|png|webp)|v-[0-9a-f]{64}\.webp)$/).nullable().optional(),
  })
  .refine(oneProfession, { path: ["professionNodeId"] })
  .refine((v) => v.remote || !!v.regionId, { path: ["regionId"] })
  .refine((v) => v.negotiable || v.salaryFrom !== null || v.salaryTo !== null, { path: ["salaryFrom"] })
  .refine((v) => v.salaryFrom === null || v.salaryTo === null || v.salaryTo >= v.salaryFrom, { path: ["salaryTo"] });
export type VacancyListingInput = z.infer<typeof vacancyListingSchema>;

// pul matni yordamchilari zod'siz faylda — formalar va qidiruv sahifasi zod'ni brauzerga yuklamasin
export { formatMoneyInput, parseMoney } from "./money";
