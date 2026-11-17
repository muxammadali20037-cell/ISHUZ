import Link from "next/link";
import { ExternalLink, Pencil, Search, UsersRound, Wrench } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { formatDate } from "@/lib/format";
import { isCityRegion } from "@/lib/geo/city";
import { Button } from "@/components/ui/button";
import { AlertToggle } from "@/features/alerts/components/alert-toggle";
import type { getAlertSubscriptions } from "@/features/alerts/queries";
import type { ListingState } from "@/features/post/types";
import type { MyMasterListing } from "@/features/masters/types";
import type { MyVacancy, MyWorkerListing } from "../queries";
import { FoundButton, PayButton } from "./listing-actions";
import { ModerationNotice } from "./moderation-notice";
import { StatusPill } from "./status-pill";

/** Haqiqiy holat → ko'rinish (faqat ommaga chiqqan e'lon "joylandi") */
function stateTone(s: ListingState): "ok" | "wait" | "off" {
  return s === "listed" || s === "active" ? "ok" : s === "moderation_pending" || s === "review" || s === "verification_pending" || s === "payment_required" || s === "rejected" ? "wait" : "off";
}

function vacancyTone(s: MyVacancy["status"]): "ok" | "wait" | "off" {
  return s === "active" ? "ok" : s === "pending_review" || s === "draft" ? "wait" : "off";
}

/**
 * O'z e'lonlari va ularning haqiqiy holati (joylandi, tekshiruvda, rad etilgan, to'xtatilgan…), amallar bilan.
 * Profildagi "Mening e'lonlarim" bo'limi va alohida "E'lonlarim" sahifasi (/cabinet/elonlar, bosh sahifadan) — bir xil.
 */
export async function MyListingsSection({
  worker,
  vacancies,
  paid,
  alerts,
  masters,
}: {
  worker: MyWorkerListing | null;
  vacancies: MyVacancy[];
  paid: boolean;
  alerts: Awaited<ReturnType<typeof getAlertSubscriptions>>;
  /** usta e'lonlari — faqat "E'lonlarim" sahifasida */
  masters?: MyMasterListing[];
}) {
  const { t, name, locale } = await getT();
  const workerSearch = worker
    ? `/search?${new URLSearchParams({ mode: "jobs", ...(worker.professionNodeId ? { p: worker.professionNodeId } : {}), ...(worker.regionSlug ? { region: worker.regionSlug, district: worker.districtId ?? "all" } : {}) }).toString()}`
    : null;
  return (
    <section className="space-y-3" aria-label={t("easy.cabinet.my_listings")}>
      {!worker && !vacancies.length && !masters?.length ? <p className="rounded-2xl bg-secondary p-4 text-muted-foreground" data-my-listings-empty>{t("easy.cabinet.no_listings")}</p> : null}

      {worker ? (
        <article className="space-y-3 rounded-2xl border border-border bg-card p-5">
          <p className="text-base font-bold uppercase tracking-wide text-primary-ink">{t("easy.cabinet.worker_listing")}</p>
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
          <p className="pt-2 text-base font-bold uppercase tracking-wide text-primary-ink">{t("easy.cabinet.vacancies")}</p>
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

      {/* Universal ustalar e'lonlari (faqat "E'lonlarim" sahifasida): holati va usta kabinetiga havola */}
      {masters?.length ? (
        <div className="space-y-3" data-my-masters>
          <p className="pt-2 text-base font-bold uppercase tracking-wide text-primary-ink">{t("easy.cabinet.master_listings")}</p>
          {masters.map((m) => (
            <article key={m.id} data-my-master={m.id} className="space-y-3 rounded-2xl border border-border bg-card p-5">
              <h3 className="text-xl font-bold">{m.title}</h3>
              <StatusPill tone={m.status === "active" ? "ok" : m.status === "pending_review" || m.status === "rejected" ? "wait" : "off"}>{t(`masters.status.${m.status}`)}</StatusPill>
              <Button asChild variant="outline" className="h-auto min-h-12 max-w-full whitespace-normal px-4 py-2 text-base">
                <Link href="/ustalar/kabinet">
                  <Wrench className="size-5" aria-hidden /> {t("easy.cabinet.master_manage")}
                </Link>
              </Button>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
