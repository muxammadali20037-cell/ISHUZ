"use client";

import { useT } from "@/lib/i18n/client";
import { formatDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import type { ReviewSummary } from "../types";
import { StarRating } from "./star-rating";

/** Mening qoldirgan sharhim (holati bilan) */
export function ReviewCard({ review }: { review: ReviewSummary }) {
  const { t, locale } = useT();
  const variant = review.status === "approved" ? "success" : review.status === "rejected" ? "destructive" : "warning";
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold">{t("applications.review.your_review")}</p>
        <Badge variant={variant}>{t(`applications.review.status_${review.status}`)}</Badge>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <StarRating value={review.rating} size="sm" />
        <span className="text-xs text-muted-foreground">{formatDate(review.created_at, locale)}</span>
      </div>
      {review.text ? <p className="mt-2 whitespace-pre-line text-sm text-foreground/90">{review.text}</p> : null}
    </div>
  );
}
