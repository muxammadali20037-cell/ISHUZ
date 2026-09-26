import Link from "next/link";
import { CheckCircle2, ChevronRight, Sparkles } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { getCompleteness } from "../queries";

type Completeness = Awaited<ReturnType<typeof getCompleteness>>;

/** Profil to'liqligi: ball + tahrirlash bo'limiga havolali tavsiyalar */
export async function CompletenessCard({ completeness }: { completeness: Completeness }) {
  const { t } = await getT();
  const { score, suggestions } = completeness;
  const tone = score >= 80 ? "success" : score >= 50 ? "primary" : "warning";
  return (
    <Card>
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold">{t("profile.completeness.title")}</h2>
          <span className="tabular text-lg font-bold text-primary">{score}%</span>
        </div>
        <Progress value={score} tone={tone} className="mt-3" />
        {suggestions.length === 0 ? (
          <p className="mt-3 flex items-start gap-2 text-sm text-success">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> {t("profile.completeness.complete")}
          </p>
        ) : (
          <>
            <p className="mt-3 text-xs text-muted-foreground">{t("profile.completeness.hint")}</p>
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("profile.completeness.todo")}</p>
            <ul className="mt-1.5 divide-y divide-border">
              {suggestions.map((s) => (
                <li key={s.key}>
                  <Link href={s.href} className="flex min-h-11 items-center gap-2 py-2 text-sm hover:text-primary">
                    <Sparkles className="size-4 shrink-0 text-primary" />
                    <span className="flex-1">{t(`profile.completeness.suggestions.${s.key}`)}</span>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}
