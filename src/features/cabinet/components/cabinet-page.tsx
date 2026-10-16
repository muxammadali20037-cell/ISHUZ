import Link from "next/link";
import { Suspense } from "react";
import { Bell, BellRing, Bookmark, BriefcaseBusiness, ChevronRight, ExternalLink, FileText, Handshake, LogIn, LogOut, MessageCircle, Pencil, Search, Settings, ShieldCheck, Sparkles, UserRound, UsersRound, Wallet } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { formatDate } from "@/lib/format";
import type { SessionContext } from "@/features/auth/session";
import { signOut } from "@/features/auth/actions";
import { Button } from "@/components/ui/button";
import { getMyListings, type MyVacancy } from "../queries";
import { FoundButton, PayButton } from "./listing-actions";
import { ModerationNotice } from "./moderation-notice";
import { AlertToggle } from "@/features/alerts/components/alert-toggle";
import { getAlertSubscriptions } from "@/features/alerts/queries";
import { AiProCard } from "@/features/ai-alerts/components/ai-pro-card";
import type { ListingState } from "@/features/post/types";
import { StatusPill } from "./status-pill";
import { isCityRegion } from "@/lib/geo/city";
import type { AppMode } from "@/features/mode/mode";
import { ModeSwitch } from "@/features/mode/components/mode-switch";
import { ProfileHeader } from "./profile-header";

/** Haqiqiy holat → ko'rinish (faqat ommaga chiqqan e'lon "joylandi") */
function stateTone(s: ListingState): "ok" | "wait" | "off" {
  return s === "listed" || s === "active" ? "ok" : s === "moderation_pending" || s === "review" || s === "verification_pending" || s === "payment_required" || s === "rejected" ? "wait" : "off";
}

function vacancyTone(s: MyVacancy["status"]): "ok" | "wait" | "off" {
  return s === "active" ? "ok" : s === "pending_review" || s === "draft" ? "wait" : "off";
}

