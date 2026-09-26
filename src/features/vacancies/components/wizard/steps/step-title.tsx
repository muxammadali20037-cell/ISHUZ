"use client";

import { useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Sparkles } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";
import { createDraft } from "../../../actions";
import { titleSchema, type TitleInput } from "../../../schema";
import { wizardHref, type WizardMode } from "../../../steps";
import type { VacancyFull } from "../../../types";
import { errorMessage } from "../../../utils";
import { useSaveStep } from "../use-save-step";
import { WizardFooter } from "../wizard-footer";
import type { WizardRefs } from "../types";

const MAX_SUGGESTIONS = 6;

/**
 * 1-qadam: lavozim nomi. Yozish paytida yo'nalishlar (subcategories) nomidan takliflar chiqadi.
 * Yangi vakansiyada "Davom etish" qoralama yaratadi (server action) va ?id= bilan 2-qadamga o'tadi.
 */
export function StepTitle({ mode, vacancy, refs }: { mode: WizardMode; vacancy: VacancyFull | null; refs: WizardRefs }) {
  const { t, name } = useT();
  const router = useRouter();
  const [creating, startCreate] = useTransition();
  const saver = useSaveStep(mode, vacancy?.id ?? "", "title");
  const form = useForm<TitleInput>({
    resolver: zodResolver(titleSchema),
    defaultValues: { title: vacancy?.title ?? "", subcategoryId: null },
  });
  const title = useWatch({ control: form.control, name: "title" });
  const pickedSub = useWatch({ control: form.control, name: "subcategoryId" });

  const suggestions = useMemo(() => {
    const q = title.trim().toLowerCase();
    if (q.length < 2) return [];
    const catById = new Map(refs.categories.map((c) => [c.id, c]));
    return refs.subcategories
      .map((s) => ({ id: s.id, label: name(s), category: catById.get(s.category_id) }))
      .filter((s) => s.label.toLowerCase().includes(q) && s.label.toLowerCase() !== q)
      .slice(0, MAX_SUGGESTIONS);
  }, [title, refs.subcategories, refs.categories, name]);

  const onSubmit = form.handleSubmit((data) => {
    if (!vacancy) {
      startCreate(async () => {
        const res = await createDraft(data);
        if (!res.ok || !res.data) {
          toast.error(errorMessage(t, res.ok ? "generic" : res.error));
          return;
        }
        router.push(wizardHref("create", res.data.id, "category"));
      });
      return;
    }
    saver.save({ step: "title", data });
  });

  const pending = creating || saver.pending;
  const err = form.formState.errors.title?.message;

  return (
    <form onSubmit={onSubmit} noValidate>
      <Field label={t("vacancies.wizard.title.label")} htmlFor="vacancy-title" required error={err ? t(err) : undefined}>
        <Input
          id="vacancy-title"
          autoFocus
          maxLength={120}
          placeholder={t("vacancies.wizard.title.placeholder")}
          invalid={!!err}
          className="h-14 text-lg"
          {...form.register("title", { onChange: () => form.setValue("subcategoryId", null) })}
        />
      </Field>

      {suggestions.length ? (
        <div className="mt-4">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Sparkles className="size-3.5" /> {t("vacancies.wizard.title.suggestions")}
          </div>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  form.setValue("title", s.label, { shouldValidate: true });
                  form.setValue("subcategoryId", s.id);
                }}
                className="inline-flex h-11 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-medium hover:border-primary/40 hover:bg-secondary"
              >
                {s.label}
                {s.category ? <span className="text-xs text-muted-foreground">· {name(s.category)}</span> : null}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{t("vacancies.wizard.title.suggestion_hint")}</p>
        </div>
      ) : pickedSub ? (
        <p className="mt-3 text-xs text-success">{t("vacancies.wizard.title.suggestion_hint")}</p>
      ) : null}

      <WizardFooter mode={mode} step="title" pending={pending} onBack={saver.back} />
    </form>
  );
}
