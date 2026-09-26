"use client";

import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useT } from "@/lib/i18n/client";
import { Constants, type Enums } from "@/types/database.types";
import type { Benefit } from "@/lib/reference";
import { formatWorkTime } from "@/lib/format";
import { Checkbox } from "@/components/ui/checkbox";
import { ChipGroup } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { Field, Label } from "@/components/ui/label";
import { savePreferences } from "../../actions";
import { preferencesSchema, type PreferencesInput } from "../../schema";
import type { DraftPreferences } from "../../types";
import { MoneyInput } from "../money-input";
import { WizardFooter, fieldError, multiValue, singleValue, useStepSubmit } from "../wizard-shell";

export interface PreferencesDraft {
  preferences: DraftPreferences | null;
  work_format: Enums<"work_format"> | null;
}

export function Step8Preferences({ draft, officialTerms }: { draft: PreferencesDraft; officialTerms: Benefit[] }) {
  const { t, tEnum, name } = useT();
  const { pending, submit } = useStepSubmit();
  const p = draft.preferences;
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<PreferencesInput>({
    resolver: zodResolver(preferencesSchema),
    defaultValues: {
      employment_types: p?.employment_types ?? [],
      schedules: p?.schedules ?? [],
      work_time_from: formatWorkTime(p?.work_time_from),
      work_time_to: formatWorkTime(p?.work_time_to),
      salary_min: p?.salary_min ?? null,
      salary_expected: p?.salary_expected ?? null,
      salary_type: p?.salary_type ?? "monthly",
      availability: p?.availability ?? undefined,
      work_format: draft.work_format ?? undefined,
      official_terms: p?.official_terms ?? [],
    },
  });
  const workFormat = useWatch({ control, name: "work_format" });
  const E = Constants.public.Enums;

  return (
    <form noValidate onSubmit={handleSubmit((values) => submit(() => savePreferences(values)))} className="space-y-6">
      <Field label={t("onboarding.worker.preferences.employment_types")} description={t("onboarding.worker.preferences.multi_hint")} error={fieldError(t, errors.employment_types)}>
        <Controller
          control={control}
          name="employment_types"
          render={({ field }) => <ChipGroup multiple options={E.employment_type.map((v) => ({ value: v, label: tEnum("employment_type", v) }))} value={field.value} onChange={(v) => field.onChange(multiValue(v))} />}
        />
      </Field>

      <Field label={t("onboarding.worker.preferences.schedules")} description={t("onboarding.worker.preferences.multi_hint")} error={fieldError(t, errors.schedules)}>
        <Controller
          control={control}
          name="schedules"
          render={({ field }) => <ChipGroup multiple options={E.work_schedule.map((v) => ({ value: v, label: tEnum("work_schedule", v) }))} value={field.value} onChange={(v) => field.onChange(multiValue(v))} />}
        />
      </Field>

      <div>
        <Label hint={t("common.labels.optional")}>{t("onboarding.worker.preferences.work_time")}</Label>
        <div className="grid grid-cols-2 gap-3">
          <Field htmlFor="work_time_from" error={fieldError(t, errors.work_time_from)}>
            <Input id="work_time_from" type="time" aria-label={t("common.labels.from")} invalid={!!errors.work_time_from} {...register("work_time_from")} />
          </Field>
          <Field htmlFor="work_time_to" error={fieldError(t, errors.work_time_to)}>
            <Input id="work_time_to" type="time" aria-label={t("common.labels.to")} invalid={!!errors.work_time_to} {...register("work_time_to")} />
          </Field>
        </div>
      </div>

      <div className="space-y-4 rounded-2xl border border-border bg-card p-4">
        <Field label={t("onboarding.worker.preferences.salary_type")} required error={fieldError(t, errors.salary_type)}>
          <Controller
            control={control}
            name="salary_type"
            render={({ field }) => <ChipGroup size="sm" options={E.salary_type.map((v) => ({ value: v, label: tEnum("salary_type", v) }))} value={field.value} onChange={(v) => field.onChange(singleValue(v) ?? field.value)} />}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("onboarding.worker.preferences.salary_min")} htmlFor="salary_min" error={fieldError(t, errors.salary_min)} description={t("onboarding.worker.preferences.salary_min_hint")}>
            <Controller control={control} name="salary_min" render={({ field }) => <MoneyInput id="salary_min" value={field.value} onChange={field.onChange} placeholder="3 000 000" invalid={!!errors.salary_min} />} />
          </Field>
          <Field label={t("onboarding.worker.preferences.salary_expected")} htmlFor="salary_expected" error={fieldError(t, errors.salary_expected)} description={t("onboarding.worker.preferences.salary_expected_hint")}>
            <Controller control={control} name="salary_expected" render={({ field }) => <MoneyInput id="salary_expected" value={field.value} onChange={field.onChange} placeholder="5 000 000" invalid={!!errors.salary_expected} />} />
          </Field>
        </div>
      </div>

      <Field label={t("onboarding.worker.preferences.availability")} required error={fieldError(t, errors.availability)}>
        <Controller
          control={control}
          name="availability"
          render={({ field }) => <ChipGroup size="lg" options={E.availability.map((v) => ({ value: v, label: tEnum("availability", v) }))} value={field.value ?? null} onChange={(v) => field.onChange(singleValue(v))} />}
        />
      </Field>

      <Field label={t("onboarding.worker.preferences.work_format")} required error={fieldError(t, errors.work_format)} description={t("onboarding.worker.preferences.work_format_hint")}>
        <Controller
          control={control}
          name="work_format"
          render={({ field }) => <ChipGroup size="lg" options={E.work_format.map((v) => ({ value: v, label: tEnum("work_format", v) }))} value={field.value ?? null} onChange={(v) => field.onChange(singleValue(v))} />}
        />
      </Field>

      {workFormat === "official" && officialTerms.length ? (
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-sm font-semibold">{t("onboarding.worker.preferences.official_terms")}</p>
          <p className="mb-2 text-xs text-muted-foreground">{t("onboarding.worker.preferences.official_terms_hint")}</p>
          <Controller
            control={control}
            name="official_terms"
            render={({ field }) => (
              <div className="divide-y divide-border">
                {officialTerms.map((b) => (
                  <Checkbox
                    key={b.code}
                    checked={field.value.includes(b.code)}
                    onCheckedChange={(checked) => field.onChange(checked === true ? [...field.value, b.code] : field.value.filter((c) => c !== b.code))}
                    label={name(b)}
                  />
                ))}
              </div>
            )}
          />
        </div>
      ) : null}

      <WizardFooter step={8} pending={pending} />
    </form>
  );
}
