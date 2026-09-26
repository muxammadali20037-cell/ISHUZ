import { z } from "zod";

const uuid = z.string().uuid();
const folder = z
  .string()
  .trim()
  .max(60)
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional();
const note = z
  .string()
  .trim()
  .max(1000)
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional();
const money = z.number().int().min(0).max(1_000_000_000).nullable().optional();

export const toggleSaveSchema = z.object({ workerId: uuid, save: z.boolean() });
export const saveWorkerSchema = z.object({ workerId: uuid, folder, note });
export const unsaveWorkerSchema = z.object({ workerId: uuid });
export const updateSavedNoteSchema = z.object({ workerId: uuid, note });
export const moveSavedFolderSchema = z.object({ workerId: uuid, folder });

export const sendOfferSchema = z
  .object({
    workerId: uuid,
    vacancyId: uuid.nullable(),
    title: z.string().trim().max(120).optional(),
    message: z.string().trim().max(2000).optional(),
    salaryFrom: money,
    salaryTo: money,
  })
  .superRefine((v, ctx) => {
    if (!v.vacancyId && (!v.title || v.title.length < 2)) {
      ctx.addIssue({ code: "custom", path: ["title"], message: "title_required" });
    }
    if (v.salaryFrom != null && v.salaryTo != null && v.salaryTo < v.salaryFrom) {
      ctx.addIssue({ code: "custom", path: ["salaryTo"], message: "salary_range" });
    }
  });

export type ToggleSaveInput = z.input<typeof toggleSaveSchema>;
export type SaveWorkerInput = z.input<typeof saveWorkerSchema>;
export type UnsaveWorkerInput = z.input<typeof unsaveWorkerSchema>;
export type UpdateSavedNoteInput = z.input<typeof updateSavedNoteSchema>;
export type MoveSavedFolderInput = z.input<typeof moveSavedFolderSchema>;
export type SendOfferInput = z.input<typeof sendOfferSchema>;
