import type { Metadata } from "next";
import { requireWorker } from "@/features/auth/session";
import { getT } from "@/lib/i18n/server";
import { Shell } from "@/components/shared/shell";
import { ApplicationsList } from "@/features/applications/components/applications-list";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("applications.meta.title") };
}

/** /applications?tab=active|archive — ishchining arizalari */
export default async function ApplicationsPage({ searchParams }: { searchParams: Promise<{ tab?: string | string[] }> }) {
  const session = await requireWorker("/applications");
  const sp = await searchParams;
  const raw = Array.isArray(sp.tab) ? sp.tab[0] : sp.tab;
  const tab = raw === "archive" ? "archive" : "active";
  return (
    <Shell forceRole="worker">
      <ApplicationsList workerId={session.workerId} tab={tab} />
    </Shell>
  );
}
