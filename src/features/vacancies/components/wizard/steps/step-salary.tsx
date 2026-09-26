"use client";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Handshake } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { Switch } from "@/components/ui/checkbox";
import { ChipGroup } from "@/components/ui/chip";
import { Field } from "@/components/ui/label";
import { SalaryText } from "@/components/shared/salary-text";
import { SALARY_TYPES, salarySchema, type SalaryInput } from "../../../schema";
import { MoneyInput } from "../money-input";
import { useSaveStep } from "../use-save-step";
import { WizardFooter } from "../wizard-footer";
import type { StepProps } from "../types";

/** 4-qadam: maosh — kelishiladi / dan–gacha / to'lov turi */
export function StepSalary({ mode, vacancy }: StepProps) {
  const { t, tEnum } = useT();
  const saver = useSaveStep(mode, vacancy.id, "salary");
  const form = useForm<SalaryInput>({
    resolver: zodResolver(salarySchema),
    defaultValues: { salaryNegotiable: vacancy.salary_negotiable, salaryFrom: vacancy.salary_from, salaryTo: vacancy.salary_to, salaryType: vacancy.salary_type },
  });
  const values = form.watch();
  const errors = form.formState.errors;
  const onSubmit = form.handleSubmit((data) => saver.save({ step: "salary", data }));

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <Controller
        control={form.control}
        name="salaryNegotiable"
        render={({ field }) => (
          <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-border bg-card p-4 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary-soft/50">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
              <Handshake className="size-5" />
            </span>
            <span className="flex-1">
              <span className="block font-semibold">{t("vacancies.wizard.salary.negotiable")}</span>
              <span className="block text-xs text-muted-foreground">{t("vacancies.wizard.salary.negotiable_desc")}</span>
            </span>
            <Switch checked={field.value} onCheckedChange={field.onChange} aria-label={t("vacancies.wizard.salary.negotiable")} />
          </label>
        )}
      />

      <div className="grid grid-cols-2 gap-3">
        <Field label={t("vacancies.wizard.salary.from")} htmlFor="salary-from">
          <Controller control={form.control} name="salaryFrom" render={({ field }) => <MoneyInput id="salary-from" value={field.value} onChange={field.onChange} placeholder="5 000 000" />} />
        </Field>
        <Field label={t("vacancies.wizard.salary.to")} htmlFor="salary-to" error={errors.salaryTo?.message ? t(errors.salaryTo.message) : undefined}>
          <Controller control={form.control} name="salaryTo" render={({ field }) => <MoneyInput id="salary-to" value={field.value} onChange={field.onChange} placeholder="7 000 000" invalid={!!errors.salaryTo} />} />
        </Field>
      </div>
      <p className="-mt-3 text-xs text-muted-foreground">{t("vacancies.wizard.salary.hint")}</p>

      <Field label={t("vacancies.wizard.salary.type")}>
        <Controller
          control={form.control}
          name="salaryType"
          render={({ field }) => (
            <ChipGroup options={SALARY_TYPES.map((v) => ({ value: v, label: tEnum("salary_type", v) }))} value={field.value} onChange={(v) => { if (typeof v === "string") field.onChange(v); }} size="lg" />
          )}
        />
      </Field>

      <div className="rounded-xl bg-secondary px-4 py-3 text-sm">
        <span className="text-muted-foreground">{t("vacancies.wizard.salary.preview")} </span>
        <SalaryText from={values.salaryFrom} to={values.salaryTo} type={values.salaryType} negotiable={values.salaryNegotiable} />
      </div>

      <WizardFooter mode={mode} step="salary" pending={saver.pending} onBack={saver.back} onSkip={saver.skip} />
    </form>
  );
}
