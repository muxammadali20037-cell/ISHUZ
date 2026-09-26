"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, PenLine } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { DESCRIPTION_MAX, descriptionSchema, type DescriptionInput } from "../../../schema";
import { Description } from "../../description";
import { useSaveStep } from "../use-save-step";
import { WizardFooter } from "../wizard-footer";
import type { StepProps } from "../types";

/** 9-qadam: vazifalar (markdown-lite) + xavfsiz jonli ko'rinish */
export function StepDescription({ mode, vacancy }: StepProps) {
  const { t } = useT();
  const saver = useSaveStep(mode, vacancy.id, "description");
  const [preview, setPreview] = useState(false);
  const form = useForm<DescriptionInput>({ resolver: zodResolver(descriptionSchema), defaultValues: { description: vacancy.description ?? "" } });
  const text = useWatch({ control: form.control, name: "description" }) ?? "";
  const err = form.formState.errors.description?.message;
  const onSubmit = form.handleSubmit((data) => saver.save({ step: "description", data }));

  return (
    <form onSubmit={onSubmit} noValidate>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium">{t("vacancies.wizard.description.label")}</span>
        <div className="flex rounded-lg bg-secondary p-0.5" role="tablist">
          <button type="button" role="tab" aria-selected={!preview} onClick={() => setPreview(false)} className={cn("inline-flex h-8 items-center gap-1 rounded-md px-3 text-xs font-medium", !preview ? "bg-card shadow-sm" : "text-muted-foreground")}>
            <PenLine className="size-3.5" /> {t("vacancies.actions.show_editor")}
          </button>
          <button type="button" role="tab" aria-selected={preview} onClick={() => setPreview(true)} className={cn("inline-flex h-8 items-center gap-1 rounded-md px-3 text-xs font-medium", preview ? "bg-card shadow-sm" : "text-muted-foreground")}>
            <Eye className="size-3.5" /> {t("vacancies.actions.show_preview")}
          </button>
        </div>
      </div>

      {preview ? (
        <div className="min-h-[220px] rounded-2xl border border-border bg-card p-4">
          {text.trim() ? <Description text={text} /> : <p className="text-sm text-muted-foreground">{t("vacancies.wizard.description.empty_preview")}</p>}
        </div>
      ) : (
        <Field error={err ? t(err) : undefined} description={t("vacancies.wizard.description.hint")}>
          <Textarea rows={10} maxLength={DESCRIPTION_MAX} placeholder={t("vacancies.wizard.description.placeholder")} invalid={!!err} className="min-h-[220px] font-mono text-sm" {...form.register("description")} />
        </Field>
      )}
      <div className={cn("mt-1 text-right text-xs tabular", text.length > DESCRIPTION_MAX ? "text-destructive" : "text-muted-foreground")}>{t("vacancies.wizard.description.counter", { count: text.length, max: DESCRIPTION_MAX })}</div>

      <WizardFooter mode={mode} step="description" pending={saver.pending} onBack={saver.back} onSkip={saver.skip} />
    </form>
  );
}
