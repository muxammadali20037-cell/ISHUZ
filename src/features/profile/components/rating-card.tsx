import { Star } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { formatDate, fullName, initials } from "@/lib/format";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { MyRating } from "../queries";

function Stars({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} aria-label={`${value}/5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={cn("size-4", i <= Math.round(value) ? "fill-warning text-warning" : "text-border")} />
      ))}
    </span>
  );
}

/** profile_rating + men haqimdagi tasdiqlangan sharhlar */
export async function RatingCard({ rating }: { rating: MyRating }) {
  const { t, locale } = await getT();
  return (
    <Card>
      <CardContent className="p-4 sm:p-5">
        <h2 className="text-base font-semibold">{t("profile.sections.rating")}</h2>
        <div className="mt-3 flex items-center gap-3">
          <span className="tabular text-3xl font-bold">{rating.avg !== null ? rating.avg.toFixed(1) : "–"}</span>
          <div>
            <Stars value={rating.avg ?? 0} />
            <p className="text-xs text-muted-foreground">{rating.count ? t("profile.rating.reviews_count", { count: rating.count }) : t("profile.rating.no_rating")}</p>
          </div>
        </div>
        {rating.reviews.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">{t("profile.empty.reviews")}</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {rating.reviews.map((r) => {
              const author = r.author;
              const authorName = author ? fullName(author.first_name, author.last_name) : "";
              return (
                <li key={r.id} className="flex gap-3">
                  <Avatar src={author?.avatar_url} fallback={author ? initials(author.first_name, author.last_name) : "?"} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold">{authorName || t("profile.rating.anonymous")}</p>
                      <Stars value={r.rating} />
                    </div>
                    {r.text ? <p className="mt-1 text-sm">{r.text}</p> : null}
                    <p className="mt-1 text-xs text-muted-foreground">{formatDate(r.created_at, locale)}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
