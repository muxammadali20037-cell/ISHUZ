import type { Metadata } from "next";
import { requireSession } from "@/features/auth/session";
import { getT } from "@/lib/i18n/server";
import { Shell } from "@/components/shared/shell";
import { PageHeader } from "@/components/ui/misc";
import { getMyConversations } from "@/features/chat/queries";
import { ConversationList } from "@/features/chat/components/conversation-list";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("chat.title"), description: t("chat.description") };
}

/** /messages — suhbatlar ro'yxati (?error=<code> → toast) */
export default async function MessagesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireSession("/messages");
  const sp = await searchParams;
  const error = typeof sp.error === "string" ? sp.error : undefined;
  const [items, { t }] = await Promise.all([getMyConversations(), getT()]);
  return (
    <Shell>
      <div className="container-narrow py-4 md:py-6">
        <PageHeader title={t("chat.title")} subtitle={t("chat.description")} />
        <ConversationList items={items} errorCode={error} />
      </div>
    </Shell>
  );
}
