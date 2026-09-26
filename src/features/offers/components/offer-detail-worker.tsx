import Link from "next/link";
import { ArrowUpRight, BadgeCheck, CalendarClock, MessageCircle, FileText, PartyPopper, AlertTriangle, Clock } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { formatDate, formatRelative, initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { PageHeader, SectionHeader, InfoRow } from "@/components/ui/misc";
import { SalaryText } from "@/components/shared/salary-text";
import { ContactCard } from "@/features/contacts/contact-card";
import { ReviewSheet } from "@/features/applications/components/review-sheet";
import { ReviewCard } from "@/features/applications/components/review-card";
import { TONE_BANNER } from "@/features/applications/components/tone";
import { isOfferExpired, isOfferPending, OFFER_STATUS_TONE, offerSenderName, offerTitle, type OfferDetail } from "../types";
import { OfferStatusBadge } from "./offer-status-badge";
import { OfferRespondActions } from "./offer-respond-actions";

/** /offers/[id] — ishchi ko'rinishi */
export async function OfferDetailWorker({ offer }: { offer: OfferDetail }) {
  const { t, locale } = await getT();
  const title = offerTitle(offer);
  const sender = offerSenderName(offer) || t("common.role.employer");
  const expired = isOfferExpired(offer) || offer.status === "expired";
  const pending = isOfferPending(offer.status) && !expired;
  const tone = expired ? "muted" : OFFER_STATUS_TONE[offer.status];
  const avatarSrc = offer.company?.logo_url ?? offer.employer?.avatar_url ?? null;
  const fallback = offer.company ? offer.company.name.slice(0, 2) : initials(offer.employer?.first_name, offer.employer?.last_name);

  return (
    <div className="container-narrow py-4 sm:py-8">
      <PageHeader title={t("offers.meta.detail_title")} backHref="/offers" actions={<OfferStatusBadge status={expired && offer.status !== "expired" ? "expired" : offer.status} size="lg" />} />

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_320px] md:items-start">
        <div className="space-y-4">
          {/* Kimdan + lavozim */}
          <section className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <Avatar src={avatarSrc} fallback={fallback} square={!!offer.company} size="lg" alt="" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("offers.detail.from")}</p>
                <p className="flex items-center gap-1 text-base font-semibold">
                  {sender}
                  {offer.company?.verification_status === "verified" ? <BadgeCheck className="size-4 text-primary" aria-label={t("common.labels.verified")} /> : null}
                </p>
                {offer.company ? (
                  <Link href={`/company/${offer.company.slug}`} className="text-sm text-primary hover:underline">
                    {t("common.nav.company")}
                  </Link>
                ) : null}
              </div>
            </div>
            <div className="mt-4 space-y-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("offers.detail.position")}</p>
                <h2 className="text-xl font-bold leading-snug">{title}</h2>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("offers.detail.salary")}</p>
                <SalaryText from={offer.salary_from} to={offer.salary_to} className="text-lg" />
              </div>
              {offer.vacancy ? (
                <Button asChild variant="soft" size="sm">
                  <Link href={`/jobs/${offer.vacancy.slug}`}>
                    {t("offers.detail.open_vacancy")} <ArrowUpRight className="size-4" />
                  </Link>
                </Button>
              ) : null}
            </div>
            <div className="mt-4 space-y-1 border-t border-border pt-3">
              <InfoRow icon={Clock}>{t("offers.detail.sent_at", { time: formatRelative(offer.created_at, locale) })}</InfoRow>
              {offer.expires_at ? <InfoRow icon={CalendarClock}>{t("offers.list.expires", { date: formatDate(offer.expires_at, locale) })}</InfoRow> : null}
              {offer.responded_at ? <InfoRow icon={Clock}>{t("offers.detail.responded_at", { time: formatRelative(offer.responded_at, locale) })}</InfoRow> : null}
            </div>
          </section>

          {/* Xabar */}
          <section className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
            <SectionHeader title={t("offers.detail.message")} />
            {offer.message ? <p className="whitespace-pre-line text-sm leading-relaxed">{offer.message}</p> : <p className="text-sm text-muted-foreground">{t("offers.list.no_message")}</p>}
          </section>

          {/* Holat / javob */}
          <section className={cn("rounded-2xl border p-4", TONE_BANNER[tone])}>
            {pending ? (
              <OfferRespondActions offerId={offer.id} />
            ) : expired ? (
              <p className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <AlertTriangle className="size-4" /> {t("offers.detail.expired_title")}
              </p>
            ) : offer.status === "accepted" ? (
              <div>
                <div className="flex items-start gap-3">
                  <PartyPopper className="mt-0.5 size-5 shrink-0 text-success" />
                  <div>
                    <p className="font-semibold">{offer.hired_at ? t("offers.detail.hired_title") : t("offers.detail.accepted_title")}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{offer.hired_at ? t("offers.detail.hired_hint") : t("offers.detail.accepted_hint")}</p>
                  </div>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <Button asChild>
                    <Link href={`/messages/new?offer_id=${offer.id}`}>
                      <MessageCircle className="size-4" /> {t("offers.detail.write")}
                    </Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href="/applications">
                      <FileText className="size-4" /> {t("offers.detail.go_applications")}
                    </Link>
                  </Button>
                </div>
                {offer.hired_at && !offer.my_review ? (
                  <div className="mt-3">
                    <ReviewSheet source={{ kind: "offer", offerId: offer.id }} label={t("applications.review.rate_employer")} variant="soft" fullWidth />
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="text-sm font-medium">{offer.status === "declined" ? t("offers.detail.declined_title") : t("offers.detail.withdrawn_title")}</p>
            )}
          </section>

          {offer.my_review ? <ReviewCard review={offer.my_review} /> : null}
        </div>

        <aside className="space-y-3 md:sticky md:top-20">
          <div>
            <p className="mb-2 text-sm font-semibold">{t("offers.detail.contact")}</p>
            <ContactCard profileId={offer.employer_profile_id} />
          </div>
        </aside>
      </div>
    </div>
  );
}
