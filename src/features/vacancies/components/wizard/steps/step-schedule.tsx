"use client";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useT } from "@/lib/i18n/client";
import { Input } from "@/components/ui/input";
import { ChipGroup } from "@/components/ui/chip";
import { Field } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { EMPLOYMENT_TYPES, LEARNING_OPPORTUNITIES, OPPORTUNITY_TYPES, WORK_SCHEDULES, scheduleSchema, type ScheduleInput, type ScheduleValues } from "../../../schema";
import { toHHMM } from "../../../utils";
import { useSaveStep } from "../use-save-step";
import { WizardFooter } from "../wizard-footer";
import type { StepProps } from "../types";

/** 5-qadam: bandlik turi, grafik, ish vaqti */
export function StepSchedule({ mode, vacancy }: StepProps) {
  const { t, tEnum } = useT();
  const saver = useSaveStep(mode, vacancy.id, "schedule");
  const form = useForm<ScheduleInput, unknown, ScheduleValues>({
    resolver: zodResolver(scheduleSchema),
    defaultValues: {
      opportunityType: vacancy.opportunity_type,
      isPaid: vacancy.is_paid,
      studentFriendly: vacancy.student_friendly,
      employmentType: vacancy.employment_type,
      schedule: vacancy.schedule,
      workTimeFrom: toHHMM(vacancy.work_time_from) || null,
      workTimeTo: toHHMM(vacancy.work_time_to) || null,
    },
  });
  const errors = form.formState.errors;
  const opportunity = form.watch("opportunityType");
  const learning = (LEARNING_OPPORTUNITIES as readonly string[]).includes(opportunity ?? "job");
  const onSubmit = form.handleSubmit((data) => saver.save({ step: "schedule", data }));

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <Field label={t("vacancies.wizard.schedule.opportunity")} description={t("vacancies.wizard.schedule.opportunity_hint")}>
        <Controller
          control={form.control}
          name="opportunityType"
          render={({ field }) => (
            <ChipGroup
              options={OPPORTUNITY_TYPES.map((v) => ({ value: v, label: tEnum("opportunity_type", v) }))}
              value={field.value ?? "job"}
              onChange={(v) => {
                if (typeof v !== "string") return;
                field.onChange(v);
                if (!(LEARNING_OPPORTUNITIES as readonly string[]).includes(v)) form.setValue("isPaid", null);
              }}
              size="lg"
            />
          )}
        />
      </Field>
      {learning ? (
        <Field label={t("vacancies.wizard.schedule.paid")} error={errors.isPaid?.message ? t(errors.isPaid.message) : undefined}>
          <Controller
            control={form.control}
            name="isPaid"
            render={({ field }) => (
              <ChipGroup
                options={[
                  { value: "yes", label: t("vacancies.wizard.schedule.paid_yes") },
                  { value: "no", label: t("vacancies.wizard.schedule.paid_no") },
                ]}
                value={field.value === true ? "yes" : field.value === false ? "no" : ""}
                onChange={(v) => field.onChange(v === "yes" ? true : v === "no" ? false : null)}
                size="lg"
              />
            )}
          />
        </Field>
      ) : null}
      <Controller
        control={form.control}
        name="studentFriendly"
        render={({ field }) => (
          <Checkbox checked={!!field.value} onCheckedChange={(c) => field.onChange(c === true)} label={t("vacancies.wizard.schedule.student_friendly")} description={t("vacancies.wizard.schedule.student_friendly_hint")} />
        )}
      />
      <Field label={t("vacancies.wizard.schedule.employment")}>
        <Controller
          control={form.control}
          name="employmentType"
          render={({ field }) => (
            <ChipGroup options={EMPLOYMENT_TYPES.map((v) => ({ value: v, label: tEnum("employment_type", v) }))} value={field.value} onChange={(v) => { if (typeof v === "string") field.onChange(v); }} size="lg" />
          )}
        />
      </Field>
      <Field label={t("vacancies.wizard.schedule.schedule")}>
        <Controller
          control={form.control}
          name="schedule"
          render={({ field }) => (
            <ChipGroup options={WORK_SCHEDULES.map((v) => ({ value: v, label: tEnum("work_schedule", v) }))} value={field.value} onChange={(v) => { if (typeof v === "string") field.onChange(v); }} size="lg" />
          )}
        />
      </Field>
      <div>
        <div className="mb-1.5 text-sm font-medium">
          {t("vacancies.wizard.schedule.time")} <span className="text-xs font-normal text-muted-foreground">({t("common.labels.optional")})</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("vacancies.wizard.schedule.time_from")} htmlFor="time-from" error={errors.workTimeFrom?.message ? t(errors.workTimeFrom.message) : undefined}>
            <Controller control={form.control} name="workTimeFrom" render={({ field }) => <Input id="time-from" type="time" step={300} value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value || null)} onBlur={field.onBlur} invalid={!!errors.workTimeFrom} />} />
          </Field>
          <Field label={t("vacancies.wizard.schedule.time_to")} htmlFor="time-to" error={errors.workTimeTo?.message ? t(errors.workTimeTo.message) : undefined}>
            <Controller control={form.control} name="workTimeTo" render={({ field }) => <Input id="time-to" type="time" step={300} value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value || null)} onBlur={field.onBlur} invalid={!!errors.workTimeTo} />} />
          </Field>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{t("vacancies.wizard.schedule.time_hint")}</p>
      </div>

      <WizardFooter mode={mode} step="schedule" pending={saver.pending} onBack={saver.back} onSkip={saver.skip} />
    </form>
  );
}
