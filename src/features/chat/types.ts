import type { Database, Enums, Tables } from "@/types/database.types";

export type MessageType = Enums<"message_type">;
export type MessageRow = Tables<"messages">;

/** messages.attachment_meta: {name, size, mime, duration?} */
export interface AttachmentMeta {
  name?: string;
  size?: number;
  mime?: string;
  /** Ovozli xabar davomiyligi (soniya) */
  duration?: number;
}

export interface ChatMessage {
  id: number;
  conversation_id: string;
  sender_id: string | null;
  type: MessageType;
  body: string | null;
  attachment_path: string | null;
  attachment_meta: AttachmentMeta | null;
  lat: number | null;
  lng: number | null;
  created_at: string;
  deleted_at: string | null;
  /** Yopiq `chat` bucket uchun serverda imzolangan vaqtinchalik URL (bo'lmasa client so'raydi) */
  signed_url: string | null;
  /** Faqat client: optimistik xabar identifikatori va holati */
  client_id?: string;
  status?: "sending" | "failed";
}

export interface ChatMember {
  profile_id: string;
  name: string;
  avatar_url: string | null;
  /** Bu a'zo suhbatdoshini bloklagan */
  is_blocked: boolean;
  is_muted: boolean;
  last_read_at: string | null;
}

export interface ConversationContext {
  /** listing — raqami ochilgan ishchi e'loni (0088) */
  kind: "application" | "offer" | "listing";
  id: string;
  title: string;
  company: string | null;
  /** Kontekst sahifasi: ishchi uchun /applications/[id] | /offers/[id]; ish beruvchi uchun /jobs/[slug] */
  href: string | null;
  /** suhbat tepasida qadalgan e'lon kartasi uchun (ega, 2026-11-23): hudud va e'lon rasmi (bo'lsa) */
  place?: string | null;
  image?: string | null;
  /** e'lon turi: ishchi e'loni yoki vakansiya (kartadagi yozuv) */
  listing?: "worker" | "vacancy";
}

/**
 * Birinchi xat (ega, 2026-11-23: "Chatda yozish bosilsa — e'lon qadalib, «Assalomu alaykum»dan boshlanadigan rasmiy tayyor matn
 * yozib berilsin"): kim kimga yozyapti. null — tayyor matn kerak emas (suhbatni boshlagan tomon emas).
 */
export type ChatIntro = "to_worker" | "to_employer" | "to_applicant";

export interface ConversationView {
  id: string;
  me: ChatMember;
  other: ChatMember;
  context: ConversationContext;
  /** Suhbatdosh sahifasi (ish beruvchi uchun /workers/[id], ishchi uchun /company/[slug]) */
  otherHref: string | null;
  /** birinchi xat turi (yozish maydoniga tayyor matn) va suhbatdoshning ismi (salomlashish uchun) */
  intro?: ChatIntro | null;
  otherFirstName?: string | null;
}

export type ConversationListItem = Database["public"]["Functions"]["my_conversations"]["Returns"][number];

export interface MessagesPage {
  messages: ChatMessage[];
  hasMore: boolean;
}

export type UploadKind = "image" | "document" | "voice";
