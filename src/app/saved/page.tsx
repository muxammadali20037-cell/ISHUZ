import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Bookmark, LogIn } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { getSession } from "@/features/auth/session";
import { getMode } from "@/features/mode/server";
import { listSavedJobs, listSavedWorkers } from "@/features/saved/queries";
import { getSavedVacancies } from "@/features/jobs/queries";
import { SavedList } from "@/features/jobs/components/saved-list";
import { JobResultCard, WorkerResultCard } from "@/features/find/components/result-cards";
import { listSavedSearches } from "@/features/saved-searches/queries";
import { SavedSearchesList } from "@/features/saved-searches/components/saved-searches-list";
import { Button } from "@/components/ui/button";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("easy.saved.page_title"), robots: { index: false } };
}

/**
 * /saved — "Saqlanganlar" (pastki menyuda): joriy rejimga qarab saqlangan ish e'lonlari yoki ishchilar (qidiruv kartalari
 * bilan bir xil — qo'ng'iroq tugmasi bilan), ostida saqlangan qidiruvlar. Profil to'ldirish shart emas.
 * Mehmonga — nima ekanini tushuntirish va kirish (majburiy yo'naltirish yo'q).
 */
export default async function SavedPage() {
  const [session, mode, { t }] = await Promise.all([getSession(), getMode(), getT()]);
  if (session?.profile.is_blocked) redirect("/blocked");

  if (!session) {
    return (
      <div className="container-narrow space-y-5 py-8 text-lg">
        <h1 className="text-3xl font-extrabold">{t("easy.saved.page_title")}</h1>
        <div className="space-y-4 rounded-2xl border border-border bg-card p-6">
          <span className="flex size-12 items-center justify-center rounded-xl bg-primary-soft text-primary" aria-hidden>
            <Bookmark className="size-7" />
          </span>
          <p className="text-muted-foreground">{t("easy.saved.guest_desc")}</p>
          <Button asChild size="xl" className="h-14 w-full text-lg">
            <Link href="/auth?next=%2Fsaved">
              <LogIn className="size-5" aria-hidden /> {t("easy.saved.login")}
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  // rejim tanlanmagan bo'lsa — mavjud profilga qarab (ikkalasi ham yo'q — ish izlovchi)
  const worker = (mode ?? (session.employerId && !session.workerId ? "employer" : "worker")) === "worker";
  const [jobs, workers, searches] = await Promise.all([worker ? listSavedJobs() : null, worker ? null : listSavedWorkers(), listSavedSearches()]);
  // 0061 bazada hali yo'q — eski joylar: ish beruvchi papkali paneli, ish izlovchi saved_vacancies ro'yxati
  if (workers?.legacy && session.employerId && session.employerOnboarded) redirect("/employer/saved");
  const legacyJobs = jobs?.legacy && session.workerId ? await getSavedVacancies(session.workerId) : null;
  const count = worker ? (jobs?.items.length ?? 0) : (workers?.items.length ?? 0);
  const empty = (
    <div className="space-y-3 rounded-2xl border-2 border-dashed border-border p-6 text-center">
      <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary-soft text-primary" aria-hidden>
        <Bookmark className="size-8" />
      </span>
      <p className="text-xl font-bold">{worker ? t("easy.saved.empty_jobs_title") : t("easy.saved.empty_workers_title")}</p>
      <p className="text-base text-muted-foreground">{t("easy.saved.empty_desc")}</p>
      <Button asChild size="xl" className="h-14 text-lg">
        <Link href={worker ? "/search?mode=jobs" : "/search?mode=workers"}>
          {worker ? t("easy.saved.browse_jobs") : t("easy.saved.browse_workers")} <ArrowRight className="size-5" aria-hidden />
        </Link>
      </Button>
    </div>
  );

  return (
    <div className="container-app space-y-6 py-5 sm:py-8">
      <div>
        <h1 className="text-3xl font-extrabold">{t("easy.saved.page_title")}</h1>
        {count ? <p className="mt-1 text-lg text-muted-foreground">{worker ? t("easy.saved.jobs_count", { count }) : t("easy.saved.workers_count", { count })}</p> : null}
      </div>

      {legacyJobs?.length ? (
        <SavedList items={legacyJobs} onEmpty={empty} />
      ) : count ? (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {jobs?.items.map((job) => (
            <li key={job.id}>
              <JobResultCard job={job} imageUrl={job.profession_node_id ? jobs.images[job.profession_node_id] : null} saved savedRefresh />
            </li>
          ))}
          {workers?.items.map((w) => (
            <li key={w.id}>
              <WorkerResultCard worker={w} imageUrl={w.profession_node_id ? workers.images[w.profession_node_id] : null} saved savedRefresh />
            </li>
          ))}
        </ul>
      ) : (
        empty
      )}

      {searches.length ? (
        <section aria-label={t("saved.searches.title")}>
          <h2 className="text-xl font-bold">{t("saved.searches.title")}</h2>
          <p className="mb-2 text-base text-muted-foreground">{t("saved.searches.hint")}</p>
          <SavedSearchesList items={searches} />
        </section>
      ) : null}
    </div>
  );
}
