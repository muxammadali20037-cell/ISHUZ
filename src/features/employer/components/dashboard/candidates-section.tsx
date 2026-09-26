import { getT } from "@/lib/i18n/server";
import { SectionHeader } from "@/components/ui/misc";
import { WorkerCard } from "@/components/shared/worker-card";
import { searchCandidates, type CandidateSearch } from "../../queries";

/**
 * search_workers asosidagi nomzodlar bo'limi. Bo'sh bo'lsa hech narsa ko'rsatmaydi (null).
 * hrefVacancyId berilsa karta havolasi /workers/<id>?vacancy=<id> bo'ladi (moslik konteksti).
 */
export async function CandidatesSection({
  title,
  subtitle,
  viewAllHref,
  search,
  hrefVacancyId,
}: {
  title: string;
  subtitle?: string;
  viewAllHref: string;
  search: CandidateSearch;
  hrefVacancyId?: string | null;
}) {
  const { t } = await getT();
  const workers = await searchCandidates(search);
  if (!workers.length) return null;
  return (
    <section className="mt-8">
      <SectionHeader title={title} href={viewAllHref} linkLabel={t("common.actions.view_all")} className={subtitle ? "mb-1" : undefined} />
      {subtitle ? <p className="mb-3 text-sm text-muted-foreground">{subtitle}</p> : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {workers.map((w) => (
          <WorkerCard key={w.id} worker={w} href={hrefVacancyId ? `/workers/${w.id}?vacancy=${hrefVacancyId}` : undefined} hideMatch={!hrefVacancyId} />
        ))}
      </div>
    </section>
  );
}
