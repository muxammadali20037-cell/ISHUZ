import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, ArrowRight, BriefcaseBusiness, ChevronRight, Globe2, MapPin, Search, UsersRound } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import type { Category, District, Region } from "@/lib/reference";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { activeFilterCount, findHref, type FindParams } from "../params";
import { PAGE_SIZE, findJobs, findWorkers, type NodeInfo } from "../queries";
import { ChangeSheet, FilterSheet, FindProfessionStep } from "./find-client";
import { JobResultCard, WorkerResultCard } from "./result-cards";

const bigLink = "flex min-h-14 w-full items-center gap-3 rounded-2xl border-2 border-border bg-card px-4 py-3 text-left text-lg font-semibold transition-colors hover:border-primary/50";

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
      <div className="grid gap-4 sm:grid-cols-2">
        <Link href={findHref(params, { mode: "jobs", page: 1 })} className="flex min-h-32 flex-col justify-between gap-3 rounded-3xl bg-primary p-5 text-primary-foreground shadow-md transition-transform active:scale-[0.99]">
          <BriefcaseBusiness className="size-9" aria-hidden />
          <span>
            <span className="block text-2xl font-extrabold">{t("easy.search.jobs")}</span>
            <span className="block text-base text-primary-foreground/85">{t("easy.search.jobs_desc")}</span>
          </span>
        </Link>
        <Link href={findHref(params, { mode: "workers", page: 1 })} className="flex min-h-32 flex-col justify-between gap-3 rounded-3xl bg-success p-5 text-success-foreground shadow-md transition-transform active:scale-[0.99]">
          <UsersRound className="size-9" aria-hidden />
          <span>
            <span className="block text-2xl font-extrabold">{t("easy.search.workers")}</span>
            <span className="block text-base text-success-foreground/85">{t("easy.search.workers_desc")}</span>
          </span>
        </Link>
      </div>

      <form action="/search" method="get" className="space-y-3 rounded-3xl border border-border bg-card p-4 sm:p-5">
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
              <Link key={ex} href={`/search?q=${encodeURIComponent(ex)}`} className="inline-flex min-h-12 items-center rounded-full border border-primary/40 bg-primary-soft/50 px-4 text-base font-semibold text-primary hover:bg-primary-soft">
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
      <div className="grid gap-4 sm:grid-cols-2">
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

export async function FindProfession({ params, categories }: { params: FindParams; categories: Category[] }) {
  const { t } = await getT();
  const title = params.mode === "workers" ? t("easy.search.profession_workers") : t("easy.search.profession_jobs");
  return (
    <StepShell back={findHref(params, { mode: null, p: null })} title={params.mode === "workers" ? t("easy.search.workers") : t("easy.search.jobs")}>
      {params.q ? <p className="rounded-2xl border border-warning/40 bg-warning-soft px-4 py-3 text-lg">{t("easy.search.not_understood", { q: params.q })}</p> : null}
      <FindProfessionStep categories={categories} title={title} initialQuery={params.q} hrefTemplate={findHref(params, { p: "__NODE__", page: 1 })} />
    </StepShell>
  );
}

function ChosenSummary({ items }: { items: string[] }) {
  return <p className="rounded-2xl bg-secondary px-4 py-3 text-lg font-semibold">{items.filter(Boolean).join(" · ")}</p>;
}

export async function FindRegion({ params, regions, node }: { params: FindParams; regions: Region[]; node: NodeInfo | null }) {
  const { t, name } = await getT();
  const prof = node ? name(node.trail.at(-1)!) : "";
  return (
    <StepShell
      back={findHref(params, { p: null, region: null, district: null })}
      title={t("easy.search.region_title")}
      summary={<ChosenSummary items={[params.mode === "workers" ? t("easy.search.summary_workers") : t("easy.search.summary_jobs"), prof]} />}
    >
      <ul className="grid gap-2 sm:grid-cols-2">
        <li className="sm:col-span-2">
          <Link href={findHref(params, { region: "all", district: null, page: 1 })} className={cn(bigLink, "border-primary/40")}>
            <Globe2 className="size-6 shrink-0 text-primary" aria-hidden />
            <span className="flex-1">{t("easy.location.whole_country")}</span>
            <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
          </Link>
        </li>
        {regions.map((r) => (
          <li key={r.id}>
            <Link href={findHref(params, { region: r.slug, district: null, page: 1 })} className={bigLink}>
              <MapPin className="size-6 shrink-0 text-primary" aria-hidden />
              <span className="flex-1">{name(r)}</span>
              <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        ))}
        <li className="sm:col-span-2">
          <Link href={findHref(params, { region: "remote", district: null, page: 1 })} className={bigLink}>
            <Globe2 className="size-6 shrink-0 text-primary" aria-hidden />
            <span className="flex-1">
              <span className="block">{t("easy.location.remote")}</span>
              <span className="block text-base font-normal text-muted-foreground">{t("easy.location.remote_desc")}</span>
            </span>
            <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
          </Link>
        </li>
      </ul>
    </StepShell>
  );
}

