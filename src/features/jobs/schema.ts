import { z } from "zod";
import { APPLY_MESSAGE_MAX } from "./limits";

export { APPLY_MESSAGE_MAX };

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
