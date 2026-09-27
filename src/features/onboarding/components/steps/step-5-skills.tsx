"use client";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useT } from "@/lib/i18n/client";
import type { Language } from "@/lib/reference";
import { Label } from "@/components/ui/label";
import { Question, QuestionProgress, useQuestionFlow } from "@/components/shared/question-flow";
import { saveSkills } from "../../actions";
import { skillsSchema, type SkillsInput } from "../../schema";
import type { DraftLanguage, DraftSkill, SkillOption } from "../../types";
import { LanguagePicker, SkillPicker } from "../skill-picker";
import { WizardFooter, fieldError, useStepSubmit } from "../wizard-shell";

export interface SkillsDraft {
  skills: DraftSkill[];
  languages: DraftLanguage[];
}

export function Step5Skills({ draft, options, categoryId, languages }: { draft: SkillsDraft; options: SkillOption[]; categoryId: string | null; languages: Language[] }) {
  const { t } = useT();
  const { pending, submit } = useStepSubmit();
  const {
    control,
    handleSubmit,
    trigger,
    formState: { errors },
  } = useForm<SkillsInput>({
    resolver: zodResolver(skillsSchema),
    defaultValues: {
      skills: draft.skills.map((s) => ({ skill_id: s.skill_id, level: s.level })),
      languages: draft.languages.length ? draft.languages : [{ language_code: "uz", level: "native" }],
    },
  });
  const flow = useQuestionFlow<SkillsInput>(
    [
      { id: "skills", fields: ["skills"] },
      { id: "languages", fields: ["languages"] },
    ],
    trigger,
  );
  const extraNames = Object.fromEntries(draft.skills.map((s) => [s.skill_id, { name_uz: s.name_uz, name_ru: s.name_ru }]));

  return (
    <form noValidate onSubmit={flow.bindSubmit(handleSubmit((values) => submit(() => saveSkills(values)), flow.onInvalid))} className="space-y-6">
      <QuestionProgress flow={flow} />

      <Question show={flow.is("skills")} className="space-y-0">
        <Label required className="mb-2 text-xl font-semibold leading-snug sm:text-2xl">
          {t("onboarding.worker.skills.title")}
        </Label>
        <p className="-mt-1 mb-3 text-xs text-muted-foreground">{t("onboarding.worker.skills.hint")}</p>
        <Controller
          control={control}
          name="skills"
          render={({ field }) => <SkillPicker options={options} categoryId={categoryId} value={field.value} onChange={field.onChange} extraNames={extraNames} invalid={!!errors.skills} />}
        />
        {fieldError(t, errors.skills) ? (
          <p className="mt-2 text-sm text-destructive" role="alert">
            {fieldError(t, errors.skills)}
          </p>
        ) : null}
      </Question>

      <Question show={flow.is("languages")} className="space-y-0">
        <Label required className="mb-2 text-xl font-semibold leading-snug sm:text-2xl">
          {t("onboarding.worker.skills.languages_title")}
        </Label>
        <p className="-mt-1 mb-3 text-xs text-muted-foreground">{t("onboarding.worker.skills.languages_hint")}</p>
        <Controller control={control} name="languages" render={({ field }) => <LanguagePicker languages={languages} value={field.value} onChange={field.onChange} invalid={!!errors.languages} />} />
        {fieldError(t, errors.languages) ? (
          <p className="mt-2 text-sm text-destructive" role="alert">
            {fieldError(t, errors.languages)}
          </p>
        ) : null}
      </Question>

      <WizardFooter step={5} pending={pending} onBack={flow.isFirst ? undefined : flow.back} continueLabel={flow.isLast ? undefined : t("common.actions.next")} />
    </form>
  );
}