export async function FindDistrict({ params, region, districts, node }: { params: FindParams; region: Region; districts: District[]; node: NodeInfo | null }) {
  const { t, name } = await getT();
  const prof = node ? name(node.trail.at(-1)!) : "";
  return (
    <StepShell
      back={findHref(params, { region: null, district: null })}
      title={t("easy.location.pick_district", { region: name(region) })}
      summary={<ChosenSummary items={[params.mode === "workers" ? t("easy.search.summary_workers") : t("easy.search.summary_jobs"), prof, name(region)]} />}
    >
      <ul className="grid gap-2 sm:grid-cols-2">
        <li className="sm:col-span-2">
          <Link href={findHref(params, { district: "all", page: 1 })} className={cn(bigLink, "border-primary/40")}>
            <span className="flex-1">
              <span className="block">{t("easy.location.whole_region")}</span>
              <span className="block text-base font-normal text-muted-foreground">{t("easy.location.whole_region_desc")}</span>
            </span>
            <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
          </Link>
        </li>
        {districts.map((d) => (
          <li key={d.id}>
            <Link href={findHref(params, { district: d.id, page: 1 })} className={bigLink}>
              <span className="flex-1">{name(d)}</span>
              <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </StepShell>
  );
}

/** Natijalar: qisqa xulosa + O'zgartirish + Filtr, kartalar, sahifalar, bo'sh holat */
export async function FindResultsView({ params, node, region, district }: { params: FindParams; node: NodeInfo | null; region: Region | null; district: District | null }) {
  const { t, name } = await getT();
  const remote = params.region === "remote";
  const place = { regionId: region?.id ?? null, districtId: district?.id ?? null, remote };
  const isJobs = params.mode === "jobs";
  const res = isJobs ? await findJobs(params, place) : await findWorkers(params, place);
  const pages = Math.max(1, Math.ceil(Math.min(res.total, 5000) / PAGE_SIZE));
  const prof = node ? name(node.trail.at(-1)!) : "";
  const placeText = remote ? t("easy.location.remote") : region ? `${name(region)} · ${district ? name(district) : t("easy.location.whole_region")}` : t("easy.location.whole_country");
  const backHref = region ? findHref(params, { district: null, page: 1 }) : findHref(params, { region: null, district: null, page: 1 });

  return (
    <div className="container-app space-y-5 py-4 text-lg sm:py-8">
      <div className="space-y-3">
        <Button asChild variant="outline" className="h-12 px-4 text-base">
          <Link href={backHref}>
            <ArrowLeft className="size-5" aria-hidden /> {t("easy.wizard.back")}
          </Link>
        </Button>
        <h1 className="text-xl font-extrabold leading-snug [overflow-wrap:anywhere] sm:text-2xl">
          {isJobs ? t("easy.search.summary_jobs") : t("easy.search.summary_workers")}: {prof} · {placeText}
        </h1>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <ChangeSheet
          modeHref={findHref(params, { mode: null, page: 1 })}
          professionHref={findHref(params, { p: null, page: 1 })}
          regionHref={findHref(params, { region: null, district: null, page: 1 })}
        />
        <FilterSheet mode={params.mode!} salary={params.salary} schedule={params.schedule} noexp={params.noexp} exp={params.exp} count={activeFilterCount(params)} />
        {res.total ? (
          <p className="text-base font-semibold text-muted-foreground" aria-live="polite">
            {t("easy.search.found", { count: res.total >= 5000 ? "5 000+" : res.total })}
          </p>
        ) : null}
      </div>

      {res.items.length ? (
        <ul className="grid gap-4 lg:grid-cols-2">
          {isJobs
            ? (res.items as Parameters<typeof JobResultCard>[0]["job"][]).map((job) => (
                <li key={job.id}>
                  <JobResultCard job={job} imageUrl={job.profession_node_id ? res.images[job.profession_node_id] : null} />
                </li>
              ))
            : (res.items as Parameters<typeof WorkerResultCard>[0]["worker"][]).map((w) => (
                <li key={w.id}>
                  <WorkerResultCard worker={w} imageUrl={w.profession_node_id ? res.images[w.profession_node_id] : null} />
                </li>
              ))}
        </ul>
      ) : (
        <section className="space-y-4 rounded-3xl border-2 border-dashed border-border bg-card p-6 text-center">
          <h2 className="text-2xl font-bold">{t("easy.search.empty_title")}</h2>
          <p className="text-muted-foreground">{t("easy.search.empty_desc")}</p>
          <div className="mx-auto grid max-w-md gap-3">
            {district ? (
              <Button asChild size="xl" className="h-14 text-lg">
                <Link href={findHref(params, { district: "all", page: 1 })}>{t("easy.search.empty_region")}</Link>
              </Button>
            ) : region || remote ? (
              <Button asChild size="xl" className="h-14 text-lg">
                <Link href={findHref(params, { region: "all", district: null, page: 1 })}>{t("easy.search.empty_country")}</Link>
              </Button>
            ) : null}
            <Button asChild size="xl" variant="outline" className="h-14 text-lg">
              <Link href={findHref(params, { region: null, district: null, page: 1 })}>{t("easy.search.empty_change_region")}</Link>
            </Button>
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
