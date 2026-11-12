import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight, BellRing, Building2, ChevronRight, UsersRound } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import type { SessionContext } from "@/features/auth/session";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { WorkerResultCard } from "@/features/find/components/result-cards";
import { RetryButton } from "@/features/find/components/find-client";
import { savedIdSet } from "@/features/saved/queries";
import { EmployerDashboard } from "@/features/employer/components/dashboard/employer-dashboard";
import { getHomePlace, getNewWorkers, type HomePlace } from "./home-queries";
import { EmployerHead } from "./employer-head";
import { AiEntry } from "@/features/ai/components/ai-entry";

/**
 * Ish beruvchi bosh sahifasi — 2.0 (2026-11-11, egasi: "ish beruvchilar panelini ham soddalashtir"). Profili tayyor ish beruvchi —
 * panel (employer-dashboard.tsx, xuddi shu bosh qism bilan). Mehmon yoki profil hali yo'q:
 *  1) bitta savol "Qanday xodim kerak?" va BITTA qidiruv maydoni (AI: o'z so'zi bilan — bazadagi nomzodlardan topadi);
 *  2) 4 ta tez yo'l: kunlik ishchi, yaqin atrofda, tajribali, masofaviy; "Barcha nomzodlar";
 *  3) asosiy amal — "Vakansiya joylash" (ish beruvchining asl maqsadi);
 *  4) yangi nomzodlar ro'yxati; kompyuterda o'ngda — "Mos nomzod chiqsa xabar".
 * Olib tashlandi: fon surati, 4 ta plitka, bo'limlar ro'yxati, admin oynalari, AI PRO kartasi — bir ekranda bitta vazifa.
 * Rejim faqat ko'rinishni tanlaydi: ruxsatlar serverda (requireEmployer, RLS) — rejim o'zgarsa ham kengaymaydi.
 */
export async function EmployerHome({ session, flush = false }: { session: SessionContext | null; flush?: boolean }) {
  // panel — /employer bilan bir xil shart (requireEmployer): profil bor va to'ldirilgan
  if (session?.employerId && session.employerOnboarded) return <EmployerDashboard session={session as SessionContext & { employerId: string }} embedded />;
  const [{ t }, place] = await Promise.all([getT(), getHomePlace()]);
  const firstName = session?.profile.first_name?.trim();
  return (
    <div className="flex flex-col gap-6">
      <EmployerHead flush={flush} greeting={firstName ? t("easy.home2.e_greeting", { name: firstName }) : t("easy.services.greeting_guest")} place={place} postHref="/post/vacancy" />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] xl:grid-cols-[minmax(0,1fr)_20rem] 3xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-5">
          {session ? (
            // kirgan, lekin ish beruvchi profili yo'q: bir daqiqalik to'ldirish (arizalar va vakansiyalar shundan keyin)
            <Link href="/onboarding/employer" className="press flex min-h-16 items-center gap-3 rounded-xl border border-primary/40 bg-primary-soft/40 px-4 py-3 hover:border-primary">
              <Building2 className="size-5 shrink-0 text-primary-ink" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block font-bold">{t("easy.start.finish_company_title")}</span>
                <span className="block text-sm leading-snug text-muted-foreground">{t("easy.start.finish_company_desc")}</span>
              </span>
              <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          ) : null}
          <Suspense fallback={<WorkersSkeleton />}>
            <NewWorkers session={session} place={place} />
          </Suspense>
        </div>
        <aside aria-label={t("easy.start.more_title")} className="min-w-0 space-y-3">
          {/* "AI yordamchi" — suhbat oynasi (/ai): nomzod topish, vakansiya matni, suhbat savollari */}
          <AiEntry title={t("easy.aiws.nav.ai")} desc={t("easy.aiws.entry_desc_employer")} />
          <EmployerAlertCard />
        </aside>
      </div>
    </div>
  );
}

/** "Mos nomzod chiqsa — Telegram'da xabar": o'z so'zi bilan kuzatuv (AI) */
async function EmployerAlertCard() {
  const { t } = await getT();
  return (
    <Link href="/ai-alerts?role=employer" className="press flex min-h-16 items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 hover:border-primary/40">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-ink" aria-hidden>
        <BellRing className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-bold">{t("easy.home2.e_alert_title")}</span>
        <span className="block text-sm leading-snug text-muted-foreground">{t("easy.home2.e_alert_desc")}</span>
      </span>
      <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  );
}

async function NewWorkers({ session, place }: { session: SessionContext | null; place: HomePlace }) {
  const [{ t, name }, feed] = await Promise.all([getT(), getNewWorkers(place)]);
  if (!feed.ok) {
    return (
      <section role="alert" aria-labelledby="home-feed" className="space-y-3 rounded-xl border border-warning/40 bg-warning-soft p-5 text-center">
        <h2 id="home-feed" className="text-xl font-bold">
          {t("easy.start.list_error_title")}
        </h2>
        <p className="text-muted-foreground">{t("easy.start.list_error_desc")}</p>
        <div className="mx-auto grid max-w-sm">
          <RetryButton label={t("easy.search.retry")} />
        </div>
        <p className="text-sm text-muted-foreground">{t("easy.search.error_code", { code: feed.errorId })}</p>
      </section>
    );
  }
  const saved = await savedIdSet(session, "worker", feed.items.map((i) => i.id));
  const more = feed.total > feed.items.length;
  return (
    <section aria-labelledby="home-feed">
      <div className="flex items-center justify-between gap-3">
        <h2 id="home-feed" className="min-w-0 text-lg font-bold leading-tight">
          {t("easy.start.new_workers_title")}
        </h2>
        {more ? (
          <Link href={feed.allHref} className="-my-2 inline-flex min-h-11 shrink-0 items-center gap-1 text-base font-semibold text-primary-ink hover:underline">
            {t("easy.start.see_all")} <ChevronRight className="size-4" aria-hidden />
          </Link>
        ) : null}
      </div>
      <p className="mt-0.5 text-sm text-muted-foreground">{t("easy.start.new_reason", { place: feed.region ? name(feed.region) : t("easy.location.whole_country") })}</p>
      {feed.items.length ? (
        <ul className="pop-list mt-3 grid grid-cols-1 gap-3 2xl:grid-cols-2 4xl:grid-cols-3">
          {feed.items.map((w) => (
            <li key={w.id}>
              <WorkerResultCard worker={w} imageUrl={w.profession_node_id ? feed.images[w.profession_node_id] : null} saved={saved.has(w.id)} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-3 rounded-xl border border-border bg-card p-6 text-center">
          <UsersRound className="mx-auto size-8 text-muted-foreground" aria-hidden />
          <p className="mt-2 text-lg font-bold">{t("easy.start.workers_empty_title")}</p>
          <p className="mt-1 text-muted-foreground">{t("easy.start.workers_empty_desc")}</p>
        </div>
      )}
      {more ? (
        <Button asChild variant="outline" className="mt-3 h-12 w-full text-base font-semibold">
          <Link href={feed.allHref}>
            {t("easy.start.all_workers", { count: feed.total >= 5000 ? "5 000+" : feed.total })} <ArrowRight className="size-5" aria-hidden />
          </Link>
        </Button>
      ) : null}
    </section>
  );
}

function WorkersSkeleton() {
  return (
    <div aria-hidden className="space-y-3">
      <Skeleton className="h-6 w-44" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-xl border border-border bg-card p-3 sm:p-4">
          <div className="flex gap-3">
            <Skeleton className="size-12 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </div>
          <Skeleton className="mt-3 h-11 w-36 rounded-xl" />
        </div>
      ))}
    </div>
  );
}
