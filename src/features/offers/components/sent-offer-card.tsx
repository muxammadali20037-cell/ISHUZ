"use client";

import Link from "next/link";
import { Clock, UserX, Briefcase } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { formatRelative, initials, shortName } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { SalaryText } from "@/components/shared/salary-text";
import { isOfferPending, offerTitle, type SentOffer } from "../types";
import { OfferStatusBadge } from "./offer-status-badge";
import { WithdrawOfferButton } from "./withdraw-offer-button";

/** Ish beruvchi yuborgan taklif kartasi (nomzod, holat, qaytarib olish) */
export function SentOfferCard({ offer, canWithdraw, className }: { offer: SentOffer; canWithdraw: boolean; className?: string }) {
  const { t, tEnum, locale } = useT();
  const c = offer.candidate;
  const name = c ? shortName(c.first_name, c.last_initial) : t("offers.detail.worker_hidden");
  const title = offerTitle(offer);
  return (
    <article className={cn("relative rounded-2xl border border-border/70 bg-card p-4 shadow-sm transition-shadow hover:shadow-md", className)}>
      <Link href={`/offers/${offer.id}`} className="absolute inset-0 rounded-2xl" aria-label={title} />
      <div className="flex items-start gap-3">
        {c ? <Avatar src={c.avatar_url} fallback={initials(c.first_name, c.last_initial)} size="lg" alt="" /> : <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground"><UserX className="size-6" /></div>}
        <div className="min-w-0 flex-1">
          <h3 className={cn("truncate text-base font-semibold", !c && "text-muted-foreground")}>{name}</h3>
          {c?.headline ? <p className="truncate text-sm text-foreground/90">{c.headline}</p> : null}
          {c ? (
            <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Briefcase className="size-3.5" /> {tEnum("experience_level", c.experience_level)}
            </p>
          ) : null}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-sm font-medium">{title}</span>
        <SalaryText from={offer.salary_from} to={offer.salary_to} className="text-sm" />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <OfferStatusBadge status={offer.status} />
        {offer.hired_at ? <span className="text-xs font-medium text-success">{t("offers.detail.employer_hired")}</span> : null}
        <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="size-3.5" /> {formatRelative(offer.created_at, locale)}
        </span>
      </div>
      {canWithdraw && isOfferPending(offer.status) ? (
        <div className="relative z-10 mt-3">
          <WithdrawOfferButton offerId={offer.id} vacancyId={offer.vacancy_id} size="sm" />
        </div>
      ) : null}
    </article>
  );
}
