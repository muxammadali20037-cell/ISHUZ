import type { Metadata } from "next";
import { Bookmark } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { requireWorker } from "@/features/auth/session";
import { getSavedVacancies } from "@/features/jobs/queries";
import { SavedList } from "@/features/jobs/components/saved-list";
import { EmptyState, PageHeader } from "@/components/ui/misc";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("saved.title"), robots: { index: false } };
}

/** /saved — ish qidiruvchining saqlangan vakansiyalari (requireWorker) */
export default async function SavedPage() {
  const session = await requireWorker("/saved");
  const [{ t }, items] = await Promise.all([getT(), getSavedVacancies(session.workerId)]);
  const empty = <EmptyState icon={Bookmark} title={t("saved.empty_title")} description={t("saved.empty_desc")} action={{ label: t("saved.empty_action"), href: "/jobs" }} />;
  return (
    <div className="container-app py-5 sm:py-8">
      <PageHeader title={t("saved.title")} subtitle={items.length ? t("saved.subtitle", { count: items.length }) : undefined} backHref="/profile" />
      <SavedList items={items} onEmpty={empty} />
    </div>
  );
}
