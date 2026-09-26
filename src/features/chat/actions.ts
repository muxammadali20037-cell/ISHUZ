"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/features/auth/actions";
import { getSession } from "@/features/auth/session";
import { errorCode } from "@/lib/utils";
import { getMessagesPage, signAttachmentUrls, SIGNED_URL_TTL } from "./queries";
import {
  attachmentUrlSchema,
  blockSchema,
  conversationSchema,
  deleteMessageSchema,
  loadOlderSchema,
  muteSchema,
  sendAttachmentSchema,
  sendLocationSchema,
  sendTextSchema,
} from "./schema";
import type { ChatMessage, MessagesPage } from "./types";
import { rowToMessage } from "./utils";

/** send_message dan qaytgan id bo'yicha to'liq qatorni (va imzolangan URL) qaytaradi */
async function loadSentMessage(messageId: number): Promise<ActionResult<ChatMessage>> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("messages").select("*").eq("id", messageId).maybeSingle();
  if (error || !data) return { ok: false, error: error ? errorCode(error) : "not_found" };
  let signedUrl: string | null = null;
  if (data.attachment_path) {
    const signed = await signAttachmentUrls(supabase, [data.attachment_path]);
    signedUrl = signed.get(data.attachment_path) ?? null;
  }
  return { ok: true, data: rowToMessage(data, signedUrl) };
}

/** Matnli xabar */
export async function sendTextMessage(input: unknown): Promise<ActionResult<ChatMessage>> {
  const parsed = sendTextSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const session = await getSession();
  if (!session) return { ok: false, error: "not_authenticated" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("send_message", { p_conversation_id: parsed.data.conversationId, p_type: "text", p_body: parsed.data.body });
  if (error) return { ok: false, error: errorCode(error) };
  revalidatePath("/messages");
  return loadSentMessage(data);
}

/** Rasm / fayl / ovozli xabar — fayl client'da `chat` bucket'ga yuklangan bo'lishi kerak */
export async function sendAttachmentMessage(input: unknown): Promise<ActionResult<ChatMessage>> {
  const parsed = sendAttachmentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const { conversationId, type, path, meta } = parsed.data;
  if (!path.startsWith(`${conversationId}/`)) return { ok: false, error: "validation" };
  const session = await getSession();
  if (!session) return { ok: false, error: "not_authenticated" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("send_message", {
    p_conversation_id: conversationId,
    p_type: type,
    p_attachment_path: path,
    p_attachment_meta: meta,
  });
  if (error) return { ok: false, error: errorCode(error) };
  revalidatePath("/messages");
  return loadSentMessage(data);
}

/** Joylashuv */
export async function sendLocationMessage(input: unknown): Promise<ActionResult<ChatMessage>> {
  const parsed = sendLocationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const session = await getSession();
  if (!session) return { ok: false, error: "not_authenticated" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("send_message", {
    p_conversation_id: parsed.data.conversationId,
    p_type: "location",
    p_lat: parsed.data.lat,
    p_lng: parsed.data.lng,
  });
  if (error) return { ok: false, error: errorCode(error) };
  revalidatePath("/messages");
  return loadSentMessage(data);
}

/** Oldingi xabarlar (id < before) */
export async function loadOlderMessages(input: unknown): Promise<ActionResult<MessagesPage>> {
  const parsed = loadOlderSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const session = await getSession();
  if (!session) return { ok: false, error: "not_authenticated" };
  const page = await getMessagesPage(parsed.data.conversationId, parsed.data.before);
  return { ok: true, data: page };
}

/** O'qildi belgisi (last_read_at = now) */
export async function markConversationRead(input: unknown): Promise<ActionResult> {
  const parsed = conversationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const session = await getSession();
  if (!session) return { ok: false, error: "not_authenticated" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_conversation_read", { p_conversation_id: parsed.data.conversationId });
  if (error) return { ok: false, error: errorCode(error) };
  return { ok: true };
}

/** Bloklash / blokdan chiqarish */
export async function setConversationBlock(input: unknown): Promise<ActionResult> {
  const parsed = blockSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const session = await getSession();
  if (!session) return { ok: false, error: "not_authenticated" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_conversation_block", { p_conversation_id: parsed.data.conversationId, p_blocked: parsed.data.blocked });
  if (error) return { ok: false, error: errorCode(error) };
  revalidatePath(`/messages/${parsed.data.conversationId}`);
  return { ok: true };
}

/** Ovozsiz (faqat o'z conversation_members qatorida is_muted) */
export async function setConversationMuted(input: unknown): Promise<ActionResult> {
  const parsed = muteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const session = await getSession();
  if (!session) return { ok: false, error: "not_authenticated" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("conversation_members")
    .update({ is_muted: parsed.data.muted })
    .eq("conversation_id", parsed.data.conversationId)
    .eq("profile_id", session.userId);
  if (error) return { ok: false, error: errorCode(error) };
  revalidatePath(`/messages/${parsed.data.conversationId}`);
  return { ok: true };
}

/** O'z xabarini o'chirish (yumshoq; faqat delete_message RPC) */
export async function deleteMessage(input: unknown): Promise<ActionResult> {
  const parsed = deleteMessageSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const session = await getSession();
  if (!session) return { ok: false, error: "not_authenticated" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_message", { p_message_id: parsed.data.messageId });
  if (error) return { ok: false, error: errorCode(error) };
  revalidatePath("/messages");
  return { ok: true };
}

/** Yopiq bucket fayli uchun vaqtinchalik URL (RLS: faqat suhbat a'zosi) */
export async function getAttachmentUrl(input: unknown): Promise<ActionResult<{ url: string; expiresIn: number }>> {
  const parsed = attachmentUrlSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const session = await getSession();
  if (!session) return { ok: false, error: "not_authenticated" };
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from("chat").createSignedUrl(parsed.data.path, SIGNED_URL_TTL);
  if (error || !data?.signedUrl) return { ok: false, error: error ? errorCode(error) : "not_found" };
  return { ok: true, data: { url: data.signedUrl, expiresIn: SIGNED_URL_TTL } };
}
