"use client";

import { Controller, useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, X } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ChipGroup } from "@/components/ui/chip";
import { Field } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { EDUCATION_LEVELS, EXPERIENCE_OPTIONS, GENDERS, LANGUAGE_LEVELS, MAX_LANGUAGES, requirementsSchema, type RequirementsInput } from "../../../schema";
import { useSaveStep } from "../use-save-step";
import { WizardFooter } from "../wizard-footer";
import type { StepProps } from "../types";

type GenderChoice = "any" | "male" | "female";

/** 6-qadam: tajriba, yosh, ta'lim, jins, til talablari */
export function StepRequirements({ mode, vacancy, refs }: StepProps) {
  const { t, tEnum } = useT();
  const saver = useSaveStep(mode, vacancy.id, "requirements");
  const form = useForm<RequirementsInput>({
    resolver: zodResolver(requirementsSchema),
    defaultValues: {
      experienceMinMonths: vacancy.experience_min_months,
      ageMin: vacancy.age_min,
      ageMax: vacancy.age_max,
      educationMin: vacancy.education_min,
      gender: vacancy.gender,
      languages: vacancy.languages.map((l) => ({ code: l.language_code, minLevel: l.min_level })),
    },
  });
  const languages = useFieldArray({ control: form.control, name: "languages" });
  const errors = form.formState.errors;
  const chosen = new Set(form.watch("languages").map((l) => l.code));
  const nextLanguage = refs.languages.find((l) => !chosen.has(l.code));
  const onSubmit = form.handleSubmit((data) => saver.save({ step: "requirements", data }));

  const numberField = (v: string) => (v === "" ? null : Number(v));

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <Field label={t("vacancies.wizard.requirements.experience")} htmlFor="experience">
        <Controller
          control={form.control}
          name="experienceMinMonths"
          render={({ field }) => (
            <Select id="experience" value={String(field.value)} onChange={(e) => field.onChange(Number(e.target.value))} options={EXPERIENCE_OPTIONS.map((m) => ({ value: String(m), label: tEnum("experience_min_months", String(m)) }))} />
          )}
        />
      </Field>

      <div>
        <div className="mb-1.5 text-sm font-medium">
          {t("vacancies.wizard.requirements.age")} <span className="text-xs font-normal text-muted-foreground">({t("common.labels.optional")})</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("vacancies.wizard.requirements.age_min")} htmlFor="age-min" error={errors.ageMin?.message ? t(errors.ageMin.message) : undefined}>
            <Input id="age-min" type="number" inputMode="numeric" min={14} max={80} placeholder="18" invalid={!!errors.ageMin} {...form.register("ageMin", { setValueAs: numberField })} />
          </Field>
          <Field label={t("vacancies.wizard.requirements.age_max")} htmlFor="age-max" error={errors.ageMax?.message ? t(errors.ageMax.message) : undefined}>
            <Input id="age-max" type="number" inputMode="numeric" min={14} max={80} placeholder="45" invalid={!!errors.ageMax} {...form.register("ageMax", { setValueAs: numberField })} />
          </Field>
        </div>
      </div>

      <Field label={t("vacancies.wizard.requirements.education")} htmlFor="education" hint={t("common.labels.optional")}>
        <Controller
          control={form.control}
          name="educationMin"
          render={({ field }) => (
            <Select id="education" value={field.value ?? ""} placeholder={t("vacancies.wizard.requirements.education_any")} onChange={(e) => field.onChange(e.target.value || null)} options={EDUCATION_LEVELS.map((v) => ({ value: v, label: tEnum("education_level", v) }))} />
          )}
        />
      </Field>

      <Field label={t("vacancies.wizard.requirements.gender")} hint={t("common.labels.optional")}>
        <Controller
          control={form.control}
          name="gender"
          render={({ field }) => (
            <ChipGroup<GenderChoice>
              options={[{ value: "any", label: t("vacancies.wizard.requirements.gender_any") }, ...GENDERS.map((g) => ({ value: g, label: tEnum("gender", g) }))]}
              value={field.value ?? "any"}
              onChange={(v) => field.onChange(v === "male" || v === "female" ? v : null)}
              size="lg"
            />
          )}
        />
      </Field>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-sm font-medium">
            {t("vacancies.wizard.requirements.languages")} <span className="text-xs font-normal text-muted-foreground">({t("common.labels.optional")})</span>
          </span>
          {nextLanguage && languages.fields.length < MAX_LANGUAGES ? (
            <Button type="button" variant="soft" size="sm" onClick={() => languages.append({ code: nextLanguage.code, minLevel: "b1" })}>
              <Plus className="size-4" /> {t("vacancies.actions.add_language")}
            </Button>
          ) : null}
        </div>
        {languages.fields.length ? (
          <div className="space-y-2">
            {languages.fields.map((row, i) => (
              <div key={row.id} className="flex items-start gap-2">
                <div className="flex-1">
                  <Controller
                    control={form.control}
                    name={`languages.${i}.code`}
                    render={({ field }) => (
                      <Select aria-label={t("vacancies.wizard.requirements.language")} value={field.value} onChange={(e) => field.onChange(e.target.value)} invalid={!!errors.languages?.[i]?.code} options={refs.languages.map((l) => ({ value: l.code, label: tEnum("language_code", l.code) || l.name_uz }))} />
                    )}
                  />
                  {errors.languages?.[i]?.code?.message ? <p className="mt-1 text-xs text-destructive">{t(errors.languages[i]?.code?.message ?? "")}</p> : null}
                </div>
                <div className="flex-1">
                  <Controller
                    control={form.control}
                    name={`languages.${i}.minLevel`}
                    render={({ field }) => (
                      <Select aria-label={t("vacancies.wizard.requirements.level")} value={field.value} onChange={(e) => field.onChange(e.target.value)} options={LANGUAGE_LEVELS.map((lv) => ({ value: lv, label: tEnum("language_level", lv) }))} />
                    )}
                  />
                </div>
                <Button type="button" variant="ghost" size="icon" aria-label={t("vacancies.actions.remove")} onClick={() => languages.remove(i)}>
                  <X className="size-5" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t("vacancies.wizard.requirements.no_languages")}</p>
        )}
      </div>

      <WizardFooter mode={mode} step="requirements" pending={saver.pending} onBack={saver.back} onSkip={saver.skip} />
    </form>
  );
}
