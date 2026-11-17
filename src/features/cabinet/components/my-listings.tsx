import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRight, Pencil, UsersRound } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { formatDate } from "@/lib/format";
import { isCityRegion } from "@/lib/geo/city";
import { Button } from "@/components/ui/button";
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

/** kichik amal tugmalari — bir qatorda (sig'masa keyingi qatorga o'tadi) */
const CHIP = "h-10 gap-1.5 rounded-xl px-3 text-sm font-semibold";
const CARD = "space-y-2.5 rounded-2xl border border-border/70 bg-card p-4 shadow-sm";
const GROUP = "px-1 text-sm font-semibold text-muted-foreground";

/** kartaning bosh qismi — e'lonning o'zini ochadi (alohida "Ko'rish" tugmasi o'rniga) */
function TitleLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="press -m-1 flex items-center gap-2 rounded-xl p-1 hover:bg-secondary/60" data-my-listing-open>
      <span className="min-w-0 flex-1">{children}</span>
      <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  );
}

/**
 * O'z e'lonlari va ularning haqiqiy holati (joylandi, tekshiruvda, rad etilgan, to'xtatilgan…), amallar bilan.
 * Profildagi "Mening e'lonlarim" bo'limi va alohida "E'lonlarim" sahifasi (/cabinet/elonlar, bosh sahifadan) — bir xil.
 * Ixcham (ega, 2026-11-17: "e'lonlarimdagi juda katta, tushunarsiz — tartibga keltir, soddalashtir"): har e'lon — kichik karta:
 * nomi va joyi (bosilsa — e'lonning o'zi, "›"), holati va bir qatorda kichik tugmalar (O'zgartirish · Topdim; vakansiyada —
 * Arizalar). Xabarnoma
 * obunasi va "mos ishlar" tugmalari bu yerda yo'q — Profil → "Telegram xabarnomalari", bosh sahifa → "Sizga mos ishlar".
 */
