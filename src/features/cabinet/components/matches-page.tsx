import Link from "next/link";
import { Info, ShieldAlert } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { formatSalaryRange } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { MatchReasons } from "@/components/shared/match-score";
import type { SessionContext } from "@/features/auth/session";
import { cn } from "@/lib/utils";
import { getCandidateMatches, getJobMatches, getMatchThreshold, getMyActiveVacancies } from "../matches-queries";

function ScorePill({ score, threshold, hardFail }: { score: number; threshold: number; hardFail: boolean }) {
  const strong = !hardFail && score >= threshold;
  return (
    <span className={cn("inline-flex shrink-0 items-center rounded-xl px-3 py-1 text-lg font-extrabold tabular-nums", strong ? "bg-success-soft text-success" : score >= 60 && !hardFail ? "bg-warning-soft text-warning" : "bg-secondary text-muted-foreground")}>
      {score}%
    </span>
  );
}

/**
 * Mos e'lonlar / nomzodlar. Foiz — profil va e'lon shartlarining hisoblangan mosligi (ishga qabul qilinish ehtimoli emas):
 * har bir mezon sababi, yetishmayotgan ma'lumot va qat'iy nomuvofiqlik ochiq ko'rsatiladi.
 */
export async function MatchesPage({ session, vacancyId }: { session: SessionContext; vacancyId: string | null }) {
  const { t, name, locale } = await getT();
  const [jobs, vacancies, threshold] = await Promise.all([getJobMatches(session), getMyActiveVacancies(session), getMatchThreshold()]);
  const selected = vacancies.find((v) => v.id === vacancyId) ?? vacancies[0] ?? null;
  const candidates = selected ? await getCandidateMatches(selected.id) : [];
  const place = (r: { name_uz: string; name_ru: string; name_en: string | null } | null, d: { name_uz: string; name_ru: string; name_en: string | null } | null) =>
    [r ? name(r) : null, d ? name(d) : null].filter(Boolean).join(", ");

  return (
    <div className="container-narrow space-y-8 py-6 text-lg sm:py-8">
      <div>
        <h1 className="text-3xl font-extrabold">{t("easy.matches.title")}</h1>
        <p className="mt-2 flex items-start gap-2 rounded-2xl bg-secondary p-3 text-base text-muted-foreground">
          <Info className="mt-0.5 size-5 shrink-0" aria-hidden /> {t("easy.matches.explain", { threshold })}
        </p>
      </div>

      {session.workerId ? (
        <section className="space-y-3" aria-labelledby="job-matches">
          <h2 id="job-matches" className="text-2xl font-bold">{t("easy.matches.jobs_title")}</h2>
          {!jobs.length ? <p className="rounded-2xl bg-secondary p-4 text-muted-foreground">{t("easy.matches.jobs_empty")}</p> : null}
          {jobs.map((m) => (
            <article key={m.vacancyId} className="space-y-3 rounded-3xl border border-border bg-card p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-xl font-bold [overflow-wrap:anywhere]">{m.title}</h3>
                  {m.employer ? <p className="text-muted-foreground">{m.employer}</p> : null}
                  <p className="text-base text-muted-foreground">{place(m.region, m.district)}</p>
                  <p className="text-base font-semibold">
                    {m.negotiable ? t("easy.card.negotiable") : formatSalaryRange(m.salaryFrom, m.salaryTo, locale, { negotiable: t("easy.card.negotiable"), from: "", to: "" })}
                  </p>
                </div>
                <ScorePill score={m.score} threshold={threshold} hardFail={m.hardFail} />
              </div>
              {m.hardFail ? (
                <p className="flex items-start gap-2 text-base text-destructive">
                  <ShieldAlert className="mt-0.5 size-5 shrink-0" aria-hidden /> {t("easy.matches.hard_fail")}
                </p>
              ) : !m.complete ? (
                <p className="text-base text-muted-foreground">{t("easy.matches.incomplete_worker")}</p>
              ) : null}
              <MatchReasons reasons={m.reasons} />
              <Button asChild size="xl" className="h-12 w-full text-base sm:w-auto">
                <Link href={`/jobs/${m.slug}`}>{t("easy.matches.view_job")}</Link>
              </Button>
            </article>
          ))}
        </section>
      ) : null}

      {vacancies.length ? (
        <section className="space-y-3" aria-labelledby="candidate-matches">
          <h2 id="candidate-matches" className="text-2xl font-bold">{t("easy.matches.candidates_title")}</h2>
          {vacancies.length > 1 ? (
            <div className="flex flex-wrap gap-2">
              {vacancies.map((v) => (
                <Link key={v.id} href={`/cabinet/matches?vacancy=${v.id}`} className={cn("inline-flex min-h-12 items-center rounded-2xl border-2 px-4 text-base font-semibold", v.id === selected?.id ? "border-primary bg-primary-soft" : "border-border bg-card")}>
                  {v.title}
                </Link>
              ))}
            </div>
          ) : null}
          {!candidates.length ? <p className="rounded-2xl bg-secondary p-4 text-muted-foreground">{t("easy.matches.candidates_empty")}</p> : null}
          {candidates.map((m) => (
            <article key={m.workerId} className="space-y-3 rounded-3xl border border-border bg-card p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-xl font-bold">{m.name || "—"}</h3>
                  <p className="text-muted-foreground">{m.profession ? name(m.profession) : m.headline}</p>
                  <p className="text-base text-muted-foreground">{place(m.region, m.district)}</p>
                </div>
                <ScorePill score={m.score} threshold={threshold} hardFail={m.hardFail} />
              </div>
              {m.hardFail ? (
                <p className="flex items-start gap-2 text-base text-destructive">
                  <ShieldAlert className="mt-0.5 size-5 shrink-0" aria-hidden /> {t("easy.matches.hard_fail")}
                </p>
              ) : !m.complete ? (
                <p className="text-base text-muted-foreground">{t("easy.matches.incomplete_candidate")}</p>
              ) : null}
              <MatchReasons reasons={m.reasons} />
              <Button asChild size="xl" className="h-12 w-full text-base sm:w-auto">
                <Link href={`/listing/${m.workerId}`}>{t("easy.matches.view_candidate")}</Link>
              </Button>
            </article>
          ))}
        </section>
      ) : null}

      {!session.workerId && !vacancies.length ? (
        <div className="space-y-3 rounded-3xl border border-border bg-card p-5">
          <p>{t("easy.matches.none")}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Button asChild size="xl" className="h-14 text-lg"><Link href="/post/worker">{t("easy.home.worker_cta")}</Link></Button>
            <Button asChild size="xl" variant="outline" className="h-14 text-lg"><Link href="/post/vacancy">{t("easy.home.employer_cta")}</Link></Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
