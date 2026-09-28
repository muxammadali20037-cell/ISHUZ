"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useT } from "@/lib/i18n/client";
import type { Category } from "@/lib/reference";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Question, QuestionProgress, useQuestionFlow } from "@/components/shared/question-flow";
import { ProfessionPicker } from "@/features/professions/components/profession-picker";
import type { PickedProfession, TrailItem } from "@/features/professions/types";
import { saveProfession } from "../../actions";
import { professionSchema, type ProfessionInput } from "../../schema";
import { WizardFooter, fieldError, useStepSubmit } from "../wizard-shell";

export interface ProfessionDraft {
  category_id: string | null;
  subcategory_id: string | null;
  profession_node_id: string | null;
  headline: string | null;
  /** tanlangan tugunning yo'li (server tayyorlaydi) */
  trail: TrailItem[];
}

/**
 * 3-qadam: kasb. 1) Soha → ... → aniq kasb (daraxt, qidiruv bilan). 2) Sarlavha (kasb nomidan avtomatik).
 */
export function Step3Profession({ draft, categories }: { draft: ProfessionDraft; categories: Category[] }) {
  const { t, name } = useT();
  const { pending, submit } = useStepSubmit();
  const initial: PickedProfession | null =
    draft.profession_node_id && draft.category_id && draft.trail.length ? { id: draft.profession_node_id, categoryId: draft.category_id, trail: draft.trail } : null;
  const [picked, setPicked] = useState<PickedProfession | null>(initial);
  const [autoHeadline, setAutoHeadline] = useState<string | null>(() => {
    const last = initial?.trail.at(-1);
    return last && name(last) === draft.headline ? draft.headline : null;
  });
  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    trigger,
    formState: { errors },
  } = useForm<ProfessionInput>({
    resolver: zodResolver(professionSchema),
    defaultValues: {
      category_id: initial?.categoryId ?? "",
      subcategory_id: null,
      profession_node_id: initial?.id ?? null,
      headline: draft.headline ?? "",
    },
  });
  const flow = useQuestionFlow<ProfessionInput>(
    [
      { id: "profession", fields: ["category_id"] },
      { id: "headline", fields: ["headline"] },
    ],
    trigger,
  );

  const pick = (p: PickedProfession) => {
    setPicked(p);
    setValue("category_id", p.categoryId, { shouldValidate: true });
    setValue("profession_node_id", p.id);
    setValue("subcategory_id", null);
    const label = p.trail.at(-1) ? name(p.trail.at(-1)!) : "";
    const current = getValues("headline").trim();
    if (label && (!current || current === autoHeadline)) {
      setValue("headline", label.slice(0, 80), { shouldValidate: true });
      setAutoHeadline(label.slice(0, 80));
    }
    flow.advance();
  };

  return (
    <form noValidate onSubmit={flow.bindSubmit(handleSubmit((values) => submit(() => saveProfession(values)), flow.onInvalid))} className="space-y-6">
      <QuestionProgress flow={flow} />

      <Question show={flow.is("profession")} className="space-y-3">
        <ProfessionPicker categories={categories} value={picked} onChange={pick} title={t("professions.worker_title")} subtitle={t("professions.worker_sub")} />
        {fieldError(t, errors.category_id) ? (
          <p className="text-sm text-destructive" role="alert">
            {t("professions.pick_required")}
          </p>
        ) : null}
      </Question>

      {flow.is("headline") ? (
        <div className="space-y-5">
          {picked ? <ProfessionPicker categories={categories} value={picked} onChange={pick} /> : null}
          <Field label={t("onboarding.worker.profession.headline")} htmlFor="headline" required error={fieldError(t, errors.headline)} description={t("onboarding.worker.profession.headline_hint")}>
            <Input id="headline" className="h-14 text-base" placeholder={t("onboarding.worker.profession.headline_placeholder")} maxLength={80} invalid={!!errors.headline} {...register("headline")} />
          </Field>
        </div>
      ) : null}

      <WizardFooter step={3} pending={pending} onBack={flow.isFirst ? undefined : flow.back} continueLabel={flow.isLast ? undefined : t("common.actions.next")} />
    </form>
  );
}
