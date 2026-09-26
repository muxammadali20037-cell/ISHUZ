import { z } from "zod";

export const APPLY_MESSAGE_MAX = 1000;

export const toggleSaveSchema = z.object({
  vacancyId: z.uuid(),
  save: z.boolean(),
});
export type ToggleSaveInput = z.infer<typeof toggleSaveSchema>;

export const applySchema = z.object({
  vacancyId: z.uuid(),
  message: z.string().trim().max(APPLY_MESSAGE_MAX).optional(),
});
export type ApplyInput = z.infer<typeof applySchema>;
