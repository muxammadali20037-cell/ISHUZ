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
  kind: "application" | "offer";
  id: string;
  title: string;
  company: string | null;
  /** Kontekst sahifasi: ishchi uchun /applications/[id] | /offers/[id]; ish beruvchi uchun /jobs/[slug] */
  href: string | null;
}

export interface ConversationView {
  id: string;
  me: ChatMember;
  other: ChatMember;
  context: ConversationContext;
  /** Suhbatdosh sahifasi (ish beruvchi uchun /workers/[id], ishchi uchun /company/[slug]) */
  otherHref: string | null;
}

export type ConversationListItem = Database["public"]["Functions"]["my_conversations"]["Returns"][number];

export interface MessagesPage {
  messages: ChatMessage[];
  hasMore: boolean;
}

export type UploadKind = "image" | "document" | "voice";
