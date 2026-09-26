"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { useSaveStep } from "../use-save-step";
import { WizardFooter } from "../wizard-footer";
import type { StepProps } from "../types";

/** 10-qadam: qo'shimcha imkoniyatlar (benefits.kind = benefit) — katta checkbox-kartalar */
export function StepBenefits({ mode, vacancy, refs }: StepProps) {
  const { t, name } = useT();
  const saver = useSaveStep(mode, vacancy.id, "benefits");
  const [selected, setSelected] = useState<Set<string>>(() => new Set(vacancy.benefits));
  const benefits = refs.benefits.filter((b) => b.kind === "benefit");

  const toggle = (code: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    saver.save({ step: "benefits", data: { benefits: [...selected] } });
  };

  return (
    <form onSubmit={submit} noValidate>
      <div className="mb-3 flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{t("vacancies.wizard.benefits.hint")}</span>
        <span className="font-medium">{t("vacancies.wizard.benefits.selected", { count: selected.size })}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="group">
        {benefits.map((b) => {
          const active = selected.has(b.code);
          return (
            <button
              key={b.code}
              type="button"
              role="checkbox"
              aria-checked={active}
              onClick={() => toggle(b.code)}
              className={cn("flex min-h-14 items-center gap-2 rounded-2xl border bg-card px-3 py-2 text-left text-sm font-medium transition-colors", active ? "border-primary bg-primary-soft/60 text-primary" : "border-border hover:border-primary/40 hover:bg-secondary")}
            >
              <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-md border", active ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card")}>{active ? <Check className="size-4" strokeWidth={3} /> : null}</span>
              {name(b)}
            </button>
          );
        })}
      </div>

      <WizardFooter mode={mode} step="benefits" pending={saver.pending} onBack={saver.back} onSkip={saver.skip} />
    </form>
  );
}