export async function MyListingsSection({
  worker,
  vacancies,
  paid,
  masters,
}: {
  worker: MyWorkerListing | null;
  vacancies: MyVacancy[];
  paid: boolean;
  /** usta e'lonlari — faqat "E'lonlarim" sahifasida */
  masters?: MyMasterListing[];
}) {
  const { t, name, locale } = await getT();
  return (
    <section className="space-y-5" aria-label={t("easy.cabinet.my_listings")} data-my-listings>
      {!worker && !vacancies.length && !masters?.length ? (
        <p className="rounded-2xl bg-secondary p-4 text-base text-muted-foreground" data-my-listings-empty>
          {t("easy.cabinet.no_listings")}
        </p>
      ) : null}

      {worker ? (
        <div className="space-y-2">
          <h2 className={GROUP}>{t("easy.cabinet.group_self")}</h2>
          <article className={CARD} data-my-listing="worker">
            <TitleLink href={`/listing/${worker.id}`}>
              <h3 className="text-lg font-bold leading-tight">{worker.headline || "—"}</h3>
              {worker.regionName ? (
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {[name(worker.regionName), worker.districtName ? name(worker.districtName) : t(isCityRegion({ slug: worker.regionSlug, name_uz: worker.regionName?.name_uz }) ? "easy.card.city_wide" : "easy.card.region_wide")].join(" · ")}
                </p>
              ) : null}
            </TitleLink>
            <StatusPill size="sm" tone={stateTone(worker.moderation.state)}>
              {worker.moderation.state === "listed"
                ? worker.listedUntil && paid
                  ? t("easy.cabinet.status.listed_until", { date: formatDate(worker.listedUntil, locale) })
                  : t("easy.cabinet.status.listed")
                : ["moderation_pending", "review", "rejected", "payment_required"].includes(worker.moderation.state)
                  ? t(`easy.cabinet.status.${worker.moderation.state}`)
                  : t("easy.cabinet.status.stopped")}
            </StatusPill>
            <ModerationNotice entity="worker" id={worker.id} info={worker.moderation} editHref="/post/worker?step=3" />
            <div className="flex flex-wrap gap-2">
              {worker.status === "payment_required" ? <PayButton compact purpose="worker_listing" targetId={worker.id} /> : null}
              <Button asChild variant="outline" className={CHIP}>
                <Link href={worker.status === "stopped" ? "/post/worker?step=4" : "/post/worker"}>
                  <Pencil className="size-4" aria-hidden /> {worker.status === "stopped" ? t("easy.cabinet.republish") : t("easy.cabinet.edit_short")}
                </Link>
              </Button>
              {worker.status === "listed" ? <FoundButton compact kind="job" /> : null}
            </div>
          </article>
        </div>
      ) : null}

      {vacancies.length ? (
        <div className="space-y-2">
          <h2 className={GROUP}>{t("easy.cabinet.group_vacancies")}</h2>
          {vacancies.map((v) => {
            const editable = v.status !== "hidden";
            const open = v.status === "active" || v.status === "paused" || v.status === "pending_review";
            const needsPay = paid && (v.status === "draft" || v.status === "expired");
            return (
              <article key={v.id} className={CARD} data-my-listing="vacancy">
                <TitleLink href={`/employer/vacancies/${v.id}`}>
                  <h3 className="text-lg font-bold leading-tight">{v.title}</h3>
                  {v.regionName ? (
                    <p className="mt-0.5 text-sm text-muted-foreground">{name(v.regionName)}</p>
                  ) : v.isRemote ? (
                    <p className="mt-0.5 text-sm text-muted-foreground">{t("easy.location.remote")}</p>
                  ) : null}
                </TitleLink>
                <StatusPill size="sm" tone={["moderation_pending", "review", "rejected", "verification_pending"].includes(v.moderation.state) ? stateTone(v.moderation.state) : vacancyTone(v.status)}>
                  {v.status === "active" && v.expiresAt
                    ? t("easy.cabinet.status.active_until", { date: formatDate(v.expiresAt, locale) })
                    : ["moderation_pending", "review", "rejected", "verification_pending", "payment_required"].includes(v.moderation.state)
                      ? t(`easy.cabinet.status.${v.moderation.state}`)
                      : t(`easy.cabinet.status.${v.status}`)}
                </StatusPill>
                <ModerationNotice entity="vacancy" id={v.id} info={v.moderation} editHref={`/post/vacancy?edit=${v.id}`} />
                <div className="flex flex-wrap gap-2">
                  {v.applications.total ? (
                    <Button asChild className={CHIP}>
                      <Link href={`/employer/vacancies/${v.id}/applications`} data-my-listing-apps>
                        <UsersRound className="size-4" aria-hidden /> {t("easy.cabinet.applications", { count: v.applications.total })}
                        {v.applications.fresh ? <span className="rounded-md bg-primary-foreground/15 px-1.5 text-xs font-bold">{t("easy.cabinet.applications_new", { count: v.applications.fresh })}</span> : null}
                      </Link>
                    </Button>
                  ) : null}
                  {needsPay ? <PayButton compact purpose="vacancy_publish" targetId={v.id} /> : null}
                  {editable ? (
                    <Button asChild variant="outline" className={CHIP}>
                      <Link href={`/post/vacancy?edit=${v.id}`}>
                        <Pencil className="size-4" aria-hidden /> {t("easy.cabinet.edit_short")}
                      </Link>
                    </Button>
                  ) : null}
                  {open ? <FoundButton compact kind="worker" vacancyId={v.id} /> : null}
                </div>
              </article>
            );
          })}
        </div>
      ) : null}

      {/* Universal ustalar e'lonlari (faqat "E'lonlarim" sahifasida): holati va usta kabinetiga havola */}
      {masters?.length ? (
        <div className="space-y-2" data-my-masters>
          <h2 className={GROUP}>{t("easy.cabinet.master_listings")}</h2>
          {masters.map((m) => (
            <article key={m.id} data-my-master={m.id} className={CARD}>
              <TitleLink href="/ustalar/kabinet">
                <h3 className="text-lg font-bold leading-tight">{m.title}</h3>
              </TitleLink>
              <StatusPill size="sm" tone={m.status === "active" ? "ok" : m.status === "pending_review" || m.status === "rejected" ? "wait" : "off"}>
                {t(`masters.status.${m.status}`)}
              </StatusPill>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
