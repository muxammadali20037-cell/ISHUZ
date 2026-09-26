"use client";

import Link from "next/link";
import { BadgeCheck, Clock, AlertTriangle } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { formatRelative, initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { SalaryText } from "@/components/shared/salary-text";
import { isOfferExpired, offerSenderName, offerTitle, type ReceivedOffer } from "../types";
import { OfferStatusBadge } from "./offer-status-badge";

/** Ishchiga kelgan taklif kartasi */
export function OfferCard({ offer, className }: { offer: ReceivedOffer; className?: string }) {
  const { t, locale } = useT();
  const title = offerTitle(offer);
  const sender = offerSenderName(offer) || t("common.role.employer");
  const expired = isOfferExpired(offer);
  const avatarSrc = offer.company?.logo_url ?? offer.employer?.avatar_url ?? null;
  const fallback = offer.company ? offer.company.name.slice(0, 2) : initials(offer.employer?.first_name, offer.employer?.last_name);
  return (
    <article className={cn("relative rounded-2xl border border-border/70 bg-card p-4 shadow-sm transition-shadow hover:shadow-md", offer.status === "sent" && "border-sky-300/70 dark:border-sky-800", className)}>
      <Link href={`/offers/${offer.id}`} className="absolute inset-0 rounded-2xl" aria-label={title} />
      <div className="flex items-start gap-3">
        <Avatar src={avatarSrc} fallback={fallback} square={!!offer.company} size="lg" alt="" />
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-base font-semibold leading-snug">{title}</h3>
          <p className="mt-0.5 flex items-center gap-1 truncate text-sm text-muted-foreground">
            {sender}
            {offer.company?.verification_status === "verified" ? <BadgeCheck className="size-4 shrink-0 text-primary" aria-label={t("common.labels.verified")} /> : null}
          </p>
        </div>
      </div>
      <div className="mt-3">
        <SalaryText from={offer.salary_from} to={offer.salary_to} className="text-[15px]" />
      </div>
      {offer.message ? <p className="mt-2 line-clamp-2 text-sm text-foreground/80">{offer.message}</p> : null}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <OfferStatusBadge status={offer.status} label={offer.status === "sent" ? t("common.labels.new") : undefined} />
        {expired ? (
          <span className="inline-flex items-center gap-1 text-xs text-warning">
            <AlertTriangle className="size-3.5" /> {t("offers.list.expired_hint")}
          </span>
        ) : null}
        <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="size-3.5" /> {formatRelative(offer.created_at, locale)}
        </span>
      </div>
    </article>
  );
}
