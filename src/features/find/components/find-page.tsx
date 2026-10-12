import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, ArrowRight, BriefcaseBusiness, ChevronRight, Search, UsersRound } from "lucide-react";
import { after } from "next/server";
import { getT } from "@/lib/i18n/server";
import { formatMoneyShort } from "@/lib/format";
import { getSession } from "@/features/auth/session";
import { trackServer } from "@/features/analytics/server";
import type { District, Region } from "@/lib/reference";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { activeFilterCount, findHref, type FindParams } from "../params";
import { PAGE_SIZE, findJobs, findWorkers, logFindSearch, type NodeInfo } from "../queries";
import { ChangeSheet, FilterSheet, RetryButton } from "./find-client";
import { JobResultCard, WorkerResultCard } from "./result-cards";
import { isCityRegion } from "@/lib/geo/city";

const bigLink = "press flex min-h-14 w-full items-center gap-3 rounded-2xl border-2 border-border bg-card px-4 py-3 text-left text-lg font-semibold hover:border-primary/50";

function StepShell({ back, title, children, summary }: { back: string | null; title: string; children: ReactNode; summary?: ReactNode }) {
  return (
    <div className="container-narrow space-y-5 py-4 text-lg sm:py-8">
      <div className="space-y-3">
        {back ? (
          <Button asChild variant="outline" className="h-12 px-4 text-base">
            <Link href={back}>
              <ArrowLeft className="size-5" aria-hidden /> <BackLabel />
            </Link>
          </Button>
        ) : null}
        <h1 className="text-2xl font-extrabold leading-tight [overflow-wrap:anywhere] sm:text-3xl">{title}</h1>
      </div>
      {summary}
      {children}
    </div>
  );
}

async function BackLabel() {
  const { t } = await getT();
  return <>{t("easy.wizard.back")}</>;
}

/** 0-qadam: "Ish qidiraman" / "Ishchi qidiraman" + yozib qidirish */
export async function FindStart({ params }: { params: FindParams }) {
  const { t } = await getT();
  const examples = [t("easy.search.example_1"), t("easy.search.example_2"), t("easy.search.example_3")];
  return (
    <StepShell back="/" title={t("easy.search.choose_title")}>
      <div className="pop-list grid grid-cols-1 gap-4 sm:grid-cols-2">
        {(
          [
            { mode: "jobs", icon: BriefcaseBusiness, title: t("easy.search.jobs"), desc: t("easy.search.jobs_desc") },
            { mode: "workers", icon: UsersRound, title: t("easy.search.workers"), desc: t("easy.search.workers_desc") },
          ] as const
        ).map((c) => (
          <Link
            key={c.mode}
            href={findHref(params, { mode: c.mode, page: 1 })}
            className="press group flex min-h-24 items-center gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm hover:border-primary/50 active:scale-[0.98]"
          >
            <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary" aria-hidden>
              <c.icon className="size-7" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xl font-bold leading-tight">{c.title}</span>
              <span className="mt-1 block text-base text-muted-foreground">{c.desc}</span>
            </span>
            <ChevronRight className="size-6 shrink-0 text-primary" aria-hidden />
          </Link>
        ))}
      </div>

      <form action="/search" method="get" className="space-y-3 rounded-2xl border border-border bg-card p-4 sm:p-5">
        <p className="text-base font-semibold text-muted-foreground">{t("easy.search.or_type")}</p>
        <label htmlFor="find-q" className="block text-xl font-bold">
          {t("easy.search.query_label")}
        </label>
        <Input id="find-q" name="q" type="search" defaultValue={params.q} placeholder={t("easy.search.query_placeholder")} leftIcon={<Search />} className="h-14 rounded-2xl text-lg" maxLength={120} required minLength={2} />
        <Button type="submit" size="xl" className="h-14 w-full text-lg">
          {t("easy.search.find")} <ArrowRight className="size-5" aria-hidden />
        </Button>
        <div>
          <p className="text-base text-muted-foreground">{t("easy.search.examples")}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {examples.map((ex) => (
              // prefetch yo'q: bu manzil serverda boshqa URL'ga yo'naltiriladi — oldindan yuklash foydasiz, Next router esa
              // bunday javobni ochiq ushlab turadi (HTTP/1.1 da xostga 6 ta ulanish — to'lsa, sahifa qotadi; e2e: a11y "qorong'i mavzu")
              <Link key={ex} href={`/search?q=${encodeURIComponent(ex)}`} prefetch={false} className="inline-flex min-h-12 items-center rounded-full border border-primary/40 bg-primary-soft/50 px-4 text-base font-semibold text-primary hover:bg-primary-soft">
                «{ex}»
              </Link>
            ))}
          </div>
        </div>
      </form>
    </StepShell>
  );
}

