"use client";

import Link from "next/link";
import { ChevronLeft, Info, Check } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import type { Skill } from "@/lib/reference";
import { Stepper } from "@/components/ui/misc";
import { STEP_KEYS, TOTAL_STEPS, completedSteps, isOptionalStep, stepIndex, wizardHref, type WizardMode, type WizardStep } from "../../steps";
import type { VacancyFull } from "../../types";
import { VacancyStatusBadge } from "../status-badge";
import type { WizardRefs } from "./types";
import { StepTitle } from "./steps/step-title";
import { StepCategory } from "./steps/step-category";
import { StepLocation } from "./steps/step-location";
import { StepSalary } from "./steps/step-salary";
import { StepSchedule } from "./steps/step-schedule";
import { StepRequirements } from "./steps/step-requirements";
import { StepSkills } from "./steps/step-skills";
import { StepWorkFormat } from "./steps/step-work-format";
import { StepDescription } from "./steps/step-description";
import { StepBenefits } from "./steps/step-benefits";
import { ReviewStep } from "./steps/review";

export function VacancyWizard({
  mode,
  vacancy,
  step,
  refs,
  suggestedSkills,
}: {
  mode: WizardMode;
  vacancy: VacancyFull | null;
  step: WizardStep;
  refs: WizardRefs;
  suggestedSkills: Skill[];
}) {
  const { t } = useT();
  const heading = t(`vacancies.wizard.steps.${step}.heading`);
  const hint = t(`vacancies.wizard.steps.${step}.hint`);
  const optional = step !== "review" && isOptionalStep(step);

  return (
    <div className="container-narrow py-4 sm:py-8">
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link href={vacancy ? `/employer/vacancies/${vacancy.id}` : "/employer/vacancies"} className="-ml-2 inline-flex h-10 items-center gap-1 rounded-xl px-2 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground">
          <ChevronLeft className="size-5" />
          {t(mode === "edit" ? "vacancies.wizard.title_edit" : "vacancies.wizard.title_new")}
        </Link>
        {vacancy ? <VacancyStatusBadge status={vacancy.status} /> : null}
      </div>

      {mode === "edit" && vacancy ? (
        <StepTabs vacancy={vacancy} current={step} />
      ) : (
        <Stepper current={step === "review" ? TOTAL_STEPS : stepIndex(step)} total={TOTAL_STEPS} label={`${t("vacancies.wizard.step_label")} · ${t(`vacancies.wizard.steps.${step}.name`)}`} />
      )}

      {vacancy ? <StatusNotice vacancy={vacancy} /> : null}

      <div className="mt-6">
        <h1 className="text-xl font-bold sm:text-2xl">
          {heading}
          {optional ? <span className="ml-2 align-middle text-sm font-normal text-muted-foreground">({t("vacancies.wizard.optional")})</span> : null}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
        {mode === "create" && step === "title" && !vacancy ? <p className="mt-1 text-xs text-muted-foreground">{t("vacancies.wizard.autosave_hint")}</p> : null}
      </div>

      <div className="mt-5">
        {step === "title" ? (
          <StepTitle mode={mode} vacancy={vacancy} refs={refs} />
        ) : !vacancy ? null : step === "category" ? (
          <StepCategory mode={mode} vacancy={vacancy} refs={refs} />
        ) : step === "location" ? (
          <StepLocation mode={mode} vacancy={vacancy} refs={refs} />
        ) : step === "salary" ? (
          <StepSalary mode={mode} vacancy={vacancy} refs={refs} />
        ) : step === "schedule" ? (
          <StepSchedule mode={mode} vacancy={vacancy} refs={refs} />
        ) : step === "requirements" ? (
          <StepRequirements mode={mode} vacancy={vacancy} refs={refs} />
        ) : step === "skills" ? (
          <StepSkills mode={mode} vacancy={vacancy} refs={refs} suggestedSkills={suggestedSkills} />
        ) : step === "work_format" ? (
          <StepWorkFormat mode={mode} vacancy={vacancy} refs={refs} />
        ) : step === "description" ? (
          <StepDescription mode={mode} vacancy={vacancy} refs={refs} />
        ) : step === "benefits" ? (
          <StepBenefits mode={mode} vacancy={vacancy} refs={refs} />
        ) : (
          <ReviewStep mode={mode} vacancy={vacancy} refs={refs} />
        )}
      </div>
    </div>
  );
}

/** Tahrirlash rejimi: qadamlar orasida erkin o'tish */
function StepTabs({ vacancy, current }: { vacancy: VacancyFull; current: WizardStep }) {
  const { t } = useT();
  const done = completedSteps({
    ...vacancy,
    skillsCount: vacancy.skills.length,
    languagesCount: vacancy.languages.length,
    benefitsCount: vacancy.benefits.length,
  });
  const all: WizardStep[] = [...STEP_KEYS, "review"];
  return (
    <nav className="-mx-4 overflow-x-auto px-4 scrollbar-none sm:mx-0 sm:px-0" aria-label={t("vacancies.wizard.step_label")}>
      <div className="flex w-max gap-1.5">
        {all.map((s, i) => {
          const active = s === current;
          const isDone = s !== "review" && done.has(s);
          return (
            <Link
              key={s}
              href={wizardHref("edit", vacancy.id, s)}
              scroll={false}
              aria-current={active ? "step" : undefined}
              className={cn(
                "inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-sm font-medium transition-colors",
                active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
              )}
            >
              <span className={cn("flex size-5 items-center justify-center rounded-full text-[11px] font-bold", active ? "bg-primary-foreground/20" : isDone ? "bg-success-soft text-success" : "bg-secondary")}>
                {isDone && !active ? <Check className="size-3" strokeWidth={3} /> : i + 1}
              </span>
              {t(`vacancies.wizard.steps.${s}.name`)}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/** Holatga oid eslatma: faol / moderatsiyada / muddati tugagan / rad etilgan */
function StatusNotice({ vacancy }: { vacancy: VacancyFull }) {
  const { t } = useT();
  const key =
    vacancy.status === "active"
      ? "vacancies.wizard.active_notice"
      : vacancy.status === "pending_review"
        ? "vacancies.wizard.pending_notice"
        : vacancy.status === "expired"
          ? "vacancies.wizard.expired_notice"
          : vacancy.status === "rejected"
            ? "vacancies.wizard.rejected_notice"
            : null;
  if (!key) return null;
  const destructive = vacancy.status === "rejected";
  return (
    <div className={cn("mt-4 flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm", destructive ? "bg-destructive-soft text-destructive" : "bg-primary-soft text-primary")}>
      <Info className="mt-0.5 size-4 shrink-0" />
      <div>
        <p>{t(key)}</p>
        {destructive && vacancy.moderation_note ? (
          <p className="mt-1 text-foreground/80">
            <span className="font-semibold">{t("vacancies.manage.moderation_note")}:</span> {vacancy.moderation_note}
          </p>
        ) : null}
      </div>
    </div>
  );
}
