import type { Metadata } from "next";
import { Bookmark } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { redirect } from "next/navigation";
import { requireSession } from "@/features/auth/session";
import { getSavedVacancies } from "@/features/jobs/queries";
import { SavedList } from "@/features/jobs/components/saved-list";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { listSavedSearches } from "@/features/saved-searches/queries";
import { SavedSearchesList } from "@/features/saved-searches/components/saved-searches-list";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("saved.title"), robots: { index: false } };
}

/** /saved — saqlangan qidiruvlar (har qanday foydalanuvchi) + saqlangan vakansiyalar (ish qidiruvchi) */
export default async function SavedPage() {
  const session = await requireSession("/saved");
  const isWorker = !!session.workerId && session.workerOnboarded;
  const [{ t }, items, searches] = await Promise.all([getT(), isWorker && session.workerId ? getSavedVacancies(session.workerId) : Promise.resolve([]), listSavedSearches()]);
  // Oldingidek: ishchi profili yo'q va saqlangan qidiruv ham yo'q bo'lsa — profil to'ldirishga
  if (!isWorker && !searches.length) redirect("/onboarding/worker");
  const empty = (
    <EmptyState icon={Bookmark} title={t("saved.empty_title")} description={t("saved.empty_desc")} action={{ label: t("saved.empty_action"), href: "/jobs" }} />
  );
  return (
    <div className="container-app py-5 sm:py-8">
      <PageHeader title={t("saved.title")} subtitle={items.length ? t("saved.subtitle", { count: items.length }) : undefined} backHref="/profile" />
      {searches.length ? (
        <section className="mb-6" aria-label={t("saved.searches.title")}>
          <h2 className="text-base font-semibold">{t("saved.searches.title")}</h2>
          <p className="mb-2 text-sm text-muted-foreground">{t("saved.searches.hint")}</p>
          <SavedSearchesList items={searches} />
        </section>
      ) : null}
      <SavedList items={items} onEmpty={empty} />
    </div>
  );
}