/** Maqsad aniqlanmadi: bitta sodda savol */
export async function FindAskIntent({ params, node }: { params: FindParams; node: NodeInfo | null }) {
  const { t, name } = await getT();
  const said = params.q || (node ? name(node.trail.at(-1)!) : "");
  return (
    <StepShell back="/search" title={t("easy.search.ask_intent")}>
      {said ? <p className="rounded-2xl bg-secondary px-4 py-3 text-lg">{t("easy.search.ask_intent_hint", { q: said })}</p> : null}
      <div className="pop-list grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link href={findHref(params, { mode: "jobs" })} className={cn(bigLink, "min-h-20 border-primary/40")}>
          <BriefcaseBusiness className="size-7 shrink-0 text-primary" aria-hidden />
          <span>
            <span className="block text-xl font-bold">{t("easy.search.jobs")}</span>
            <span className="block text-base font-normal text-muted-foreground">{t("easy.search.jobs_desc")}</span>
          </span>
        </Link>
        <Link href={findHref(params, { mode: "workers" })} className={cn(bigLink, "min-h-20 border-success/40")}>
          <UsersRound className="size-7 shrink-0 text-success" aria-hidden />
          <span>
            <span className="block text-xl font-bold">{t("easy.search.workers")}</span>
            <span className="block text-base font-normal text-muted-foreground">{t("easy.search.workers_desc")}</span>
          </span>
        </Link>
      </div>
    </StepShell>
  );
}

