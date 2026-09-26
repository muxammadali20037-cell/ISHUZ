"use client";

import { Controller, useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { GraduationCap, Plus, Trash2 } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { Constants, type Enums } from "@/types/database.types";
import { Button } from "@/components/ui/button";
import { ChipGroup } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { Field, Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { saveEducation, skipStep } from "../../actions";
import { educationSchema, type EducationEntryInput, type EducationInput } from "../../schema";
import type { DraftEducation } from "../../types";
import { yearOptions } from "../../utils";
import { WizardFooter, fieldError, singleValue, useStepSubmit } from "../wizard-shell";

export interface EducationDraft {
  level: Enums<"education_level"> | null;
  entries: DraftEducation[];
}

const EMPTY_ENTRY: EducationEntryInput = { institution: "", field: "", started_year: null, ended_year: null };

export function Step6Education({ draft }: { draft: EducationDraft }) {
  const { t, tEnum } = useT();
  const { pending, submit } = useStepSubmit();
  const currentYear = new Date().getFullYear();
  const years = yearOptions(1960, currentYear + 6).map((y) => ({ value: String(y), label: String(y) }));
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<EducationInput>({
    resolver: zodResolver(educationSchema),
    defaultValues: {
      level: draft.level ?? undefined,
      entries: draft.entries
        .filter((e) => e.institution)
        .map((e) => ({ institution: e.institution ?? "", field: e.field ?? "", started_year: e.started_year, ended_year: e.ended_year })),
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "entries" });

  return (
    <form noValidate onSubmit={handleSubmit((values) => submit(() => saveEducation(values)))} className="space-y-6">
      <Field label={t("onboarding.worker.education.level")} required error={fieldError(t, errors.level)}>
        <Controller
          control={control}
          name="level"
          render={({ field }) => (
            <ChipGroup
              size="lg"
              options={Constants.public.Enums.education_level.map((v) => ({ value: v, label: tEnum("education_level", v) }))}
              value={field.value ?? null}
              onChange={(v) => field.onChange(singleValue(v))}
            />
          )}
        />
      </Field>

      <div className="space-y-4">
        <div>
          <Label hint={t("common.labels.optional")}>{t("onboarding.worker.education.entries_title")}</Label>
          <p className="-mt-1 text-xs text-muted-foreground">{t("onboarding.worker.education.entries_hint")}</p>
        </div>

        {fields.map((item, i) => {
          const entryErrors = errors.entries?.[i];
          return (
            <div key={item.id} className="space-y-4 rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <GraduationCap className="size-4 text-primary" />
                  {t("onboarding.worker.education.entry_n", { n: i + 1 })}
                </p>
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => remove(i)} aria-label={t("common.actions.delete")}>
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
              <Field label={t("onboarding.worker.education.institution")} htmlFor={`inst-${i}`} required error={fieldError(t, entryErrors?.institution)}>
                <Input id={`inst-${i}`} placeholder={t("onboarding.worker.education.institution_placeholder")} invalid={!!entryErrors?.institution} {...register(`entries.${i}.institution`)} />
              </Field>
              <Field label={t("onboarding.worker.education.field")} htmlFor={`field-${i}`} hint={t("common.labels.optional")} error={fieldError(t, entryErrors?.field)}>
                <Input id={`field-${i}`} placeholder={t("onboarding.worker.education.field_placeholder")} {...register(`entries.${i}.field`)} />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label={t("onboarding.worker.education.started_year")} error={fieldError(t, entryErrors?.started_year)}>
                  <Controller
                    control={control}
                    name={`entries.${i}.started_year`}
                    render={({ field }) => (
                      <Select options={years} placeholder={t("onboarding.worker.common.year")} value={field.value === null ? "" : String(field.value)} onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)} />
                    )}
                  />
                </Field>
                <Field label={t("onboarding.worker.education.ended_year")} error={fieldError(t, entryErrors?.ended_year)}>
                  <Controller
                    control={control}
                    name={`entries.${i}.ended_year`}
                    render={({ field }) => (
                      <Select
                        options={years}
                        placeholder={t("onboarding.worker.common.year")}
                        value={field.value === null ? "" : String(field.value)}
                        invalid={!!entryErrors?.ended_year}
                        onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                      />
                    )}
                  />
                </Field>
              </div>
            </div>
          );
        })}

        {fields.length < 10 ? (
          <Button type="button" variant="outline" fullWidth onClick={() => append({ ...EMPTY_ENTRY })}>
            <Plus className="size-4" />
            {t("onboarding.worker.education.add")}
          </Button>
        ) : null}
      </div>

      <WizardFooter step={6} pending={pending} onSkip={() => submit(() => skipStep({ step: 6 }))} />
    </form>
  );
}
