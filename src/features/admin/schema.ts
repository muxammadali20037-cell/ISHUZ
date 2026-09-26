import { z } from "zod";

/** Admin formalar uchun zod sxemalar (client va server bir xil) */

export const uuid = z.string().uuid();
const note = z.string().trim().max(1000).optional();
const slug = z
  .string()
  .trim()
  .min(2)
  .max(60)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug");
const name = z.string().trim().min(2).max(120);

export const userBlockSchema = z.object({
  profileId: uuid,
  block: z.boolean(),
  reason: z.string().trim().max(500).optional(),
});
export type UserBlockInput = z.infer<typeof userBlockSchema>;

export const ADMIN_VACANCY_STATUSES = ["active", "hidden", "rejected", "closed"] as const;
export const vacancyStatusSchema = z.object({
  vacancyId: uuid,
  status: z.enum(ADMIN_VACANCY_STATUSES),
  note,
});
export type VacancyStatusInput = z.infer<typeof vacancyStatusSchema>;

export const resolveReportSchema = z.object({
  reportId: uuid,
  status: z.enum(["in_review", "resolved", "dismissed"]),
  note,
});
export type ResolveReportInput = z.infer<typeof resolveReportSchema>;

export const moderateReviewSchema = z.object({
  reviewId: uuid,
  status: z.enum(["approved", "rejected"]),
  note,
});
export type ModerateReviewInput = z.infer<typeof moderateReviewSchema>;

export const reviewVerificationSchema = z.object({
  requestId: uuid,
  status: z.enum(["verified", "rejected"]),
  note,
});
export type ReviewVerificationInput = z.infer<typeof reviewVerificationSchema>;

export const documentUrlSchema = z.object({
  path: z
    .string()
    .min(3)
    .max(400)
    .regex(/^[0-9a-f-]{36}\/[^\s]+$/i, "path"),
});

export const broadcastSchema = z.object({
  title: z.string().trim().min(3).max(120),
  body: z.string().trim().min(3).max(2000),
  role: z.enum(["all", "worker", "employer"]),
  link: z
    .string()
    .trim()
    .max(300)
    .regex(/^(\/[^\s]*)?$/, "link")
    .optional(),
});
export type BroadcastInput = z.infer<typeof broadcastSchema>;

// ---------- ma'lumotnoma ----------
export const categorySchema = z.object({
  id: uuid.optional(),
  slug,
  name_uz: name,
  name_ru: name,
  icon: z.string().trim().max(40).optional(),
  sort_order: z.coerce.number().int().min(0).max(10000),
  is_active: z.boolean(),
  portfolio_recommended: z.boolean(),
});
export type CategoryInput = z.infer<typeof categorySchema>;

export const subcategorySchema = z.object({
  id: uuid.optional(),
  category_id: uuid,
  slug,
  name_uz: name,
  name_ru: name,
  sort_order: z.coerce.number().int().min(0).max(10000),
  is_active: z.boolean(),
});
export type SubcategoryInput = z.infer<typeof subcategorySchema>;

export const skillUpdateSchema = z.object({
  id: uuid,
  name_uz: name,
  name_ru: name,
  category_id: uuid.nullable(),
  is_approved: z.boolean(),
});
export type SkillUpdateInput = z.infer<typeof skillUpdateSchema>;

export const regionSchema = z.object({
  id: uuid.optional(),
  slug,
  name_uz: name,
  name_ru: name,
  sort_order: z.coerce.number().int().min(0).max(10000),
  is_active: z.boolean(),
});
export type RegionInput = z.infer<typeof regionSchema>;

export const districtSchema = z.object({
  id: uuid.optional(),
  region_id: uuid,
  slug,
  name_uz: name,
  name_ru: name,
  lat: z.coerce.number().min(-90).max(90).nullable(),
  lng: z.coerce.number().min(-180).max(180).nullable(),
  sort_order: z.coerce.number().int().min(0).max(10000),
  is_active: z.boolean(),
});
export type DistrictInput = z.infer<typeof districtSchema>;

// ---------- sozlamalar / adminlar ----------
export const settingUpdateSchema = z.object({
  key: z.string().min(1).max(80),
  /** JSON matn (client tomonda tipga qarab tuziladi) */
  valueJson: z.string().min(1).max(20000),
  is_public: z.boolean(),
});
export type SettingUpdateInput = z.infer<typeof settingUpdateSchema>;

export const ADMIN_ROLE_VALUES = ["super_admin", "admin", "moderator", "support"] as const;

export const adminUpsertSchema = z.object({
  profileId: uuid,
  role: z.enum(ADMIN_ROLE_VALUES),
  permissions: z.array(z.string().max(60)).max(40).default([]),
  is_active: z.boolean().default(true),
});
export type AdminUpsertInput = z.infer<typeof adminUpsertSchema>;
