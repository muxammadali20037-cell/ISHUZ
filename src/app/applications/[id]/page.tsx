import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireWorker } from "@/features/auth/session";
import { getT } from "@/lib/i18n/server";
import { Shell } from "@/components/shared/shell";
import { getWorkerApplication } from "@/features/applications/queries";
import { WorkerApplicationDetail } from "@/features/applications/components/worker-application-detail";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("applications.meta.detail_title") };
}

/** /applications/[id] — faqat o'z arizasi (aks holda 404) */
export default async function ApplicationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireWorker(`/applications/${id}`);
  const app = await getWorkerApplication(id, session.workerId, session.userId);
  if (!app) notFound();
  return (
    <Shell forceRole="worker">
      <WorkerApplicationDetail app={app} userId={session.userId} />
    </Shell>
  );
}
