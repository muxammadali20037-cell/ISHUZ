import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  ChevronDown,
  ChevronRight,
  Inbox,
  LayoutGrid,
  LifeBuoy,
  MessageCircle,
  MousePointerClick,
  ShieldCheck,
  Wallet,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { getCategories } from "@/lib/reference";
import type { SessionContext } from "@/features/auth/session";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CategoryIcon } from "@/components/shared/category-icon";
import { EMPTY_FIND, findHref } from "@/features/find/params";
import { findJobs } from "@/features/find/queries";
import { JobResultCard, WorkerResultCard } from "@/features/find/components/result-cards";
import { RetryButton } from "@/features/find/components/find-client";
import { savedIdSet } from "@/features/saved/queries";
import { myApplicationStatuses } from "@/features/applications/queries";
import { enterMode } from "@/features/mode/actions";
import { cn } from "@/lib/utils";
import { TileButton } from "../entry-client";
import { getNewWorkers } from "../home-queries";
import type { EntryStats } from "../entry-queries";
import { CATEGORY_PREVIEW, LATEST_TABS, latestTabFind, latestTabHref, type LatestTab, type MarketCounts } from "./model";

const num = (n: number) => new Intl.NumberFormat("ru-RU").format(n);
const LATEST = 6;

/** Bo'lim sarlavhasi: h2 + izoh + (ixtiyoriy) o'ngdagi havola */
function SectionHead({ id, title, subtitle, action }: { id: string; title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-1 sm:mb-5">
      <div className="min-w-0">
        <h2 id={id} className="text-2xl font-extrabold tracking-tight sm:text-3xl">
          {title}
        </h2>
        {subtitle ? <p className="mt-1 text-base text-muted-foreground">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

/** Shu rejimni yozib, berilgan joyga o'tadigan tugma (JS'siz ham ishlaydi) — mavjud "maqsad plitkalari" mexanizmi */
function ModeButton({ mode, next, track, className, children }: { mode: "worker" | "employer"; next: string; track: string; className: string; children: React.ReactNode }) {
  return (
    <form action={enterMode} className="flex">
      <input type="hidden" name="mode" value={mode} />
      <input type="hidden" name="next" value={next} />
      <TileButton data-track="home_cta" data-track-to={track} className={className}>
        {children}
      </TileButton>
    </form>
  );
}

const btnPrimary = "press lift-sm inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-base font-bold text-primary-foreground shadow-sm hover:bg-primary-hover";
const btnOutline = "press inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-border bg-card px-5 text-base font-bold text-foreground hover:border-primary/50";

/** Ishonch qatori: faqat haqiqatan ishlaydigan jarayonlar (avtomatik tekshiruv + moderator, maosh maydoni, aloqa usullari, yordam) */
export async function TrustStrip() {
  const { t } = await getT();
  const items: { icon: LucideIcon; title: string; desc: string; href?: string }[] = [
    { icon: ShieldCheck, title: t("welcome.market.trust_verified"), desc: t("welcome.market.trust_verified_desc") },
    { icon: Wallet, title: t("welcome.market.trust_salary"), desc: t("welcome.market.trust_salary_desc") },
    { icon: MessageCircle, title: t("welcome.market.trust_contact"), desc: t("welcome.market.trust_contact_desc") },
    { icon: LifeBuoy, title: t("welcome.market.trust_help"), desc: t("welcome.market.trust_help_desc"), href: "/help" },
  ];
  return (
    <section aria-label={t("welcome.market.trust_label")} className="container-app py-6 sm:py-8">
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((it) => {
          const body = (
            <>
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary" aria-hidden>
                <it.icon className="size-5" />
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-1 text-base font-bold leading-tight">
                  {it.title}
                  {it.href ? <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden /> : null}
                </span>
                <span className="mt-1 block text-sm leading-snug text-muted-foreground">{it.desc}</span>
              </span>
            </>
          );
          return (
            <li key={it.title} className="flex">
              {it.href ? (
                <Link href={it.href} className="press flex w-full gap-3 rounded-2xl border border-border bg-card p-4 hover:border-primary/50">
                  {body}
                </Link>
              ) : (
                <div className="flex w-full gap-3 rounded-2xl border border-border bg-card p-4">{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Sohalar: ma'lumotnomadagi haqiqiy sohalar, son — bazadan (bo'lmasa ko'rsatilmaydi). Har biri /jobs?category= ga */
export async function CategoryGrid({ counts }: { counts: MarketCounts | null }) {
  const [{ t, name }, categories] = await Promise.all([getT(), getCategories()]);
  if (!categories.length) return null;
  const first = categories.slice(0, CATEGORY_PREVIEW);
  const rest = categories.slice(CATEGORY_PREVIEW);
  const card = (c: (typeof categories)[number]) => {
    const n = counts?.categories[c.id] ?? 0;
    return (
      <li key={c.id} className="flex">
        <Link
          href={`/jobs?category=${encodeURIComponent(c.slug)}`}
          prefetch={false}
          data-track="home_category"
          data-track-to={c.slug}
          className="press lift-sm flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-3 hover:border-primary/50 sm:p-4"
        >
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary" aria-hidden>
            <CategoryIcon name={c.icon} className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block break-words text-sm font-bold leading-snug sm:text-base">{name(c)}</span>
            {n > 0 ? <span className="mt-0.5 block text-xs font-semibold text-muted-foreground sm:text-sm">{t("welcome.market.cat_count", { count: num(n) })}</span> : null}
          </span>
        </Link>
      </li>
    );
  };
  const grid = "grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-3 lg:grid-cols-4";
  return (
    <section id="sohalar" aria-labelledby="home-categories" className="container-app scroll-mt-20 py-8 sm:py-10">
      <SectionHead id="home-categories" title={t("welcome.market.cat_title")} subtitle={t("welcome.market.cat_subtitle")} />
      <ul className={grid}>{first.map(card)}</ul>
      {rest.length ? (
        <details className="group mt-3">
          <summary className="press mx-auto flex min-h-12 w-full max-w-sm cursor-pointer list-none items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 text-base font-bold text-primary hover:border-primary/50 [&::-webkit-details-marker]:hidden">
            <LayoutGrid className="size-5" aria-hidden />
            <span className="group-open:hidden">{t("welcome.market.cat_all", { count: categories.length })}</span>
            <span className="hidden group-open:inline">{t("welcome.market.cat_less")}</span>
            <ChevronDown className="size-5 transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <ul className={cn(grid, "mt-3")}>{rest.map(card)}</ul>
        </details>
      ) : null}
    </section>
  );
}

/** "Yangi ishlar": filtrlar URL'da (?ish=…) — orqaga tugmasi va ulashish ishlaydi; ro'yxat — haqiqiy qidiruv natijasi */
export async function LatestJobsSection({ session, tab }: { session: SessionContext | null; tab: LatestTab }) {
  const { t } = await getT();
  return (
    <section id="yangi-ishlar" aria-labelledby="home-latest" className="container-app scroll-mt-20 py-8 sm:py-10">
      <SectionHead id="home-latest" title={t("welcome.market.latest_title")} subtitle={t("welcome.market.latest_subtitle")} />
      <nav aria-label={t("welcome.market.tabs_label")} className="-mx-4 mb-4 sm:mx-0">
        <ul className="flex gap-2 overflow-x-auto overscroll-x-contain px-4 pb-1 [scrollbar-width:none] sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden">
          {LATEST_TABS.map((k) => {
            const on = k === tab;
            return (
              <li key={k} className="flex">
                <Link
                  href={latestTabHref(k)}
                  prefetch={false}
                  scroll={false}
                  aria-current={on ? "page" : undefined}
                  className={cn(
                    "press inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-full border px-4 text-sm font-bold",
                    on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:border-primary/50 hover:text-primary",
                  )}
                >
                  {t(`welcome.market.tab_${k}`)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <LatestJobsList session={session} tab={tab} />
    </section>
  );
}

async function LatestJobsList({ session, tab }: { session: SessionContext | null; tab: LatestTab }) {
  const { t } = await getT();
  const { params, remote } = latestTabFind(tab);
  const res = await findJobs(params, { regionId: null, districtId: null, remote }, LATEST);
  if (!res.ok) {
    return (
      <div role="alert" className="space-y-3 rounded-2xl border border-warning/40 bg-warning-soft p-5 text-center">
        <p className="text-lg font-bold">{t("welcome.market.latest_error")}</p>
        <p className="text-muted-foreground">{t("welcome.market.latest_error_desc")}</p>
        <div className="mx-auto grid max-w-sm">
          <RetryButton label={t("easy.search.retry")} />
        </div>
        <p className="text-sm text-muted-foreground">{t("easy.search.error_code", { code: res.errorId })}</p>
      </div>
    );
  }
  if (!res.items.length) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center">
        <Inbox className="mx-auto size-8 text-muted-foreground" aria-hidden />
        <p className="mt-2 text-lg font-bold">{t("welcome.market.latest_empty")}</p>
        <p className="mt-1 text-muted-foreground">{t("welcome.market.latest_empty_desc")}</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {tab !== "all" ? (
            <Button asChild variant="outline" className="h-11">
              <Link href={latestTabHref("all")} scroll={false}>
                {t("welcome.market.latest_empty_all")}
              </Link>
            </Button>
          ) : null}
          <Button asChild variant="outline" className="h-11">
            <Link href="#sohalar">{t("welcome.market.latest_empty_fields")}</Link>
          </Button>
          <ModeButton mode="employer" next="/post/vacancy" track="post_from_empty" className={cn(btnPrimary, "min-h-11")}>
            {t("welcome.market.latest_empty_post")}
          </ModeButton>
        </div>
      </div>
    );
  }
  const ids = res.items.map((i) => i.id);
  const [saved, applied] = await Promise.all([savedIdSet(session, "vacancy", ids), myApplicationStatuses(session?.workerId ?? null, ids)]);
  return (
    <>
      <ul className="pop-list grid grid-cols-1 gap-3 lg:grid-cols-2">
        {res.items.map((job) => (
          <li key={job.id}>
            <JobResultCard
              job={job}
              imageUrl={job.profession_node_id ? res.images[job.profession_node_id] : null}
              photoPath={res.photos?.[job.id] ?? null}
              saved={saved.has(job.id)}
              applied={applied.get(job.id) ?? null}
            />
          </li>
        ))}
      </ul>
      <div className="mt-4 flex justify-center">
        <Button asChild variant="outline" className="h-12 w-full px-6 text-base font-bold sm:w-auto">
          <Link href={findHref(params)} prefetch={false}>
            {t("welcome.market.latest_all")}
            {res.total > res.items.length ? ` (${res.total >= 5000 ? "5 000+" : num(res.total)})` : ""} <ArrowRight className="size-5" aria-hidden />
          </Link>
        </Button>
      </div>
    </>
  );
}

/** Ro'yxat skeleti: kartalar balandligiga yaqin — kontent kelganda sahifa siljimaydi */
export function LatestJobsSkeleton() {
  return (
    <div className="container-app py-8 sm:py-10" aria-hidden>
      <Skeleton className="h-8 w-48" />
      <Skeleton className="mt-2 h-5 w-72 max-w-full" />
      <div className="mt-4 flex gap-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-11 w-28 rounded-full" />
        ))}
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-2xl border border-border bg-card p-3 shadow-sm sm:p-4">
            <div className="flex gap-3">
              <Skeleton className="size-14 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </div>
            <Skeleton className="mt-3 h-11 w-36 rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Ish beruvchilar bo'limi: mavjud oqimlarga — e'lon berish (kirish kerak bo'lsa, joylashda so'raladi va qaytariladi), ishchilar ro'yxati */
export async function EmployerBand() {
  const { t } = await getT();
  const workers = findHref(EMPTY_FIND, { mode: "workers", any: true, region: "all" });
  const benefits = [t("welcome.market.emp_b1"), t("welcome.market.emp_b2"), t("welcome.market.emp_b3"), t("welcome.market.emp_b4")];
  return (
    <section aria-labelledby="home-employers" className="container-app py-8 sm:py-10">
      <div className="grid grid-cols-1 gap-6 rounded-2xl bg-primary p-5 text-primary-foreground sm:p-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center lg:p-10">
        <div>
          <h2 id="home-employers" className="text-2xl font-extrabold tracking-tight sm:text-3xl">
            {t("welcome.market.emp_title")}
          </h2>
          <p className="mt-2 text-base leading-relaxed opacity-90 sm:text-lg">{t("welcome.market.emp_desc")}</p>
          <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
            <ModeButton
              mode="employer"
              next="/post/vacancy"
              track="post_vacancy"
              className="press lift-sm inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-card px-5 text-base font-bold text-primary shadow-sm hover:bg-primary-soft sm:w-auto"
            >
              {t("welcome.market.emp_post")} <ArrowRight className="size-5" aria-hidden />
            </ModeButton>
            <ModeButton
              mode="employer"
              next={workers}
              track="browse_workers"
              className="press inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-primary-foreground/40 px-5 text-base font-bold hover:bg-primary-foreground/10 sm:w-auto"
            >
              {t("welcome.market.emp_browse")}
            </ModeButton>
          </div>
        </div>
        <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {benefits.map((b) => (
            <li key={b} className="flex gap-2.5 rounded-xl bg-primary-foreground/10 p-3 text-sm font-semibold leading-snug sm:text-base">
              <BadgeCheck className="size-5 shrink-0" aria-hidden />
              <span className="min-w-0">{b}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** Ishchilar: faqat o'zlari e'lon qilgan ochiq e'lonlar (telefon — ruxsatga qarab, qidiruvdagi qoida bilan). Yo'q bo'lsa — e'lon berish */
export async function WorkersPreview() {
  const [{ t }, feed] = await Promise.all([getT(), getNewWorkers({ region: null, district: null }, 4)]);
  if (!feed.ok) return null;
  const all = findHref(EMPTY_FIND, { mode: "workers", any: true, region: "all" });
  return (
    <section aria-labelledby="home-workers" className="container-app py-8 sm:py-10">
      <SectionHead
        id="home-workers"
        title={t("welcome.market.workers_title")}
        subtitle={t("welcome.market.workers_subtitle")}
        action={
          feed.items.length ? (
            <ModeButton mode="employer" next={all} track="all_workers" className="press -my-2 inline-flex min-h-11 items-center gap-1 text-base font-bold text-primary hover:underline">
              {t("welcome.market.workers_all")} <ChevronRight className="size-4" aria-hidden />
            </ModeButton>
          ) : null
        }
      />
      {feed.items.length ? (
        <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {feed.items.map((w) => (
            <li key={w.id}>
              <WorkerResultCard worker={w} imageUrl={w.profession_node_id ? feed.images[w.profession_node_id] : null} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center">
          <p className="text-lg font-bold">{t("welcome.market.workers_empty")}</p>
          <div className="mt-4 flex justify-center">
            <ModeButton mode="worker" next="/post/worker" track="post_worker" className={btnPrimary}>
              {t("welcome.market.workers_post")}
            </ModeButton>
          </div>
        </div>
      )}
    </section>
  );
}

/** Qanday ishlaydi: ikki auditoriya uchun alohida kartalar — qadamlar mavjud oqimga mos */
export async function HowItWorks() {
  const { t } = await getT();
  const cols = [
    {
      key: "seek",
      title: t("welcome.market.how_seek"),
      steps: [1, 2, 3].map((i) => t(`welcome.market.how_seek_${i}`)),
      cta: (
        <ModeButton mode="worker" next={findHref(EMPTY_FIND, { mode: "jobs" })} track="how_seek" className={btnPrimary}>
          {t("welcome.market.how_seek_cta")} <ArrowRight className="size-5" aria-hidden />
        </ModeButton>
      ),
    },
    {
      key: "hire",
      title: t("welcome.market.how_hire"),
      steps: [1, 2, 3].map((i) => t(`welcome.market.how_hire_${i}`)),
      cta: (
        <ModeButton mode="employer" next="/post/vacancy" track="how_hire" className={btnOutline}>
          {t("welcome.market.how_hire_cta")} <ArrowRight className="size-5" aria-hidden />
        </ModeButton>
      ),
    },
  ];
  return (
    <section aria-labelledby="home-how" className="container-app py-8 sm:py-10">
      <SectionHead id="home-how" title={t("welcome.market.how_title")} />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {cols.map((c) => (
          <div key={c.key} className="flex flex-col rounded-2xl border border-border bg-card p-5 sm:p-6">
            <h3 className="text-lg font-bold">{c.title}</h3>
            <ol className="mt-4 flex-1 space-y-3">
              {c.steps.map((s, i) => (
                <li key={s} className="flex items-start gap-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-extrabold text-primary" aria-hidden>
                    {i + 1}
                  </span>
                  <span className="pt-1 text-base font-medium leading-snug">{s}</span>
                </li>
              ))}
            </ol>
            <div className="mt-5">{c.cta}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Nega Ish topdim: to'rt tamoyil — va'dalar emas, mavjud imkoniyatlar (sohalar soni — ma'lumotnomadan) */
export async function WhyUs() {
  const [{ t }, categories] = await Promise.all([getT(), getCategories()]);
  const items: { icon: LucideIcon; title: string; desc: string }[] = [
    { icon: LayoutGrid, title: t("welcome.market.why_all"), desc: t("welcome.market.why_all_desc", { count: categories.length }) },
    { icon: Zap, title: t("welcome.market.why_fast"), desc: t("welcome.market.why_fast_desc") },
    { icon: MousePointerClick, title: t("welcome.market.why_simple"), desc: t("welcome.market.why_simple_desc") },
    { icon: ShieldCheck, title: t("welcome.market.why_trust"), desc: t("welcome.market.why_trust_desc") },
  ];
  return (
    <section aria-labelledby="home-why" className="container-app py-8 sm:py-10">
      <SectionHead id="home-why" title={t("welcome.market.why_title")} />
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((it) => (
          <li key={it.title} className="rounded-2xl border border-border bg-card p-5">
            <span className="flex size-11 items-center justify-center rounded-xl bg-primary-soft text-primary" aria-hidden>
              <it.icon className="size-5" />
            </span>
            <h3 className="mt-3 text-lg font-bold leading-tight">{it.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{it.desc}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Raqamlar: faqat bazadan (keshlangan) va har birining ta'rifi bilan. 0 yoki noma'lum ko'rsatkich chiqmaydi; birorta ham
 * bo'lmasa — o'rniga maqsad matni (soxta "10 000+" yo'q).
 */
export async function MarketStats({ stats, counts }: { stats: EntryStats | null; counts: MarketCounts | null }) {
  const { t } = await getT();
  const rows = [
    { key: "vacancies", value: stats?.vacancies ?? 0 },
    { key: "employers", value: counts?.employers ?? 0 },
    { key: "workers", value: stats?.workers ?? 0 },
    { key: "today", value: stats?.today ?? 0 },
  ].filter((r) => r.value > 0);
  if (!rows.length) {
    return (
      <section aria-labelledby="home-mission" className="container-app py-8 sm:py-10">
        <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
          <h2 id="home-mission" className="text-2xl font-extrabold tracking-tight">
            {t("welcome.market.mission_title")}
          </h2>
          <p className="mt-2 max-w-3xl text-base leading-relaxed text-muted-foreground">{t("welcome.market.mission_text")}</p>
        </div>
      </section>
    );
  }
  return (
    <section aria-labelledby="home-stats" className="container-app py-8 sm:py-10">
      <SectionHead id="home-stats" title={t("welcome.market.stats_title")} subtitle={t("welcome.market.stats_note")} />
      <dl className={cn("grid gap-3", rows.length >= 4 ? "grid-cols-2 lg:grid-cols-4" : rows.length === 3 ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-1 sm:grid-cols-2")}>
        {rows.map((r) => (
          <div key={r.key} className="rounded-2xl border border-border bg-card p-4 sm:p-5">
            <dt className="text-sm font-bold text-foreground">{t(`welcome.market.stat_${r.key}`)}</dt>
            <dd className="mt-1">
              <span className="block text-3xl font-extrabold tracking-tight text-primary tabular">{num(r.value)}</span>
              <span className="mt-1 block text-xs leading-snug text-muted-foreground sm:text-sm">{t(`welcome.market.stat_${r.key}_def`)}</span>
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 max-w-3xl text-sm leading-relaxed text-muted-foreground">{t("welcome.market.mission_text")}</p>
    </section>
  );
}
