"use client";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useT } from "@/lib/i18n/client";
import type { Language } from "@/lib/reference";
import { Label } from "@/components/ui/label";
import { Question, QuestionProgress, useQuestionFlow } from "@/components/shared/question-flow";
import { saveSkills } from "../../actions";
import { skillsSchema, type SkillsInput } from "../../schema";
import type { DraftLanguage, DraftSkill, SkillOption, SkillQuestion } from "../../types";
import { ChipGroup } from "@/components/ui/chip";
import { LanguagePicker, SkillPicker } from "../skill-picker";
import { WizardFooter, fieldError, useStepSubmit } from "../wizard-shell";

export interface SkillsDraft {
  skills: DraftSkill[];
  languages: DraftLanguage[];
}

export function Step5Skills({
  draft,
  options,
  categoryId,
  languages,
  questions = [],
}: {
  draft: SkillsDraft;
  options: SkillOption[];
  categoryId: string | null;
  languages: Language[];
  /** Kasbga qarab savollar — har biri alohida ekranda, javob ko'nikma sifatida qo'shiladi */
  questions?: SkillQuestion[];
}) {
  const { t, name, locale } = useT();
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
      ...questions.map((q) => ({ id: `q-${q.id}`, fields: [] as ("skills" | "languages")[] })),
      { id: "skills", fields: ["skills"] },
      { id: "languages", fields: ["languages"] },
    ],
    trigger,
  );
  const extraNames = Object.fromEntries(draft.skills.map((s) => [s.skill_id, { name_uz: s.name_uz, name_ru: s.name_ru }]));

  /** Savol chiplari: tanlanganlar ko'nikmalar ro'yxatiga qo'shiladi / olib tashlanadi (daraja — "yaxshi") */
  const questionField = (q: SkillQuestion, value: SkillsInput["skills"], onChange: (v: SkillsInput["skills"]) => void) => {
    const ids = new Set(q.options.map((o) => o.id));
    const selected = value.filter((s) => ids.has(s.skill_id)).map((s) => s.skill_id);
    return (
      <ChipGroup
        multiple
        size="lg"
        options={q.options.map((o) => ({ value: o.id, label: name(o) }))}
        value={selected}
        onChange={(next) => {
          const chosen = new Set(Array.isArray(next) ? next : next ? [next] : []);
          const kept = value.filter((s) => !ids.has(s.skill_id) || chosen.has(s.skill_id));
          const added = [...chosen].filter((id) => !kept.some((s) => s.skill_id === id)).map((id) => ({ skill_id: id, level: "good" as const }));
          onChange([...kept, ...added].slice(0, 30));
        }}
      />
    );
  };

  return (
    <form noValidate onSubmit={flow.bindSubmit(handleSubmit((values) => submit(() => saveSkills(values)), flow.onInvalid))} className="space-y-6">
      <QuestionProgress flow={flow} />

      {questions.map((q) => (
        <Question key={q.id} show={flow.is(`q-${q.id}`)} className="space-y-0">
          <Label className="mb-2 text-xl font-semibold leading-snug sm:text-2xl">{locale === "ru" ? q.title_ru : q.title_uz}</Label>
          {(locale === "ru" ? q.hint_ru : q.hint_uz) ? <p className="-mt-1 mb-3 text-xs text-muted-foreground">{locale === "ru" ? q.hint_ru : q.hint_uz}</p> : null}
          <Controller control={control} name="skills" render={({ field }) => questionField(q, field.value, field.onChange)} />
          <p className="mt-3 text-xs text-muted-foreground">{t("onboarding.worker.skills.question_skip")}</p>
        </Question>
      ))}

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