/** Natijalar: qisqa xulosa + O'zgartirish + Filtr, kartalar, sahifalar, bo'sh holat */
export async function FindResultsView({ params, node, region, district }: { params: FindParams; node: NodeInfo | null; region: Region | null; district: District | null }) {
  const { t, name, tEnum, locale } = await getT();
  const remote = params.region === "remote";
  const place = { regionId: region?.id ?? null, districtId: district?.id ?? null, remote };
  const isJobs = params.mode === "jobs";
  const res = isJobs ? await findJobs(params, place) : await findWorkers(params, place);
  const total = res.ok ? res.total : 0;
  const pages = Math.max(1, Math.ceil(Math.min(total, 5000) / PAGE_SIZE));
  const prof = node ? name(node.trail.at(-1)!) : params.pay === "daily" ? t("easy.search.daily_jobs") : "";
  const placeText = remote ? t("easy.location.remote") : region ? `${name(region)} · ${district ? name(district) : t(isCityRegion(region) ? "easy.location.whole_city" : "easy.location.whole_region")}` : t("easy.location.whole_country");
  const backHref = region ? findHref(params, { district: null, page: 1 }) : findHref(params, { region: null, district: null, page: 1 });
  // qisqa xulosa: "Buxgalter · Toshkent · 5 mln so'mdan yuqori"
  const filterParts = [
    isJobs && params.salary ? t("easy.search.salary_over", { amount: formatMoneyShort(params.salary, locale) }) : null,
    isJobs && params.schedule ? tEnum("work_schedule", params.schedule) : null,
    isJobs && params.noexp ? t("easy.search.no_experience") : null,
    isJobs && params.pay === "daily" && node ? t("easy.search.daily_only") : null,
    !isJobs && params.exp ? t("easy.search.experienced") : null,
  ].filter((x): x is string => !!x);
  // qidiruv statistikasi (kasb/hudud ID bilan; birinchi sahifa) — talab, bo'sh natijali qidiruvlar uchun.
  // Texnik xato bo'sh natija sifatida yozilmaydi: alohida "search_error" hodisasi (shaxsiy ma'lumotsiz).
  if (!res.ok) {
    const profileId = (await getSession())?.userId ?? null;
    after(() => trackServer("search_error", profileId, { scope: isJobs ? "jobs" : "workers", page: params.page }));
  } else if (params.page === 1) {
    // after() ichida cookies o'qilmaydi — sessiya oldindan olinadi
    const profileId = (await getSession())?.userId ?? null;
    after(() =>
      logFindSearch({
        scope: isJobs ? "jobs" : "workers",
        query: params.q || prof,
        understood: { node: node?.id ?? null, region: region?.id ?? null, district: district?.id ?? null, remote, salary: params.salary, schedule: params.schedule },
        results: total,
        profileId,
      }),
    );
  }

  // "Butun O'zbekiston" bo'yicha ham bo'sh — "bu hududda" deyilmaydi va hududni o'zgartirish taklif qilinmaydi
  const wholeCountry = !region && !remote;

  return (
    <div className="container-app space-y-5 py-4 text-lg sm:py-8">
      <div className="space-y-3">
        <Button asChild variant="outline" className="h-12 px-4 text-base">
          <Link href={backHref}>
            <ArrowLeft className="size-5" aria-hidden /> {t("easy.wizard.back")}
          </Link>
        </Button>
        <h1 className="text-xl font-extrabold leading-snug [overflow-wrap:anywhere] sm:text-2xl">
          {isJobs ? t("easy.search.summary_jobs") : t("easy.search.summary_workers")}: {[prof, placeText, ...filterParts].join(" · ")}
        </h1>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <ChangeSheet
          modeHref={findHref(params, { mode: null, page: 1 })}
          professionHref={findHref(params, { p: null, page: 1 })}
          regionHref={findHref(params, { region: null, district: null, page: 1 })}
        />
        <FilterSheet mode={params.mode!} salary={params.salary} schedule={params.schedule} noexp={params.noexp} exp={params.exp} daily={params.pay === "daily"} count={activeFilterCount(params)} />
        {total ? (
          <p className="text-base font-semibold text-muted-foreground" aria-live="polite">
            {t("easy.search.found", { count: total >= 5000 ? "5 000+" : total })}
          </p>
        ) : null}
      </div>

      {!res.ok ? (
        <section role="alert" className="space-y-4 rounded-2xl border-2 border-warning/40 bg-warning-soft p-6 text-center">
          <h2 className="text-2xl font-bold">{t("easy.search.error_title")}</h2>
          <p className="text-muted-foreground">{t("easy.search.error_desc")}</p>
          <div className="mx-auto grid max-w-md gap-3">
            <RetryButton label={t("easy.search.retry")} />
          </div>
          <p className="text-sm text-muted-foreground">{t("easy.search.error_code", { code: res.errorId })}</p>
        </section>
      ) : !res.items.length && params.page > 1 ? (
        <section className="space-y-4 rounded-2xl border-2 border-dashed border-border bg-card p-6 text-center">
          <h2 className="text-2xl font-bold">{t("easy.search.page_empty_title")}</h2>
          <div className="mx-auto grid max-w-md gap-3">
            <Button asChild size="xl" className="h-14 text-lg">
              <Link href={findHref(params, { page: 1 })}>{t("easy.search.page_empty_first")}</Link>
            </Button>
          </div>
        </section>
      ) : null}
      {!res.ok || (!res.items.length && params.page > 1) ? null : res.items.length ? (
        <ul className="pop-list grid grid-cols-1 gap-4 lg:grid-cols-2">
          {isJobs
            ? (res.items as Parameters<typeof JobResultCard>[0]["job"][]).map((job) => (
                <li key={job.id}>
                  <JobResultCard job={job} imageUrl={job.profession_node_id ? res.images[job.profession_node_id] : null} photoPath={res.photos?.[job.id] ?? null} />
                </li>
              ))
            : (res.items as Parameters<typeof WorkerResultCard>[0]["worker"][]).map((w) => (
                <li key={w.id}>
                  <WorkerResultCard worker={w} imageUrl={w.profession_node_id ? res.images[w.profession_node_id] : null} />
                </li>
              ))}
        </ul>
      ) : (
        <section className="space-y-4 rounded-2xl border-2 border-dashed border-border bg-card p-6 text-center">
          <h2 className="text-2xl font-bold">
            {wholeCountry
              ? t(isJobs ? "easy.search.empty_title_jobs_all" : "easy.search.empty_title_workers_all", { name: prof })
              : t(isJobs ? "easy.search.empty_title_jobs" : "easy.search.empty_title_workers")}
          </h2>
          <p className="text-muted-foreground">{t(wholeCountry ? "easy.search.empty_desc_all" : "easy.search.empty_desc")}</p>
          <div className="mx-auto grid max-w-md gap-3">
            {activeFilterCount(params) ? (
              <Button asChild size="xl" className="h-14 text-lg">
                <Link href={findHref(params, { salary: null, schedule: null, noexp: false, exp: false, pay: params.p ? null : params.pay, page: 1 })}>{t("easy.search.empty_no_filters")}</Link>
              </Button>
            ) : district ? (
              <Button asChild size="xl" className="h-14 text-lg">
                <Link href={findHref(params, { district: "all", page: 1 })}>{t(isCityRegion(region) ? "easy.search.empty_city" : "easy.search.empty_region")}</Link>
              </Button>
            ) : region || remote ? (
              <Button asChild size="xl" className="h-14 text-lg">
                <Link href={findHref(params, { region: "all", district: null, page: 1 })}>{t("easy.search.empty_country")}</Link>
              </Button>
            ) : null}
            {wholeCountry ? null : (
              <Button asChild size="xl" variant="outline" className="h-14 text-lg">
                <Link href={findHref(params, { region: null, district: null, page: 1 })}>{t("easy.search.empty_change_region")}</Link>
              </Button>
            )}
            <Button asChild size="xl" variant="outline" className="h-14 text-lg">
              <Link href={findHref(params, { p: null, page: 1 })}>{t("easy.search.empty_change_profession")}</Link>
            </Button>
          </div>
        </section>
      )}

      {pages > 1 ? (
        <nav className="flex items-center justify-between gap-3" aria-label="pagination">
          {params.page > 1 ? (
            <Button asChild variant="outline" className="h-14 px-5 text-lg">
              <Link href={findHref(params, { page: params.page - 1 })}>
                <ArrowLeft className="size-5" aria-hidden /> {t("easy.search.prev")}
              </Link>
            </Button>
          ) : (
            <span />
          )}
          <span className="text-base font-semibold text-muted-foreground">{t("easy.search.page_of", { page: params.page, pages })}</span>
          {params.page < pages ? (
            <Button asChild className="h-14 px-5 text-lg">
              <Link href={findHref(params, { page: params.page + 1 })}>
                {t("easy.search.next")} <ArrowRight className="size-5" aria-hidden />
              </Link>
            </Button>
          ) : (
            <span />
          )}
        </nav>
      ) : null}

      <Link href={isJobs ? "/post/worker" : "/post/vacancy"} className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-secondary px-4 py-3 text-center text-lg font-semibold text-primary hover:bg-primary-soft">
        {isJobs ? t("easy.search.post_workers") : t("easy.search.post_jobs")} <ArrowRight className="size-5 shrink-0" aria-hidden />
      </Link>
    </div>
  );
}
