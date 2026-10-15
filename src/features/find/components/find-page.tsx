import Link from "next/link";
import Form from "next/form";
import { Suspense, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Search, X } from "lucide-react";
import { after } from "next/server";
import { getT } from "@/lib/i18n/server";
import { formatMoneyShort } from "@/lib/format";
import { getSession } from "@/features/auth/session";
import { trackServer } from "@/features/analytics/server";
import type { District, Region } from "@/lib/reference";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { activeFilterCount, findHref, type FindParams } from "../params";
import { PAGE_SIZE, findJobs, findWorkers, logFindSearch, type FindOutcome, type NodeInfo } from "../queries";
import { ChangeSheet, FilterSheet, RetryButton } from "./find-client";
import { JobResultCard, WorkerResultCard, type JobCardData } from "./result-cards";
import { isCityRegion } from "@/lib/geo/city";
import { ModeChooser } from "@/features/mode/components/mode-chooser";
import { savedIdSet } from "@/features/saved/queries";
import { myApplicationStatuses } from "@/features/applications/queries";
import { MarketAside } from "./market-aside";

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
      {/* tanlov eslab qolinadi: keyingi safar "ish yoki ishchi?" so'ralmaydi, bosh sahifa ham shu rejimda */}
      <ModeChooser heading={null} next={{ worker: findHref(params, { mode: "jobs", page: 1 }), employer: findHref(params, { mode: "workers", page: 1 }) }} />

      {/* mijoz routeri bilan (sahifa qayta yuklanmaydi); prefetch yo'q — bo'sh /search rejimga yo'naltiriladi */}
      <Form action="/search" prefetch={false} className="space-y-3 rounded-2xl border border-border bg-card p-4 sm:p-5">
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
      </Form>
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
      <ModeChooser heading={null} next={{ worker: findHref(params, { mode: "jobs" }), employer: findHref(params, { mode: "workers" }) }} />
    </StepShell>
  );
}

/**
 * Natijalar: qisqa xulosa + O'zgartirish + Filtr, faol filtrlar (bittadan olib tashlanadi), kartalar, sahifalar, bo'sh holat.
 * `text` — kasbga aylanmagan matn bo'yicha (sarlavha, tavsif, kompaniya) oldindan olingan natija (S1).
 */
