import "server-only";

import { createClient, type SupabaseServerClient } from "@/lib/supabase/server";
import type { SessionContext } from "@/features/auth/session";
import { fullName } from "@/lib/format";
import type { ChatMember, ConversationListItem, ConversationView, MessagesPage } from "./types";
import { rowToMessage } from "./utils";

export const PAGE_SIZE = 50;
export const SIGNED_URL_TTL = 3600;

/** Mening suhbatlarim (my_conversations RPC: security definer, RLS ichida) */
export async function getMyConversations(): Promise<ConversationListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_conversations");
  if (error) {
    console.error("[chat] my_conversations", error.message);
    return [];
  }
  return data ?? [];
}

/** Yopiq `chat` bucket fayllari uchun vaqtinchalik URL'lar (RLS: faqat suhbat a'zolari) */
export async function signAttachmentUrls(supabase: SupabaseServerClient, paths: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(paths.filter((p) => p.length > 0))];
  const map = new Map<string, string>();
  if (!unique.length) return map;
  const { data, error } = await supabase.storage.from("chat").createSignedUrls(unique, SIGNED_URL_TTL);
  if (error) {
    console.error("[chat] createSignedUrls", error.message);
    return map;
  }
  for (const item of data ?? []) {
    if (item.path && item.signedUrl && !item.error) map.set(item.path, item.signedUrl);
  }
  return map;
}

/** Suhbat xabarlari sahifasi: oxirgi PAGE_SIZE ta (yoki `before` id dan oldingilar), created_at bo'yicha o'sish tartibida */
export async function getMessagesPage(conversationId: string, before?: number): Promise<MessagesPage> {
  const supabase = await createClient();
  let query = supabase.from("messages").select("*").eq("conversation_id", conversationId).order("id", { ascending: false }).limit(PAGE_SIZE);
  if (before) query = query.lt("id", before);
  const { data, error } = await query;
  if (error) {
    console.error("[chat] messages", error.message);
    return { messages: [], hasMore: false };
  }
  const rows = (data ?? []).slice().reverse();
  const signed = await signAttachmentUrls(
    supabase,
    rows.flatMap((r) => (r.attachment_path && !r.deleted_at ? [r.attachment_path] : [])),
  );
  return {
    messages: rows.map((r) => rowToMessage(r, r.attachment_path ? (signed.get(r.attachment_path) ?? null) : null)),
    hasMore: (data?.length ?? 0) === PAGE_SIZE,
  };
}

/**
 * Suhbat sarlavhasi uchun ko'rinish: a'zolar, kontekst (vakansiya/taklif), havolalar.
 * RLS: suhbat meniki bo'lmasa `conversations` null qaytaradi → null.
 */
export async function getConversationView(conversationId: string, session: SessionContext): Promise<ConversationView | null> {
  const supabase = await createClient();
  const me = session.userId;

  const [convRes, membersRes, listRes] = await Promise.all([
    supabase.from("conversations").select("id, application_id, job_offer_id").eq("id", conversationId).maybeSingle(),
    supabase
      .from("conversation_members")
      .select("profile_id, is_blocked, is_muted, last_read_at, joined_at, profiles(first_name, last_name, avatar_url)")
      .eq("conversation_id", conversationId)
      .order("joined_at", { ascending: true }),
    supabase.rpc("my_conversations"),
  ]);

  const conv = convRes.data;
  if (!conv) return null;
  const members = membersRes.data ?? [];
  const meRow = members.find((m) => m.profile_id === me);
  const otherRow = members.find((m) => m.profile_id !== me);
  if (!meRow || !otherRow) return null;
  const listRow = (listRes.data ?? []).find((c) => c.id === conversationId);

  const toMember = (row: typeof meRow, fallbackName: string, fallbackAvatar: string | null): ChatMember => ({
    profile_id: row.profile_id,
    name: fullName(row.profiles?.first_name, row.profiles?.last_name) || fallbackName,
    avatar_url: row.profiles?.avatar_url ?? fallbackAvatar,
    is_blocked: row.is_blocked,
    is_muted: row.is_muted,
    last_read_at: row.last_read_at,
  });

  const meMember = toMember(meRow, fullName(session.profile.first_name, session.profile.last_name), session.profile.avatar_url);
  const otherMember = toMember(otherRow, listRow?.other_name ?? "", listRow?.other_avatar_url ?? null);

  // Kontekst: ariza → vakansiya, yoki taklif
  let context: ConversationView["context"];
  let otherHref: string | null = null;

  if (conv.application_id) {
    const { data: app } = await supabase
      .from("applications")
      .select("id, vacancy_id, worker_id, vacancies(id, slug, title, companies(name, slug))")
      .eq("id", conv.application_id)
      .maybeSingle();
    const vacancy = app?.vacancies ?? null;
    const amWorker = !!session.workerId && app?.worker_id === session.workerId;
    const companySlug = vacancy?.companies?.slug ?? null;
    context = {
      kind: "application",
      id: conv.application_id,
      title: vacancy?.title ?? listRow?.context_title ?? "",
      company: vacancy?.companies?.name ?? listRow?.company_name ?? null,
      href: amWorker ? `/applications/${conv.application_id}` : vacancy?.slug ? `/jobs/${vacancy.slug}` : app?.vacancy_id ? `/employer/vacancies/${app.vacancy_id}/applications` : null,
    };
    otherHref = amWorker ? (companySlug ? `/company/${companySlug}` : null) : app?.worker_id ? `/workers/${app.worker_id}` : null;
  } else {
    const offerId = conv.job_offer_id ?? "";
    const { data: offer } = await supabase
      .from("job_offers")
      .select("id, title, vacancy_id, worker_id, vacancies(id, slug, title), companies(name, slug)")
      .eq("id", offerId)
      .maybeSingle();
    const amWorker = !!session.workerId && offer?.worker_id === session.workerId;
    const companySlug = offer?.companies?.slug ?? null;
    context = {
      kind: "offer",
      id: offerId,
      title: offer?.vacancies?.title ?? offer?.title ?? listRow?.context_title ?? "",
      company: offer?.companies?.name ?? listRow?.company_name ?? null,
      href: amWorker ? `/offers/${offerId}` : offer?.vacancies?.slug ? `/jobs/${offer.vacancies.slug}` : `/offers/${offerId}`,
    };
    otherHref = amWorker ? (companySlug ? `/company/${companySlug}` : null) : offer?.worker_id ? `/workers/${offer.worker_id}` : null;
  }

  return { id: conv.id, me: meMember, other: otherMember, context, otherHref };
}
