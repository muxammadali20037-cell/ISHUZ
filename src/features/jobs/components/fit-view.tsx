import Link from "next/link";
import { ArrowLeft, ChevronRight, Info, ShieldAlert, Sparkles } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { Button } from "@/components/ui/button";
import { MatchReasons } from "@/components/shared/match-score";
import { matchLevel } from "@/features/matching/level";
import type { FitAnalysis } from "../fit";

/** Yetishmayotgan ma'lumotni qayerda to'ldirish mumkin */
const FIX_HREF: Record<string, string> = {
  profession: "/post/worker",
  location: "/post/worker",
  experience: "/profile",
  skills: "/profile",
  languages: "/profile",
};

function ScoreRing({ score }: { score: number }) {
  const r = 44;
  const circ = 2 * Math.PI * r;
  const tone = score >= 75 ? "stroke-success" : score >= 50 ? "stroke-warning" : "stroke-muted-foreground";
  return (
    <svg width="112" height="112" viewBox="0 0 112 112" aria-hidden className="shrink-0">
      <circle cx="56" cy="56" r={r} fill="none" className="stroke-secondary" strokeWidth="10" />
      <circle cx="56" cy="56" r={r} fill="none" className={tone} strokeWidth="10" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ * (1 - score / 100)} transform="rotate(-90 56 56)" />
      <text x="56" y="56" textAnchor="middle" dominantBaseline="central" className="fill-foreground text-2xl font-extrabold">
        {score}%
      </text>
    </svg>
  );
}

function Header({ slug, title, heading }: { slug: string; title: string; heading: string }) {
  return (
    <div className="space-y-2">
      <Link href={`/jobs/${slug}`} className="-ml-2 inline-flex min-h-11 items-center gap-1 rounded-xl px-2 text-base font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-5" aria-hidden /> {title}
      </Link>
      <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
        <Sparkles className="size-6 text-primary" aria-hidden /> {heading}
      </h1>
    </div>
  );
}

/** Moslik tahlili: foiz faqat to'liq hisoblanganda; aks holda — nima yetishmasligi yoki qaysi majburiy talab mos emasligi */
export async function FitView({ slug, title, fit, applied }: { slug: string; title: string; fit: FitAnalysis | null; applied: boolean }) {
  const { t } = await getT();
  if (!fit) {
    return (
      <div className="container-narrow space-y-5 py-5">
        <Header slug={slug} title={title} heading={t("jobs.fit.title")} />
        <p className="rounded-2xl border border-border bg-card p-5 text-muted-foreground">{t("common.errors.generic")}</p>
      </div>
    );
  }
  const good = fit.reasons.filter((r) => r.ok === true);
  const attention = fit.reasons.filter((r) => r.ok !== true);
  const showScore = fit.complete && !fit.hardFail;
  return (
    <div className="container-narrow space-y-5 py-5">
      <Header slug={slug} title={title} heading={t("jobs.fit.title")} />

      {fit.hardFail ? (
        <section className="flex gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
          <ShieldAlert className="mt-0.5 size-6 shrink-0 text-destructive" aria-hidden />
          <div>
            <h2 className="text-lg font-bold">{t("jobs.fit.hard_title")}</h2>
            <p className="mt-1 text-muted-foreground">{t("jobs.fit.hard_desc")}</p>
          </div>
        </section>
      ) : showScore ? (
        <section aria-labelledby="fit-score" className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
          <ScoreRing score={fit.score} />
          <div className="min-w-0">
            <h2 id="fit-score" className="text-sm font-semibold text-muted-foreground">
              {t("jobs.fit.score_label")}
            </h2>
            <p className="text-xl font-extrabold">{t(`common.labels.match_level.${matchLevel(fit.score)}`)}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t("jobs.fit.score_note")}</p>
          </div>
        </section>
      ) : (
        <section className="flex gap-3 rounded-2xl border border-warning/40 bg-warning-soft p-4">
          <Info className="mt-0.5 size-6 shrink-0 text-warning" aria-hidden />
          <div>
            <h2 className="text-lg font-bold">{t("jobs.fit.incomplete_title")}</h2>
            <p className="mt-1 text-muted-foreground">{t("jobs.fit.incomplete_desc")}</p>
          </div>
        </section>
      )}

      {good.length ? (
        <section aria-labelledby="fit-why" className="rounded-2xl border border-border bg-card p-4">
          <h2 id="fit-why" className="mb-2 text-lg font-bold">
            {t("jobs.fit.why")}
          </h2>
          <MatchReasons reasons={good} />
        </section>
      ) : null}

      {attention.length ? (
        <section aria-labelledby="fit-attention" className="rounded-2xl border border-border bg-card p-4">
          <h2 id="fit-attention" className="mb-2 text-lg font-bold">
            {t("jobs.fit.attention")}
          </h2>
          <MatchReasons reasons={attention} />
        </section>
      ) : null}

      {fit.missing.length ? (
        <section aria-labelledby="fit-missing" className="rounded-2xl border border-border bg-card p-4">
          <h2 id="fit-missing" className="mb-2 text-lg font-bold">
            {t("jobs.fit.missing")}
          </h2>
          <ul className="divide-y divide-border">
            {fit.missing.map((m) => (
              <li key={m}>
                <Link href={FIX_HREF[m] ?? "/profile"} className="flex min-h-12 items-center justify-between gap-3 py-2 font-semibold hover:text-primary">
                  {t(`jobs.fit.missing_${m}`)}
                  <span className="inline-flex shrink-0 items-center gap-1 text-sm text-primary">
                    {t("jobs.fit.add")} <ChevronRight className="size-4" aria-hidden />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-2">
        {!applied ? (
          <Button asChild className="h-12 text-base font-bold">
            <Link href={`/jobs/${slug}?apply=1`}>{t("jobs.fit.apply")}</Link>
          </Button>
        ) : null}
        <Button asChild variant="outline" className="h-12 text-base">
          <Link href={`/jobs/${slug}`}>{t("jobs.fit.back")}</Link>
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">{t("jobs.fit.advisory")}</p>
    </div>
  );
}

/** Ish izlovchi profili hali yo'q — moslikni hisoblab bo'lmaydi (soxta foiz o'rniga tushuntirish) */
export async function FitNoProfile({ slug, title }: { slug: string; title: string }) {
  const { t } = await getT();
  return (
    <div className="container-narrow space-y-5 py-5">
      <Header slug={slug} title={title} heading={t("jobs.fit.title")} />
      <section className="space-y-3 rounded-2xl border border-border bg-card p-5">
        <h2 className="text-lg font-bold">{t("jobs.fit.no_profile_title")}</h2>
        <p className="text-muted-foreground">{t("jobs.fit.no_profile_desc")}</p>
        <Button asChild className="h-12 text-base font-bold">
          <Link href="/post/worker">{t("jobs.fit.no_profile_cta")}</Link>
        </Button>
      </section>
    </div>
  );
}
