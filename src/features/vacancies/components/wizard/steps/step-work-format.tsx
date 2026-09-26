"use client";

import { useState } from "react";
import { FileCheck2, Handshake, Check } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import type { WorkFormatInput } from "../../../schema";
import { useSaveStep } from "../use-save-step";
import { WizardFooter } from "../wizard-footer";
import type { StepProps } from "../types";

/** 8-qadam: rasmiy / norasmiy; rasmiy bo'lsa — kafolatlanadigan shartlar (benefits.kind = official_term) */
export function StepWorkFormat({ mode, vacancy, refs }: StepProps) {
  const { t, tEnum, name } = useT();
  const saver = useSaveStep(mode, vacancy.id, "work_format");
  const [workFormat, setWorkFormat] = useState<WorkFormatInput["workFormat"]>(vacancy.work_format === "unofficial" ? "unofficial" : "official");
  const [terms, setTerms] = useState<Set<string>>(() => new Set(vacancy.official_terms));
  const officialTerms = refs.benefits.filter((b) => b.kind === "official_term");

  const options: { value: WorkFormatInput["workFormat"]; icon: typeof FileCheck2; desc: string }[] = [
    { value: "official", icon: FileCheck2, desc: t("vacancies.wizard.work_format.official_desc") },
    { value: "unofficial", icon: Handshake, desc: t("vacancies.wizard.work_format.unofficial_desc") },
  ];

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    saver.save({ step: "work_format", data: { workFormat, officialTerms: workFormat === "official" ? [...terms] : [] } });
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2" role="radiogroup">
        {options.map((o) => {
          const active = workFormat === o.value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setWorkFormat(o.value)}
              className={cn("flex items-start gap-3 rounded-2xl border bg-card p-4 text-left transition-colors", active ? "border-primary bg-primary-soft/60" : "border-border hover:border-primary/40 hover:bg-secondary")}
            >
              <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl", active ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground")}>
                <o.icon className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{tEnum("work_format", o.value)}</span>
                <span className="block text-xs text-muted-foreground">{o.desc}</span>
              </span>
              {active ? <Check className="size-5 text-primary" strokeWidth={3} /> : null}
            </button>
          );
        })}
      </div>

      {workFormat === "official" && officialTerms.length ? (
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="font-semibold">{t("vacancies.wizard.work_format.official_terms")}</div>
          <p className="mt-0.5 text-xs text-muted-foreground">{t("vacancies.wizard.work_format.official_terms_hint")}</p>
          <div className="mt-3 grid gap-1 sm:grid-cols-2">
            {officialTerms.map((b) => (
              <Checkbox
                key={b.code}
                label={name(b)}
                checked={terms.has(b.code)}
                onCheckedChange={(checked) =>
                  setTerms((prev) => {
                    const next = new Set(prev);
                    if (checked === true) next.add(b.code);
                    else next.delete(b.code);
                    return next;
                  })
                }
              />
            ))}
          </div>
        </div>
      ) : null}

      <WizardFooter mode={mode} step="work_format" pending={saver.pending} onBack={saver.back} onSkip={saver.skip} />
    </form>
  );
}
