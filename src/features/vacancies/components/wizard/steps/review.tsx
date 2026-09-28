"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Pencil, Rocket, Save, Settings2, CheckCircle2 } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { formatWorkTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { SalaryText } from "@/components/shared/salary-text";
import { publishVacancy } from "../../../actions";
import { canPublish } from "../../../status";
import { STEP_KEYS, missingSteps, stepIndex, wizardHref, type StepKey } from "../../../steps";
import { errorMessage } from "../../../utils";
import { descriptionExcerpt } from "../../description";
import { VacancyPreview } from "../../vacancy-preview";
import { QualityPanel } from "../../insights/quality-panel";
import type { StepProps } from "../types";
import { PublishModeNote, requestPayment } from "@/features/billing/components/payment-dialog";

/**
 * Ko'rib chiqish: to'liq preview + qadamlar xulosasi (tahrirlash havolalari) + E'lon qilish / Qoralama.
 * publish_vacancy 'vacancy_incomplete' bersa — to'ldirilmagan qadamlar ajratib ko'rsatiladi.
 */
export function ReviewStep({ mode, vacancy: v, refs }: StepProps) {
  const { t, tEnum, name } = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [highlight, setHighlight] = useState(false);
  const missing = missingSteps(v);
  const missingSet = new Set<StepKey>(missing);
  const publishable = canPublish(v.status);

  const publish = () => {
    if (missing.length) {
      setHighlight(true);
      toast.error(t("vacancies.errors.vacancy_incomplete"));
      return;
    }
    startTransition(async () => {
      const res = await publishVacancy({ vacancyId: v.id });
      if (!res.ok) {
        if (res.error === "payment_required") {
          requestPayment({ purpose: "vacancy_publish", targetId: v.id });
          return;
        }
        if (res.error === "vacancy_incomplete") setHighlight(true);
        toast.error(errorMessage(t, res.error));
        return;
      }
      if (res.data?.status === "pending_review") toast.success(t("vacancies.toast.pending_review"), t("vacancies.toast.pending_review_desc"));
      else toast.success(t("vacancies.toast.published"), t("vacancies.toast.published_desc"));
      router.push(`/employer/vacancies/${v.id}`);
    });
  };

  const saveDraft = () => {
    toast.success(t("vacancies.toast.draft_saved"), t("vacancies.toast.draft_saved_desc"));
    router.push("/employer/vacancies");
  };

  const time = v.work_time_from && v.work_time_to ? ` · ${formatWorkTime(v.work_time_from)}–${formatWorkTime(v.work_time_to)}` : "";
  const notSet = <span className="text-muted-foreground">{t("vacancies.wizard.review.not_set")}</span>;
  const summaries: Record<StepKey, React.ReactNode> = {
    title: v.title,
    category: v.profession ? `${v.category ? `${name(v.category)} · ` : ""}${name(v.profession)}` : v.category ? `${name(v.category)}${v.subcategory ? ` · ${name(v.subcategory)}` : ""}` : notSet,
    location: v.is_remote ? t("vacancies.preview.remote") : v.region ? [v.district ? name(v.district) : null, name(v.region), v.address].filter(Boolean).join(", ") : notSet,
    salary: <SalaryText from={v.salary_from} to={v.salary_to} type={v.salary_type} negotiable={v.salary_negotiable} className="font-medium" />,
    schedule: `${tEnum("employment_type", v.employment_type)} · ${tEnum("work_schedule", v.schedule)}${time}`,
    requirements: [
      v.positions_count > 1 ? t("vacancies.preview.positions", { count: v.positions_count }) : null,
      tEnum("experience_min_months", String(v.experience_min_months)),
      v.age_min || v.age_max ? `${v.age_min ?? "…"}–${v.age_max ?? "…"}` : null,
      v.education_min ? tEnum("education_level", v.education_min) : null,
      v.gender ? tEnum("gender", v.gender) : null,
      v.languages.length ? t("vacancies.wizard.review.languages_count", { count: v.languages.length }) : null,
    ]
      .filter(Boolean)
      .join(" · "),
    skills: v.skills.length ? t("vacancies.wizard.review.skills_count", { count: v.skills.length }) : notSet,
    work_format: `${tEnum("work_format", v.work_format)}${v.work_format === "official" && v.official_terms.length ? ` · ${t("vacancies.wizard.review.terms_count", { count: v.official_terms.length })}` : ""}`,
    description: v.description?.trim() ? descriptionExcerpt(v.description, 90) : notSet,
    benefits: v.benefits.length ? t("vacancies.wizard.review.benefits_count", { count: v.benefits.length }) : notSet,
  };

  return (
    <div className="space-y-6">
      {missing.length ? (
        <div className={cn("rounded-2xl border p-4", highlight ? "border-destructive bg-destructive-soft" : "border-warning/40 bg-warning-soft")}>
          <div className="flex items-start gap-2">
            <AlertTriangle className={cn("mt-0.5 size-5 shrink-0", highlight ? "text-destructive" : "text-warning")} />
            <div>
              <div className="font-semibold">{t("vacancies.wizard.review.missing_title")}</div>
              <p className="text-sm text-foreground/80">{t("vacancies.wizard.review.missing_desc")}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {missing.map((s) => (
                  <Button key={s} asChild size="sm" variant={highlight ? "destructive" : "default"}>
                    <Link href={wizardHref(mode, v.id, s)}>
                      {stepIndex(s)}. {t(`vacancies.wizard.steps.${s}.name`)}
                    </Link>
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {publishable ? <QualityPanel mode={mode} vacancy={v} /> : null}

      <VacancyPreview vacancy={v} benefits={refs.benefits} />

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t("vacancies.wizard.review.summary")}</h2>
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {STEP_KEYS.map((s) => {
            const bad = highlight && missingSet.has(s);
            return (
              <li key={s} className={cn("flex items-center gap-3 px-4 py-3", bad && "bg-destructive-soft")}>
                <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold", bad ? "bg-destructive text-white" : missingSet.has(s) ? "bg-warning-soft text-warning" : "bg-success-soft text-success")}>
                  {missingSet.has(s) ? stepIndex(s) : <CheckCircle2 className="size-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-muted-foreground">{t(`vacancies.wizard.steps.${s}.name`)}</div>
                  <div className="truncate text-sm">{summaries[s]}</div>
                </div>
                <Link href={wizardHref(mode, v.id, s)} className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label={t("vacancies.wizard.review.edit_step")}>
                  <Pencil className="size-4" />
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="sticky bottom-0 z-20 -mx-4 border-t border-border bg-card/95 px-4 py-3 pb-safe backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-none">
        {publishable ? (
          <>
            <PublishModeNote vacancyId={v.id} />
            <p className="mb-2 text-xs text-muted-foreground">{t(v.status === "rejected" ? "vacancies.wizard.review.moderation_hint" : "vacancies.wizard.review.publish_hint")}</p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              {mode === "create" ? (
                <Button type="button" variant="secondary" size="lg" onClick={saveDraft} disabled={pending}>
                  <Save className="size-4" /> {t("vacancies.actions.save_draft")}
                </Button>
              ) : (
                <Button asChild variant="secondary" size="lg">
                  <Link href={`/employer/vacancies/${v.id}`}>
                    <Settings2 className="size-4" /> {t("vacancies.actions.go_manage")}
                  </Link>
                </Button>
              )}
              <Button type="button" size="lg" onClick={publish} loading={pending}>
                <Rocket className="size-4" /> {t(v.status === "rejected" ? "vacancies.actions.resubmit" : "vacancies.actions.publish")}
              </Button>
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">{t(v.status === "active" ? "vacancies.wizard.review.already_active" : v.status === "pending_review" ? "vacancies.wizard.review.pending" : `vacancies.manage.status_hint.${v.status}`)}</p>
            <Button asChild size="lg">
              <Link href={`/employer/vacancies/${v.id}`}>
                <Settings2 className="size-4" /> {t("vacancies.actions.go_manage")}
              </Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
