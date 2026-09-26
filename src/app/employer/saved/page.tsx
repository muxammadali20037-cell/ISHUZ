import type { Metadata } from "next";
import { requireEmployer } from "@/features/auth/session";
import { getT } from "@/lib/i18n/server";
import { Shell } from "@/components/shared/shell";
import { PageHeader } from "@/components/ui/misc";
import { getSavedWorkers } from "@/features/workers/queries";
import { SavedWorkersList } from "@/features/workers/components/saved-workers-list";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("workers.meta.saved_title"), robots: { index: false } };
}

/** /employer/saved — saqlangan nomzodlar (papkalar, eslatmalar) */
export default async function SavedWorkersPage() {
  const session = await requireEmployer("/employer/saved");
  const [{ t }, items] = await Promise.all([getT(), getSavedWorkers(session.userId)]);
  return (
    <Shell>
      <div className="container-app py-4 md:py-6">
        <PageHeader title={t("workers.saved.title")} subtitle={items.length ? t("workers.saved.count", { count: items.length }) : undefined} backHref="/employer" />
        <SavedWorkersList items={items} />
      </div>
    </Shell>
  );
}
