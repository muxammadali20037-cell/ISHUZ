import type { Metadata } from "next";
import { requireSession } from "@/features/auth/session";
import { getT } from "@/lib/i18n/server";
import { Shell } from "@/components/shared/shell";
import { PageHeader } from "@/components/ui/misc";
import { getNotificationsPage } from "@/features/notifications/queries";
import { NotificationList } from "@/features/notifications/components/notification-list";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("notifications.title"), description: t("notifications.description") };
}

/** /notifications?page=N — bildirishnomalar (30 tadan, kunlarga guruhlangan) */
export default async function NotificationsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await requireSession("/notifications");
  const sp = await searchParams;
  const pageParam = typeof sp.page === "string" ? Number.parseInt(sp.page, 10) : 1;
  const [data, { t }] = await Promise.all([getNotificationsPage(Number.isFinite(pageParam) ? pageParam : 1), getT()]);
  return (
    <Shell>
      <div className="container-narrow py-4 md:py-6">
        <PageHeader title={t("notifications.title")} subtitle={t("notifications.description")} />
        <NotificationList items={data.items} page={data.page} hasMore={data.hasMore} unread={data.unread} myId={session.userId} />
      </div>
    </Shell>
  );
}
