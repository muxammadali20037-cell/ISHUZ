import { FileText, Archive } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { PageHeader, EmptyState } from "@/components/ui/misc";
import { getPendingOffersCount, getWorkerApplications } from "../queries";
import { isActiveStatus } from "../types";
import { ApplicationCard } from "./application-card";
import { ApplicationsTabs, type ApplicationsTab } from "./applications-tabs";

/** /applications — ishchining arizalari: Faol / Arxiv / Takliflar */
export async function ApplicationsList({ workerId, tab }: { workerId: string; tab: ApplicationsTab }) {
  const { t } = await getT();
  const [all, pendingOffers] = await Promise.all([getWorkerApplications(workerId), getPendingOffersCount(workerId)]);
  const active = all.filter((a) => isActiveStatus(a.status));
  const archive = all.filter((a) => !isActiveStatus(a.status));
  const items = tab === "active" ? active : archive;

  return (
    <div className="container-narrow py-5 sm:py-8">
      <PageHeader title={t("applications.meta.title")} />
      <ApplicationsTabs active={tab} counts={{ active: active.length, archive: archive.length }} pendingOffers={pendingOffers} />
      <div className="mt-4 space-y-3">
        {items.length ? (
          items.map((item) => <ApplicationCard key={item.id} item={item} />)
        ) : tab === "active" ? (
          <EmptyState icon={FileText} title={t("applications.list.empty_title")} description={t("applications.list.empty_desc")} action={{ label: t("applications.list.empty_cta"), href: "/jobs" }} />
        ) : (
          <EmptyState icon={Archive} title={t("applications.list.archive_empty_title")} description={t("applications.list.archive_empty_desc")} />
        )}
      </div>
    </div>
  );
}
