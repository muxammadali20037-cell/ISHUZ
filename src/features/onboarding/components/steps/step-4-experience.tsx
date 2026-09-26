"use client";

import { Controller, useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Briefcase, Plus, Trash2 } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { Constants, type Enums } from "@/types/database.types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ChipGroup } from "@/components/ui/chip";
import { Input, Textarea } from "@/components/ui/input";
import { Field, Label } from "@/components/ui/label";
import { saveExperience } from "../../actions";
import { experienceSchema, type ExperienceEntryInput, type ExperienceInput } from "../../schema";
import type { DraftExperience } from "../../types";
import { dateToMonth } from "../../utils";
import { MonthPicker } from "../month-picker";
import { WizardFooter, fieldError, singleValue, useStepSubmit } from "../wizard-shell";

export interface ExperienceDraft {
  experience_level: Enums<"experience_level"> | null;
  entries: DraftExperience[];
}

const EMPTY_ENTRY: ExperienceEntryInput = { company_name: "", position: "", started_on: "", ended_on: null, is_current: false, responsibilities: "", achievements: "" };

export function Step4Experience({ draft }: { draft: ExperienceDraft }) {
  const { t, tEnum } = useT();
  const { pending, submit } = useStepSubmit();
  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ExperienceInput>({
    resolver: zodResolver(experienceSchema),
    defaultValues: {
      experience_level: draft.experience_level ?? undefined,
      entries: draft.entries.map((e) => ({
        company_name: e.company_name,
        position: e.position,
        started_on: dateToMonth(e.started_on) ?? "",
        ended_on: dateToMonth(e.ended_on),
        is_current: e.is_current,
        responsibilities: e.responsibilities ?? "",
        achievements: e.achievements ?? "",
      })),
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "entries" });
  const level = watch("experience_level");
  const showEntries = !!level && level !== "none";

  return (
    <form noValidate onSubmit={handleSubmit((values) => submit(() => saveExperience(values)))} className="space-y-6">
      <Field label={t("onboarding.worker.experience.level")} required error={fieldError(t, errors.experience_level)}>
        <Controller
          control={control}
          name="experience_level"
          render={({ field }) => (
            <ChipGroup
              size="lg"
              options={Constants.public.Enums.experience_level.map((v) => ({ value: v, label: tEnum("experience_level", v) }))}
              value={field.value ?? null}
              onChange={(v) => field.onChange(singleValue(v))}
            />
          )}
        />
      </Field>

      {showEntries ? (
        <div className="space-y-4">
          <div>
            <Label hint={t("common.labels.optional")}>{t("onboarding.worker.experience.entries_title")}</Label>
            <p className="-mt-1 text-xs text-muted-foreground">{t("onboarding.worker.experience.entries_hint")}</p>
          </div>

          {fields.map((item, i) => {
            const isCurrent = watch(`entries.${i}.is_current`);
            const entryErrors = errors.entries?.[i];
            return (
              <div key={item.id} className="space-y-4 rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center justify-between">
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    <Briefcase className="size-4 text-primary" />
                    {t("onboarding.worker.experience.entry_n", { n: i + 1 })}
                  </p>
                  <Button type="button" variant="ghost" size="icon-sm" onClick={() => remove(i)} aria-label={t("common.actions.delete")}>
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={t("onboarding.worker.experience.company")} htmlFor={`company-${i}`} required error={fieldError(t, entryErrors?.company_name)}>
                    <Input id={`company-${i}`} placeholder={t("onboarding.worker.experience.company_placeholder")} invalid={!!entryErrors?.company_name} {...register(`entries.${i}.company_name`)} />
                  </Field>
                  <Field label={t("onboarding.worker.experience.position")} htmlFor={`position-${i}`} required error={fieldError(t, entryErrors?.position)}>
                    <Input id={`position-${i}`} placeholder={t("onboarding.worker.experience.position_placeholder")} invalid={!!entryErrors?.position} {...register(`entries.${i}.position`)} />
                  </Field>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={t("onboarding.worker.experience.started")} required error={fieldError(t, entryErrors?.started_on)}>
                    <Controller
                      control={control}
                      name={`entries.${i}.started_on`}
                      render={({ field }) => <MonthPicker value={field.value || null} onChange={(v) => field.onChange(v ?? "")} invalid={!!entryErrors?.started_on} />}
                    />
                  </Field>
                  {!isCurrent ? (
                    <Field label={t("onboarding.worker.experience.ended")} required error={fieldError(t, entryErrors?.ended_on)}>
                      <Controller control={control} name={`entries.${i}.ended_on`} render={({ field }) => <MonthPicker value={field.value} onChange={field.onChange} invalid={!!entryErrors?.ended_on} />} />
                    </Field>
                  ) : null}
                </div>
                <Controller
                  control={control}
                  name={`entries.${i}.is_current`}
                  render={({ field }) => (
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={(checked) => {
                        const v = checked === true;
                        field.onChange(v);
                        if (v) setValue(`entries.${i}.ended_on`, null, { shouldValidate: true });
                      }}
                      label={t("onboarding.worker.experience.is_current")}
                    />
                  )}
                />
                <Field label={t("onboarding.worker.experience.responsibilities")} htmlFor={`resp-${i}`} hint={t("common.labels.optional")} error={fieldError(t, entryErrors?.responsibilities)}>
                  <Textarea id={`resp-${i}`} className="min-h-[80px]" maxLength={1000} placeholder={t("onboarding.worker.experience.responsibilities_placeholder")} {...register(`entries.${i}.responsibilities`)} />
                </Field>
                <Field label={t("onboarding.worker.experience.achievements")} htmlFor={`ach-${i}`} hint={t("common.labels.optional")} error={fieldError(t, entryErrors?.achievements)}>
                  <Textarea id={`ach-${i}`} className="min-h-[80px]" maxLength={1000} placeholder={t("onboarding.worker.experience.achievements_placeholder")} {...register(`entries.${i}.achievements`)} />
                </Field>
              </div>
            );
          })}

          {fields.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border px-4 py-6 text-center">
              <Briefcase className="mx-auto size-8 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">{t("onboarding.worker.experience.empty")}</p>
            </div>
          ) : null}

          {fields.length < 20 ? (
            <Button type="button" variant="outline" fullWidth onClick={() => append({ ...EMPTY_ENTRY })}>
              <Plus className="size-4" />
              {t("onboarding.worker.experience.add")}
            </Button>
          ) : null}
        </div>
      ) : null}

      <WizardFooter step={4} pending={pending} />
    </form>
  );
}
