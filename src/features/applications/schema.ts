import { z } from "zod";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const uuidSchema = z.string().regex(UUID_RE);

export const withdrawApplicationSchema = z.object({
  applicationId: uuidSchema,
});
export type WithdrawApplicationInput = z.infer<typeof withdrawApplicationSchema>;

export const EMPLOYER_STATUSES = ["shortlisted", "interview", "offered", "hired", "rejected"] as const;

export const setApplicationStatusSchema = z
  .object({
    applicationId: uuidSchema,
    vacancyId: uuidSchema,
    status: z.enum(EMPLOYER_STATUSES),
    note: z.string().trim().max(1000).optional(),
  })
  .refine((d) => d.status !== "interview" || (d.note !== undefined && d.note.length >= 3), { message: "note_required", path: ["note"] });
export type SetApplicationStatusInput = z.infer<typeof setApplicationStatusSchema>;

/** Sharh manbai: aynan bittasi — ariza (hired) yoki taklif (hired_at) */
export const createReviewSchema = z
  .object({
    applicationId: uuidSchema.optional(),
    offerId: uuidSchema.optional(),
    rating: z.number().int().min(1).max(5),
    text: z.string().trim().max(2000).optional(),
    /** Ish beruvchi tomonidan chaqirilsa — pipeline sahifalarini revalidate qilish uchun */
    vacancyId: uuidSchema.optional(),
  })
  .refine((d) => (d.applicationId ? 1 : 0) + (d.offerId ? 1 : 0) === 1, { message: "one_source_required", path: ["applicationId"] });
export type CreateReviewInput = z.infer<typeof createReviewSchema>;

/** Suhbat: sana-vaqt (ISO, Toshkent vaqti bilan), joy (ixtiyoriy), izoh (ixtiyoriy) */
export const scheduleInterviewSchema = z.object({
  applicationId: uuidSchema,
  vacancyId: uuidSchema,
  at: z.string().datetime({ offset: true }),
  place: z.string().trim().max(300).optional(),
  note: z.string().trim().max(1000).optional(),
});

export const bulkStatusSchema = z.object({
  vacancyId: uuidSchema,
  ids: z.array(uuidSchema).min(1).max(100),
  status: z.enum(["shortlisted", "rejected"]),
  note: z.string().trim().max(1000).optional(),
});

export const addNoteSchema = z.object({ applicationId: uuidSchema, vacancyId: uuidSchema, body: z.string().trim().min(1).max(1000) });
export const deleteNoteSchema = z.object({ id: uuidSchema, applicationId: uuidSchema, vacancyId: uuidSchema });
