import { z } from "zod";
import { uuidSchema } from "@/features/applications/schema";

export const respondOfferSchema = z.object({
  offerId: uuidSchema,
  accept: z.boolean(),
});
export type RespondOfferInput = z.infer<typeof respondOfferSchema>;

export const offerIdSchema = z.object({
  offerId: uuidSchema,
  /** Vakansiya bo'yicha taklif bo'lsa — pipeline sahifalarini revalidate qilish uchun */
  vacancyId: uuidSchema.optional(),
});
export type OfferIdInput = z.infer<typeof offerIdSchema>;
