"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CopyCheck, ShieldAlert, Sparkles, ThumbsUp } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { assessVacancy } from "../../quality";
import { getSimilarVacancies, type SimilarVacancy } from "../../insights";
import { wizardHref, type WizardMode } from "../../steps";
import type { VacancyFull } from "../../types";

/**
 * E'lon sifati: amaliy maslahatlar (tuzatish havolasi bilan) + o'xshash faol e'lon ogohlantirishi.
 * Hech narsani bloklamaydi — qaror ish beruvchida.
 */
export function QualityPanel({ mode, vacancy: v }: { mode: WizardMode; vacancy: VacancyFull }) {
  const { t, tEnum } = useT();
  const { level, tips } = assessVacancy(v);
  const [similar, setSimilar] = useState<SimilarVacancy[]>([]);

  useEffect(() => {
    let alive = true;
    getSimilarVacancies({ vacancyId: v.id }).then((res) => {
      if (alive && res.ok && res.data) setSimilar(res.data);
    });
    return () => {
      alive = false;
    };
  }, [v.id]);

  const tone = level === "good" ? "border-success/40 bg-success-soft/50" : level === "ok" ? "border-border bg-card" : "border-warning/50 bg-warning-soft/60";
  const Icon = level === "good" ? ThumbsUp : level === "ok" ? Sparkles : ShieldAlert;

  return (
    <section className="space-y-3" aria-label={t("vacancies.quality.title")}>
      <div className={cn("rounded-2xl border p-4", tone)}>
        <div className="flex items-center gap-2">
          <Icon className={cn("size-5 shrink-0", level === "good" ? "text-success" : level === "ok" ? "text-primary" : "text-warning")} />
          <p className="font-semibold">{t(`vacancies.quality.level.${level}`)}</p>
        </div>
        {tips.length ? (
          <ul className="mt-3 space-y-2">
            {tips.map((tip) => (
              <li key={tip.key} className="flex items-start justify-between gap-3 text-sm">
                <span className={cn("min-w-0", tip.severity === "risk" && "font-medium text-foreground")}>
                  {tip.severity === "risk" ? "⚠️ " : "💡 "}
                  {t(`vacancies.quality.tips.${tip.key}`)}
                </span>
                <Link href={wizardHref(mode, v.id, tip.step)} className="shrink-0 font-semibold text-primary hover:underline">
                  {t("vacancies.quality.fix")}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">{t("vacancies.quality.all_good")}</p>
        )}
      </div>

      {similar.length ? (
        <div className="rounded-2xl border border-warning/50 bg-warning-soft/60 p-4">
          <div className="flex items-start gap-2">
            <CopyCheck className="mt-0.5 size-5 shrink-0 text-warning" />
            <div className="min-w-0">
              <p className="font-semibold">{t("vacancies.quality.similar_title")}</p>
              <p className="text-sm text-foreground/80">{t("vacancies.quality.similar_desc")}</p>
              <ul className="mt-2 space-y-1">
                {similar.map((s) => (
                  <li key={s.id}>
                    <Link href={`/employer/vacancies/${s.id}`} className="text-sm font-medium text-primary hover:underline">
                      {s.title}
                    </Link>
                    <span className="text-xs text-muted-foreground"> · {tEnum("vacancy_status", s.status)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
