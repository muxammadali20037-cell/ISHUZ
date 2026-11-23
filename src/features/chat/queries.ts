import "server-only";

import { createClient, type SupabaseServerClient } from "@/lib/supabase/server";
import type { SessionContext } from "@/features/auth/session";
import { fullName } from "@/lib/format";
import type { ChatIntro, ChatMember, ConversationListItem, ConversationView, MessagesPage } from "./types";
import { getT } from "@/lib/i18n/server";
import { getDistricts, getRegions } from "@/lib/reference";
import { getListingImageUrl } from "@/features/listing-image/server";
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

/**
 * Suhbatdagi qarshi tomon (S3, "Ish beruvchilar · Nomzodlar" filtri uchun): suhbat ariza yoki taklifga bog'langan —
 * o'sha ariza/taklif ishchisi men bo'lsam, qarshi tomon ish beruvchi; aks holda — nomzod. RLS: faqat ishtirokchilar o'qiydi.
 */
export async function conversationSides(items: ConversationListItem[], workerId: string | null): Promise<Map<string, "employer" | "candidate">> {
  const sides = new Map<string, "employer" | "candidate">();
  const appIds = items.map((c) => c.application_id).filter((x): x is string => !!x);
  const offerIds = items.map((c) => c.job_offer_id).filter((x): x is string => !!x);
  if (!appIds.length && !offerIds.length) return sides;
  const supabase = await createClient();
  const [apps, offers] = await Promise.all([
    appIds.length ? supabase.from("applications").select("id, worker_id").in("id", appIds) : Promise.resolve({ data: [] as { id: string; worker_id: string }[] }),
    offerIds.length ? supabase.from("job_offers").select("id, worker_id").in("id", offerIds) : Promise.resolve({ data: [] as { id: string; worker_id: string }[] }),
  ]);
  const workerOf = new Map<string, string>();
  for (const r of [...(apps.data ?? []), ...(offers.data ?? [])]) workerOf.set(r.id, r.worker_id);
  for (const c of items) {
    const w = workerOf.get(c.application_id ?? c.job_offer_id ?? "");
    if (w) sides.set(c.id, workerId && w === workerId ? "employer" : "candidate");
  }
  return sides;
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
/** "Toshkent shahri, Chilonzor" — joriy tilda; topilmasa null */
async function placeName(regionId: string | null | undefined, districtId: string | null | undefined): Promise<string | null> {
  if (!regionId) return null;
  const [{ name }, regions, districts] = await Promise.all([getT(), getRegions(), getDistricts()]);
  const region = regions.find((r) => r.id === regionId);
  if (!region) return null;
  const district = districtId ? districts.find((d) => d.id === districtId) : undefined;
  return [name(region), district ? name(district) : null].filter(Boolean).join(", ");
}

/** Qadalgan karta uchun ishchi e'loni: kasb (joriy tilda), hudud, e'lon rasmi */
async function workerCard(supabase: SupabaseServerClient, workerId: string): Promise<{ title: string; place: string | null; image: string | null } | null> {
  const { data } = await supabase
    .from("worker_profiles")
    .select("id, region_id, district_id, headline, custom_profession, profession:profession_nodes!worker_profiles_profession_node_id_fkey(name_uz, name_ru, name_en)")
    .eq("id", workerId)
    .maybeSingle();
  if (!data) return null;
  const { name } = await getT();
  const node = Array.isArray(data.profession) ? (data.profession[0] ?? null) : data.profession;
  const title = (node ? name(node) : null) || data.custom_profession || data.headline || "";
  const [place, image] = await Promise.all([placeName(data.region_id, data.district_id), getListingImageUrl("worker", workerId)]);
  return { title, place, image };
}

export async function getConversationView(conversationId: string, session: SessionContext): Promise<ConversationView | null> {
  const supabase = await createClient();
  const me = session.userId;

  const [convRes, membersRes, listRes] = await Promise.all([
    supabase.from("conversations").select("*").eq("id", conversationId).maybeSingle(),
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
  let intro: ChatIntro | null = null;

  // 0088: raqami ochilgan juftlik — qaysi e'londan ochilgan bo'lsa, o'sha e'lon (ustunlar hali yo'q bazada — undefined)
  const unlock = conv as { unlock_viewer?: string | null; unlock_target?: string | null };
  if (unlock.unlock_viewer && unlock.unlock_target) {
    const { data: u } = await supabase
      .from("contact_unlocks")
      .select("worker_id")
      .eq("viewer_profile_id", unlock.unlock_viewer)
      .eq("target_profile_id", unlock.unlock_target)
      .maybeSingle();
    const workerId = u?.worker_id ?? null;
    const card = workerId ? await workerCard(supabase, workerId) : null;
    context = {
      kind: "listing",
      id: workerId ?? conv.id,
      title: card?.title || listRow?.context_title || "",
      company: null,
      href: workerId ? `/listing/${workerId}` : null,
      place: card?.place ?? null,
      image: card?.image ?? null,
      listing: "worker",
    };
    // ish beruvchi — ishchi e'loniga; ishchi — o'z e'loniga havola kontekstda bor, suhbatdosh sahifasi yo'q
    otherHref = me === unlock.unlock_viewer && workerId ? `/listing/${workerId}` : null;
    // raqamni ochgan ish beruvchi yozadi — ishchiga tayyor xat
    intro = me === unlock.unlock_viewer ? "to_worker" : null;
  } else if (conv.application_id) {
    const { data: app } = await supabase
      .from("applications")
      .select("id, vacancy_id, worker_id, vacancies(id, slug, title, region_id, district_id, companies(name, slug))")
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
      place: vacancy ? await placeName(vacancy.region_id, vacancy.district_id) : null,
      image: vacancy?.id ? await getListingImageUrl("vacancy", vacancy.id) : null,
      listing: "vacancy",
    };
    intro = amWorker ? "to_employer" : "to_applicant";
    otherHref = amWorker ? (companySlug ? `/company/${companySlug}` : null) : app?.worker_id ? `/workers/${app.worker_id}` : null;
  } else {
    const offerId = conv.job_offer_id ?? "";
    const { data: offer } = await supabase
      .from("job_offers")
      .select("id, title, vacancy_id, worker_id, vacancies(id, slug, title, region_id, district_id), companies(name, slug)")
      .eq("id", offerId)
      .maybeSingle();
    const amWorker = !!session.workerId && offer?.worker_id === session.workerId;
    const companySlug = offer?.companies?.slug ?? null;
    const ov = offer?.vacancies ?? null;
    context = {
      kind: "offer",
      id: offerId,
      title: ov?.title ?? offer?.title ?? listRow?.context_title ?? "",
      company: offer?.companies?.name ?? listRow?.company_name ?? null,
      href: amWorker ? `/offers/${offerId}` : ov?.slug ? `/jobs/${ov.slug}` : `/offers/${offerId}`,
      place: ov ? await placeName(ov.region_id, ov.district_id) : null,
      image: ov?.id ? await getListingImageUrl("vacancy", ov.id) : null,
      listing: "vacancy",
    };
    intro = amWorker ? "to_employer" : "to_applicant";
    otherHref = amWorker ? (companySlug ? `/company/${companySlug}` : null) : offer?.worker_id ? `/workers/${offer.worker_id}` : null;
  }

  return { id: conv.id, me: meMember, other: otherMember, context, otherHref, intro, otherFirstName: otherRow.profiles?.first_name?.trim() || null };
}
