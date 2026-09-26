import Link from "next/link";
import { ArrowUpRight, MessageCircle, Briefcase, UserX, Clock, CalendarClock, Eye, Check, X, Undo2, AlertTriangle, PartyPopper } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { formatDate, formatRelative, initials, shortName } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { PageHeader, SectionHeader, InfoRow } from "@/components/ui/misc";
import { SalaryText } from "@/components/shared/salary-text";
import { ContactCard } from "@/features/contacts/contact-card";
import { ReviewSheet } from "@/features/applications/components/review-sheet";
import { ReviewCard } from "@/features/applications/components/review-card";
import { TONE_BANNER } from "@/features/applications/components/tone";
import { isOfferExpired, isOfferPending, OFFER_STATUS_TONE, offerTitle, type OfferDetail } from "../types";
import { OfferStatusBadge } from "./offer-status-badge";
import { WithdrawOfferButton } from "./withdraw-offer-button";
import { MarkHiredButton } from "./mark-hired-button";

/** /offers/[id] — ish beruvchi ko'rinishi */
export async function OfferDetailEmployer({ offer, userId }: { offer: OfferDetail; userId: string }) {
  const { t, tEnum, locale } = await getT();
  const c = offer.candidate;
  const name = c ? shortName(c.first_name, c.last_initial) : t("offers.detail.worker_hidden");
  const title = offerTitle(offer);
  const expired = isOfferExpired(offer) || offer.status === "expired";
  const pending = isOfferPending(offer.status) && !expired;
  const tone = expired ? "muted" : OFFER_STATUS_TONE[offer.status];
  const isSender = offer.employer_profile_id === userId;

  const statusLine = offer.hired_at
    ? { icon: PartyPopper, text: t("offers.detail.employer_hired"), cls: "text-success" }
    : expired
      ? { icon: AlertTriangle, text: t("offers.detail.employer_expired"), cls: "text-muted-foreground" }
      : offer.status === "accepted"
        ? { icon: Check, text: t("offers.detail.employer_accepted"), cls: "text-success" }
        : offer.status === "declined"
          ? { icon: X, text: t("offers.detail.employer_declined"), cls: "text-destructive" }
          : offer.status === "withdrawn"
            ? { icon: Undo2, text: t("offers.detail.employer_withdrawn"), cls: "text-muted-foreground" }
            : offer.status === "viewed"
              ? { icon: Eye, text: t("offers.detail.employer_viewed"), cls: "text-foreground" }
              : { icon: Clock, text: t("offers.detail.employer_pending"), cls: "text-foreground" };

  return (
    <div className="container-narrow py-4 sm:py-8">
      <PageHeader title={t("offers.meta.detail_title")} backHref="/offers" actions={<OfferStatusBadge status={expired && offer.status !== "expired" ? "expired" : offer.status} size="lg" />} />

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_320px] md:items-start">
        <div className="space-y-4">
          {/* Nomzod */}
          <section className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("offers.detail.to")}</p>
            <div className="flex items-start gap-3">
              {c ? <Avatar src={c.avatar_url} fallback={initials(c.first_name, c.last_initial)} size="xl" alt="" /> : <div className="flex size-20 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground"><UserX className="size-8" /></div>}
              <div className="min-w-0 flex-1">
                <h2 className={cn("text-xl font-bold leading-snug", !c && "text-muted-foreground")}>{name}</h2>
                {c?.headline ? <p className="mt-0.5 text-sm text-foreground/90">{c.headline}</p> : null}
                {c ? (
                  <p className="mt-1 inline-flex items-center gap-1 text-sm text-muted-foreground">
                    <Briefcase className="size-4" /> {tEnum("experience_level", c.experience_level)}
                  </p>
                ) : null}
              </div>
            </div>
            {c ? (
              <Button asChild variant="soft" size="sm" className="mt-3">
                <Link href={`/workers/${c.worker_id}`}>
                  {t("offers.detail.full_profile")} <ArrowUpRight className="size-4" />
                </Link>
              </Button>
            ) : null}
          </section>

          {/* Taklif */}
          <section className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
            <div className="space-y-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("offers.detail.position")}</p>
                <h3 className="text-lg font-bold leading-snug">{title}</h3>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("offers.detail.salary")}</p>
                <SalaryText from={offer.salary_from} to={offer.salary_to} className="text-base" />
              </div>
              {offer.vacancy_id ? (
                <Button asChild variant="outline" size="sm">
                  <Link href={`/employer/vacancies/${offer.vacancy_id}`}>
                    {t("offers.detail.vacancy")}: {offer.vacancy?.title ?? title} <ArrowUpRight className="size-4" />
                  </Link>
                </Button>
              ) : null}
            </div>
            <div className="mt-4 space-y-1 border-t border-border pt-3">
              <InfoRow icon={Clock}>{t("offers.detail.sent_at", { time: formatRelative(offer.created_at, locale) })}</InfoRow>
              {offer.expires_at ? <InfoRow icon={CalendarClock}>{t("offers.list.expires", { date: formatDate(offer.expires_at, locale) })}</InfoRow> : null}
              {offer.responded_at ? <InfoRow icon={Clock}>{t("offers.detail.responded_at", { time: formatRelative(offer.responded_at, locale) })}</InfoRow> : null}
              {offer.hired_at ? <InfoRow icon={PartyPopper}>{t("offers.detail.hired_at", { time: formatRelative(offer.hired_at, locale) })}</InfoRow> : null}
            </div>
            <div className="mt-4 border-t border-border pt-3">
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("offers.detail.message")}</p>
              {offer.message ? <p className="whitespace-pre-line text-sm leading-relaxed">{offer.message}</p> : <p className="text-sm text-muted-foreground">{t("offers.list.no_message")}</p>}
            </div>
          </section>

          {/* Holat */}
          <section className={cn("rounded-2xl border p-4", TONE_BANNER[tone])}>
            <p className={cn("inline-flex items-center gap-2 text-sm font-semibold", statusLine.cls)}>
              <statusLine.icon className="size-4" /> {statusLine.text}
            </p>
            {offer.status === "accepted" && !offer.hired_at ? (
              <div className="mt-3">
                <MarkHiredButton offerId={offer.id} vacancyId={offer.vacancy_id} fullWidth />
              </div>
            ) : null}
            {offer.hired_at && !offer.my_review ? (
              <div className="mt-3">
                <ReviewSheet source={{ kind: "offer", offerId: offer.id }} label={t("applications.review.rate_candidate")} variant="soft" fullWidth />
              </div>
            ) : null}
          </section>

          {offer.my_review ? <ReviewCard review={offer.my_review} /> : null}
        </div>

        <aside className="space-y-3 md:sticky md:top-20">
          <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
            <p className="mb-3 text-sm font-semibold">{t("applications.detail.actions")}</p>
            <div className="space-y-2">
              {offer.status === "accepted" ? (
                <Button asChild fullWidth>
                  <Link href={`/messages/new?offer_id=${offer.id}`}>
                    <MessageCircle className="size-4" /> {t("offers.detail.write")}
                  </Link>
                </Button>
              ) : null}
              {pending && isSender ? <WithdrawOfferButton offerId={offer.id} vacancyId={offer.vacancy_id} fullWidth /> : null}
              {!pending && offer.status !== "accepted" ? <p className="text-center text-xs text-muted-foreground">{t("applications.detail.closed_hint")}</p> : null}
            </div>
          </div>
          {c ? (
            <div>
              <SectionHeader title={t("offers.detail.contact")} className="mb-2" />
              <ContactCard profileId={c.profile_id} />
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
