import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireSession } from "@/features/auth/session";
import { getT } from "@/lib/i18n/server";
import { Shell } from "@/components/shared/shell";
import { conversationIdSchema } from "@/features/chat/schema";
import { getConversationView, getMessagesPage } from "@/features/chat/queries";
import { ChatRoom } from "@/features/chat/components/chat-room";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("chat.title") };
}

/** /messages/[id] — suhbat xonasi (RLS: meniki bo'lmasa 404) */
export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!conversationIdSchema.safeParse(id).success) notFound();
  const session = await requireSession(`/messages/${id}`);
  const view = await getConversationView(id, session);
  if (!view) notFound();
  const initial = await getMessagesPage(id);
  return (
    <Shell hideNav>
      <ChatRoom view={view} initial={initial} myId={session.userId} />
    </Shell>
  );
}