export async function FindResultsView({
  params,
  node,
  region,
  district,
  text,
}: {
  params: FindParams;
  node: NodeInfo | null;
  region: Region | null;
  district: District | null;
  text?: FindOutcome<JobCardData>;
}) {
  const { t, name } = await getT();
  const remote = params.region === "remote";
  const place = { regionId: region?.id ?? null, districtId: district?.id ?? null, remote };
  const isJobs = params.mode === "jobs";
  const res = text ?? (isJobs ? await findJobs(params, place) : await findWorkers(params, place));
  const total = res.ok ? res.total : 0;
  const pages = Math.max(1, Math.ceil(Math.min(total, 5000) / PAGE_SIZE));
  const prof = node
    ? name(node.trail.at(-1)!)
    : text
      ? `«${params.q}»`
      : params.pay === "daily" && isJobs
        ? t("easy.search.daily_jobs")
        : params.any
          ? t("easy.search.all_professions")
          : "";
  const placeText = remote ? t("easy.location.remote") : region ? `${name(region)} · ${district ? name(district) : t(isCityRegion(region) ? "easy.location.whole_city" : "easy.location.whole_region")}` : t("easy.location.whole_country");
  // qisqa xulosa: "Buxgalter · Toshkent" — filtrlar alohida chiplarda (ActiveFilters)
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
        understood: { node: node?.id ?? null, text: !!text, region: region?.id ?? null, district: district?.id ?? null, remote, salary: params.salary, schedule: params.schedule },
        results: total,
        profileId,
      }),
    );
  }

  // qaysi kartalar saqlangan ("Saqlash" belgisi holati bilan) va qaysiga ariza yuborilgan (kartada holati)
  const session = await getSession();
  const ids = res.ok ? res.items.map((i) => i.id) : [];
  const [saved, applied] = await Promise.all([
    savedIdSet(session, isJobs ? "vacancy" : "worker", ids),
    isJobs ? myApplicationStatuses(session?.workerId ?? null, ids) : Promise.resolve(new Map<string, never>()),
  ]);

  // "Butun O'zbekiston" bo'yicha ham bo'sh — "bu hududda" deyilmaydi va hududni o'zgartirish taklif qilinmaydi
  const wholeCountry = !region && !remote;

  // qidiruv qatori: shu rejim va hududda matn bo'yicha (kasb aniqlanadi — mavjud "aqlli qidiruv"), filtrlar saqlanadi
  const keep: Array<[string, string]> = [["mode", params.mode!]];
  if (params.region) keep.push(["region", params.region]);
  if (params.district) keep.push(["district", params.district]);
  if (params.salary) keep.push(["salary", String(params.salary)]);
  if (params.schedule) keep.push(["schedule", params.schedule]);
  if (params.noexp) keep.push(["noexp", "1"]);
  if (params.exp) keep.push(["exp", "1"]);

  return (
    <div className="container-app py-3 text-lg sm:py-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-3">
          {/* J1 (ishgo uslubi): tepada qidiruv va Filtr, ostida qisqa xulosa, soni va "O'zgartirish" (kasb · hudud · rejim) */}
          <div className="flex items-center gap-2">
            {/* matn serverda kasbga aylantiriladi (yo'naltirish) — mijoz routeri bilan, sahifa qayta yuklanmaydi */}
            <Form action="/search" prefetch={false} role="search" className="min-w-0 flex-1">
              {keep.map(([k, v]) => (
                <input key={k} type="hidden" name={k} value={v} />
              ))}
              <Input
                name="q"
                type="search"
                defaultValue={node ? prof : text ? params.q : ""}
                placeholder={isJobs ? t("easy.search.search_jobs_placeholder") : t("easy.search.search_workers_placeholder")}
                aria-label={t("easy.search.search_label")}
                leftIcon={<Search />}
                className="h-12 rounded-xl text-base"
                maxLength={120}
                minLength={2}
                required
              />
            </Form>
            <FilterSheet mode={params.mode!} salary={params.salary} schedule={params.schedule} noexp={params.noexp} exp={params.exp} daily={params.pay === "daily"} count={activeFilterCount(params)} />
          </div>
          <div>
            <h1 className="text-base font-bold leading-snug [overflow-wrap:anywhere] sm:text-lg">
              {isJobs ? t("easy.search.summary_jobs") : t("easy.search.summary_workers")}: {[prof, placeText].join(" · ")}
            </h1>
            <div className="flex min-h-11 items-center justify-between gap-3">
              <p className="text-sm font-semibold text-muted-foreground" aria-live="polite">
                {total ? t("easy.search.found", { count: total >= 5000 ? "5 000+" : total }) : null}
              </p>
              <ChangeSheet
                compact
                modeHref={findHref(params, { mode: null, page: 1 })}
                professionHref={findHref(params, { p: null, q: "", page: 1 })}
                regionHref={findHref(params, { region: null, district: null, page: 1 })}
              />
            </div>
          </div>

      <ActiveFilters params={params} hasProfession={!!node || !!text} />

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
        <ul className="pop-list grid grid-cols-1 gap-3">
          {isJobs
            ? (res.items as Parameters<typeof JobResultCard>[0]["job"][]).map((job) => (
                <li key={job.id}>
                  <JobResultCard
                    job={job}
                    imageUrl={job.profession_node_id ? res.images[job.profession_node_id] : null}
                    photoPath={res.photos?.[job.id] ?? null}
                    saved={saved.has(job.id)}
                    applied={applied.get(job.id) ?? null}
                  />
                </li>
              ))
            : (res.items as Parameters<typeof WorkerResultCard>[0]["worker"][]).map((w) => (
                <li key={w.id}>
                  <WorkerResultCard worker={w} imageUrl={w.profession_node_id ? res.images[w.profession_node_id] : null} saved={saved.has(w.id)} />
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
            <Button asChild variant="outline" className="h-11 px-4 text-base">
              <Link href={findHref(params, { page: params.page - 1 })}>
                <ArrowLeft className="size-5" aria-hidden /> {t("easy.search.prev")}
              </Link>
            </Button>
          ) : (
            <span />
          )}
          <span className="text-base font-semibold text-muted-foreground">{t("easy.search.page_of", { page: params.page, pages })}</span>
          {params.page < pages ? (
            <Button asChild className="h-11 px-4 text-base">
              <Link href={findHref(params, { page: params.page + 1 })}>
                {t("easy.search.next")} <ArrowRight className="size-5" aria-hidden />
              </Link>
            </Button>
          ) : (
            <span />
          )}
        </nav>
      ) : null}

      {/* telefonda — ro'yxat ostida; kompyuterda — o'ng panelda */}
      <Link href={isJobs ? "/post/worker" : "/post/vacancy"} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-secondary px-4 py-2.5 text-center text-base font-semibold text-primary hover:bg-primary-soft lg:hidden">
        {isJobs ? t("easy.search.post_workers") : t("easy.search.post_jobs")} <ArrowRight className="size-5 shrink-0" aria-hidden />
      </Link>
        </div>
        {/* statistika so'rovlari (kesh tugaganda) ro'yxatni ushlab turmasin — kartalar darhol, panel keyin */}
        <Suspense fallback={<div className="hidden lg:block" aria-hidden />}>
          <MarketAside mode={isJobs ? "jobs" : "workers"} />
        </Suspense>
      </div>
    </div>
  );
}