/** Kabinetim: e'lonlarim (o'zgartirish, topdim), yangi e'lon va boshqa bo'limlar — hammasi bir joyda, ixcham */
export async function CabinetPage({ session, mode }: { session: SessionContext | null; mode: AppMode | null }) {
  const { t, name, locale } = await getT();

  if (!session) {
    return (
      <div className="container-narrow space-y-5 py-8 text-lg">
        <h1 className="text-3xl font-extrabold">{t("easy.cabinet.title")}</h1>
        <div className="space-y-4 rounded-2xl border border-border bg-card p-6">
          <h2 className="text-2xl font-bold">{t("easy.cabinet.guest_title")}</h2>
          <p className="text-muted-foreground">{t("easy.cabinet.guest_desc")}</p>
          <Button asChild size="xl" className="h-14 w-full text-lg">
            <Link href="/auth?next=%2Fcabinet">
              <LogIn className="size-5" aria-hidden /> {t("easy.cabinet.login")}
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const [{ worker, vacancies, paid }, alerts] = await Promise.all([getMyListings(session), getAlertSubscriptions(session)]);
  // S3: guruhlangan menyu — faoliyat (arizalar, takliflar, saqlangan, xabarlar…) va hisob (profil, to'lovlar, sozlamalar)
  const links: { href: string; label: string; icon: typeof Bell; show: boolean; group: "activity" | "account" }[] = [
    { href: "/applications", label: t("easy.cabinet.links.applications"), icon: FileText, show: !!session.workerId, group: "activity" },
    { href: "/offers", label: t("easy.cabinet.links.offers"), icon: Handshake, show: !!session.workerId, group: "activity" },
    { href: "/employer/applications", label: t("easy.cabinet.links.employer_applications"), icon: UsersRound, show: !!session.employerOnboarded, group: "activity" },
    { href: "/saved", label: t("easy.cabinet.links.saved"), icon: Bookmark, show: true, group: "activity" },
    { href: "/messages", label: t("easy.cabinet.links.messages"), icon: MessageCircle, show: true, group: "activity" },
    { href: "/cabinet/matches", label: t("easy.cabinet.links.matches"), icon: Sparkles, show: !!(worker || vacancies.length), group: "activity" },
    { href: "/cabinet/alerts", label: t("easy.cabinet.links.alerts"), icon: BellRing, show: true, group: "activity" },
    { href: "/profile", label: t("easy.cabinet.links.profile"), icon: UserRound, show: !!(session.workerOnboarded || session.employerId), group: "account" },
    { href: "/cabinet/verification", label: t("easy.cabinet.links.verification"), icon: ShieldCheck, show: !!session.employerId || vacancies.length > 0, group: "account" },
    { href: "/notifications", label: t("easy.cabinet.links.notifications"), icon: Bell, show: true, group: "account" },
    { href: "/billing", label: t("easy.cabinet.links.billing"), icon: Wallet, show: true, group: "account" },
    { href: "/settings", label: t("easy.cabinet.links.settings"), icon: Settings, show: true, group: "account" },
  ];

  const newListings = [
    { mode: "worker", href: "/post/worker", icon: BriefcaseBusiness, label: t("easy.home.worker_cta") },
    { mode: "employer", href: "/post/vacancy", icon: UsersRound, label: t("easy.home.employer_cta") },
  ].filter((l) => !mode || l.mode === mode);

  const workerSearch = worker
    ? `/search?${new URLSearchParams({ mode: "jobs", ...(worker.professionNodeId ? { p: worker.professionNodeId } : {}), ...(worker.regionSlug ? { region: worker.regionSlug, district: worker.districtId ?? "all" } : {}) }).toString()}`
    : null;

  return (
    <div className="container-narrow space-y-6 py-6 text-lg sm:py-8">
      <h1 className="text-3xl font-extrabold">{t("easy.cabinet.title")}</h1>
      {/* S3: profil sarlavhasi — avatar, ism, rol, to'liqlik va faoliyat sonlari (haqiqiy) */}
      <Suspense fallback={<div className="h-44 animate-pulse rounded-2xl bg-secondary" aria-hidden />}>
        <ProfileHeader session={session} mode={mode} />
      </Suspense>
      {/* rejim shu yerda ham almashtiriladi (tasdiq bilan) — e'lon berish va bosh sahifa shu rejimda */}
      {mode ? <ModeSwitch mode={mode} className="mx-0 max-w-none" /> : null}

      <section className="space-y-3" aria-labelledby="my-listings">
        <h2 id="my-listings" className="text-2xl font-bold">
          {t("easy.cabinet.my_listings")}
        </h2>
        {!worker && !vacancies.length ? <p className="rounded-2xl bg-secondary p-4 text-muted-foreground">{t("easy.cabinet.no_listings")}</p> : null}

        {worker ? (
          <article className="space-y-3 rounded-2xl border border-border bg-card p-5">
            <p className="text-base font-bold uppercase tracking-wide text-primary">{t("easy.cabinet.worker_listing")}</p>
            <h3 className="text-xl font-bold">{worker.headline || "—"}</h3>
            {worker.regionName ? (
              <p className="text-muted-foreground">{[name(worker.regionName), worker.districtName ? name(worker.districtName) : t(isCityRegion({ slug: worker.regionSlug, name_uz: worker.regionName?.name_uz }) ? "easy.card.city_wide" : "easy.card.region_wide")].join(" · ")}</p>
            ) : null}
            <StatusPill tone={stateTone(worker.moderation.state)}>
              {worker.moderation.state === "listed"
                ? worker.listedUntil && paid
                  ? t("easy.cabinet.status.listed_until", { date: formatDate(worker.listedUntil, locale) })
                  : t("easy.cabinet.status.listed")
                : ["moderation_pending", "review", "rejected", "payment_required"].includes(worker.moderation.state)
                  ? t(`easy.cabinet.status.${worker.moderation.state}`)
                  : t("easy.cabinet.status.stopped")}
            </StatusPill>
            <ModerationNotice entity="worker" id={worker.id} info={worker.moderation} editHref="/post/worker?step=3" />
            <div className="flex flex-wrap gap-2 pt-1">
              {worker.status === "payment_required" ? <PayButton purpose="worker_listing" targetId={worker.id} /> : null}
              {worker.status === "listed" ? <FoundButton kind="job" /> : null}
              <Button asChild variant="outline" className="h-auto min-h-12 max-w-full whitespace-normal px-4 py-2 text-base">
                <Link href={worker.status === "stopped" ? "/post/worker?step=4" : "/post/worker"}>
                  <Pencil className="size-5" aria-hidden /> {worker.status === "stopped" ? t("easy.cabinet.republish") : t("easy.cabinet.edit")}
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-auto min-h-12 max-w-full whitespace-normal px-4 py-2 text-base">
                <Link href={`/listing/${worker.id}`}>
                  <ExternalLink className="size-5" aria-hidden /> {t("easy.cabinet.view")}
                </Link>
              </Button>
              {workerSearch ? (
                <Button asChild variant="soft" className="h-auto min-h-12 max-w-full whitespace-normal px-4 py-2 text-base">
                  <Link href={worker.moderation.state === "listed" ? "/cabinet/matches" : workerSearch}>
                    <Search className="size-5" aria-hidden /> {t("easy.cabinet.matches_jobs")}
                  </Link>
                </Button>
              ) : null}
            </div>
            <AlertToggle role="worker" initialStatus={alerts.subs.worker.status} defaults={{ professionNodeId: worker.professionNodeId, regionId: null }} compact />
          </article>
        ) : null}

        {vacancies.length ? (
          <div className="space-y-3">
            <p className="pt-2 text-base font-bold uppercase tracking-wide text-primary">{t("easy.cabinet.vacancies")}</p>
            {vacancies.map((v) => {
              const editable = v.status !== "hidden";
              const open = v.status === "active" || v.status === "paused" || v.status === "pending_review";
              const needsPay = paid && (v.status === "draft" || v.status === "expired");
              return (
                <article key={v.id} className="space-y-3 rounded-2xl border border-border bg-card p-5">
                  <h3 className="text-xl font-bold">{v.title}</h3>
                  {v.regionName ? <p className="text-muted-foreground">{name(v.regionName)}</p> : v.isRemote ? <p className="text-muted-foreground">{t("easy.location.remote")}</p> : null}
                  <StatusPill tone={["moderation_pending", "review", "rejected", "verification_pending"].includes(v.moderation.state) ? stateTone(v.moderation.state) : vacancyTone(v.status)}>
                    {v.status === "active" && v.expiresAt
                      ? t("easy.cabinet.status.active_until", { date: formatDate(v.expiresAt, locale) })
                      : ["moderation_pending", "review", "rejected", "verification_pending", "payment_required"].includes(v.moderation.state)
                        ? t(`easy.cabinet.status.${v.moderation.state}`)
                        : t(`easy.cabinet.status.${v.status}`)}
                  </StatusPill>
                  <ModerationNotice entity="vacancy" id={v.id} info={v.moderation} editHref={`/post/vacancy?edit=${v.id}`} />
                  {v.applications.total ? (
                    <Button asChild size="xl" className="h-12 w-full justify-between px-4 text-base sm:w-auto">
                      <Link href={`/employer/vacancies/${v.id}/applications`}>
                        <span className="inline-flex items-center gap-2">
                          <UsersRound className="size-5" aria-hidden /> {t("easy.cabinet.applications", { count: v.applications.total })}
                        </span>
                        {v.applications.fresh ? (
                          <span className="rounded-lg bg-primary-foreground/15 px-2 py-0.5 text-sm font-semibold">{t("easy.cabinet.applications_new", { count: v.applications.fresh })}</span>
                        ) : null}
                      </Link>
                    </Button>
                  ) : null}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {needsPay ? <PayButton purpose="vacancy_publish" targetId={v.id} /> : null}
                    {open ? <FoundButton kind="worker" vacancyId={v.id} /> : null}
                    {editable ? (
                      <Button asChild variant="outline" className="h-auto min-h-12 max-w-full whitespace-normal px-4 py-2 text-base">
                        <Link href={`/post/vacancy?edit=${v.id}`}>
                          <Pencil className="size-5" aria-hidden /> {t("easy.cabinet.edit")}
                        </Link>
                      </Button>
                    ) : null}
                    <Button asChild variant="outline" className="h-auto min-h-12 max-w-full whitespace-normal px-4 py-2 text-base">
                      <Link href={`/employer/vacancies/${v.id}`}>
                        <ExternalLink className="size-5" aria-hidden /> {t("easy.cabinet.view")}
                      </Link>
                    </Button>
                    {v.status === "active" ? (
                      <Button asChild variant="soft" className="h-auto min-h-12 max-w-full whitespace-normal px-4 py-2 text-base">
                        <Link href={`/cabinet/matches?vacancy=${v.id}`} prefetch={false}>
                          <Search className="size-5" aria-hidden /> {t("easy.cabinet.matches_workers")}
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                </article>
              );
            })}
            <AlertToggle role="employer" initialStatus={alerts.subs.employer.status} compact />
          </div>
        ) : null}
      </section>

      <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-secondary" aria-hidden />}>
        <AiProCard userId={session.userId} only={mode} />
      </Suspense>

      <section className="space-y-3" aria-labelledby="new-listing">
        <h2 id="new-listing" className="text-2xl font-bold">
          {t("easy.cabinet.new_listing")}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {/* joriy rejimning e'loni (rejim tanlanmagan bo'lsa — ikkalasi, bir xil neytral ko'rinish) */}
          {newListings.map((l) => (
            <Link key={l.href} href={l.href} className="press flex min-h-14 items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 font-semibold hover:border-primary/50">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary" aria-hidden>
                <l.icon className="size-5" />
              </span>
              {l.label}
            </Link>
          ))}
        </div>
      </section>

      {(["activity", "account"] as const).map((group) => (
        <section key={group} className="space-y-2" aria-labelledby={`links-${group}`}>
          <h2 id={`links-${group}`} className="text-xl font-bold">
            {group === "activity" ? t("easy.cabinet.header.activity") : t("easy.cabinet.account")}
          </h2>
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            {links
              .filter((l) => l.show && l.group === group)
              .map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="flex min-h-14 items-center gap-3 px-4 py-3 font-medium hover:bg-secondary/60">
                    <l.icon className="size-6 shrink-0 text-primary" aria-hidden />
                    <span className="flex-1">{l.label}</span>
                    <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
                  </Link>
                </li>
              ))}
            {group === "account" ? (
              <li>
                <form action={signOut}>
                  <button type="submit" className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left font-medium text-destructive hover:bg-destructive-soft/50">
                    <LogOut className="size-6 shrink-0" aria-hidden />
                    <span className="flex-1">{t("easy.cabinet.links.logout")}</span>
                  </button>
                </form>
              </li>
            ) : null}
          </ul>
        </section>
      ))}
    </div>
  );
}
