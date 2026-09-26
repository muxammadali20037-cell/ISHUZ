import { z } from "zod";

export const MAX_FILE_BYTES = 15 * 1024 * 1024;
export const MAX_FILE_MB = 15;
export const MAX_VOICE_SECONDS = 300;

/** 0011_storage.sql: chat bucket ruxsat etilgan MIME turlari */
export const IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp"] as const;
export const DOCUMENT_MIMES = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"] as const;
export const VOICE_MIMES = ["audio/webm", "audio/ogg", "audio/mpeg"] as const;

export const conversationIdSchema = z.guid();
export const messageIdSchema = z.number().int().positive();

/** chat/<conversation_id>/<uuid>.<ext> */
export const attachmentPathSchema = z.string().regex(/^[0-9a-fA-F-]{36}\/[A-Za-z0-9._-]{1,120}$/);

export const attachmentMetaSchema = z.object({
  name: z.string().max(255).optional(),
  size: z.number().int().nonnegative().optional(),
  mime: z.string().max(120).optional(),
  duration: z.number().nonnegative().max(3600).optional(),
});

export const sendTextSchema = z.object({ conversationId: conversationIdSchema, body: z.string().trim().min(1).max(4000) });
export const sendAttachmentSchema = z.object({
  conversationId: conversationIdSchema,
  type: z.enum(["image", "document", "voice"]),
  path: attachmentPathSchema,
  meta: attachmentMetaSchema,
});
export const sendLocationSchema = z.object({ conversationId: conversationIdSchema, lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) });
export const loadOlderSchema = z.object({ conversationId: conversationIdSchema, before: messageIdSchema });
export const conversationSchema = z.object({ conversationId: conversationIdSchema });
export const blockSchema = z.object({ conversationId: conversationIdSchema, blocked: z.boolean() });
export const muteSchema = z.object({ conversationId: conversationIdSchema, muted: z.boolean() });
export const deleteMessageSchema = z.object({ conversationId: conversationIdSchema, messageId: messageIdSchema });
export const attachmentUrlSchema = z.object({ path: attachmentPathSchema });
export const newConversationSchema = z
  .object({ application_id: z.guid().optional(), offer_id: z.guid().optional() })
  .refine((v) => (v.application_id ? 1 : 0) + (v.offer_id ? 1 : 0) === 1, { message: "one_source_required" });