/**
 * Faol filtrlar (S2): har biri alohida chip — bosilsa faqat o'sha filtr olib tashlanadi; ikkita va undan ko'p bo'lsa —
 * "Hammasini tozalash". Kasb va hudud — sarlavhada ("O'zgartirish" orqali).
 */
async function ActiveFilters({ params, hasProfession }: { params: FindParams; hasProfession: boolean }) {
  const { t, tEnum, locale } = await getT();
  const jobs = params.mode === "jobs";
  // kasb tanlanmagan "Kunlik ishlar"da kunlik — filtr emas, bo'limning o'zi: olib tashlansa barcha kasblar qoladi
  const keepAny = !params.p ? { any: true } : {};
  const items = [
    jobs && params.salary ? { key: "salary", label: t("easy.search.salary_over", { amount: formatMoneyShort(params.salary, locale) }), href: findHref(params, { salary: null, page: 1 }) } : null,
    jobs && params.schedule ? { key: "schedule", label: tEnum("work_schedule", params.schedule), href: findHref(params, { schedule: null, page: 1 }) } : null,
    jobs && params.noexp ? { key: "noexp", label: t("easy.search.no_experience"), href: findHref(params, { noexp: false, page: 1 }) } : null,
    jobs && params.pay === "daily" && hasProfession ? { key: "daily", label: t("easy.search.daily_only"), href: findHref(params, { pay: null, page: 1, ...keepAny }) } : null,
    !jobs && params.exp ? { key: "exp", label: t("easy.search.experienced"), href: findHref(params, { exp: false, page: 1 }) } : null,
  ].filter((x): x is { key: string; label: string; href: string } => !!x);
  if (!items.length) return null;
  const clearAll = findHref(params, { salary: null, schedule: null, noexp: false, exp: false, pay: hasProfession ? null : params.pay, page: 1 });
  return (
    // telefonda — bitta suriladigan qator (ro'yxat pastga surilmaydi), kattaroq ekranda — o'raladi
    <div role="group" aria-label={t("easy.search.active_filters")} className="-mx-4 flex items-center gap-2 overflow-x-auto overscroll-x-contain px-4 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden">
      {items.map((f) => (
        <Link
          key={f.key}
          href={f.href}
          prefetch={false}
          aria-label={t("easy.search.filter_remove", { label: f.label })}
          className="press inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-primary/40 bg-primary-soft/60 px-3 text-sm font-semibold text-primary hover:bg-primary-soft"
        >
          <span>{f.label}</span>
          <X className="size-4 shrink-0" aria-hidden />
        </Link>
      ))}
      {items.length > 1 ? (
        <Link href={clearAll} prefetch={false} className="inline-flex min-h-11 shrink-0 items-center whitespace-nowrap px-2 text-sm font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
          {t("easy.search.filters_clear")}
        </Link>
      ) : null}
    </div>
  );
}
