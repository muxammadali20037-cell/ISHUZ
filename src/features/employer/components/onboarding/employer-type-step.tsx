"use client";

import { Building2, Briefcase, Check, HelpCircle, Home, Landmark, Store, type LucideIcon } from "lucide-react";
import { useId } from "react";
import { RadioGroup as RadioGroupPrimitive } from "radix-ui";
import { Input } from "@/components/ui/input";
import { useT } from "@/lib/i18n/client";
import { RadioGroup } from "@/components/ui/checkbox";
import { EMPLOYER_TYPES } from "../../schema";
import type { Enums } from "@/types/database.types";

export type EmployerType = Enums<"employer_type">;

const ICONS: Record<EmployerType, LucideIcon> = {
  company: Building2,
  government: Landmark,
  individual_entrepreneur: Store,
  self_employed: Briefcase,
  person: Home,
  other: HelpCircle,
};
const DESC: Record<EmployerType, string> = {
  company: "employer.onboarding.type_company_desc",
  government: "employer.onboarding.type_government_desc",
  individual_entrepreneur: "employer.onboarding.type_ie_desc",
  person: "employer.onboarding.type_person_desc",
  self_employed: "employer.onboarding.type_self_employed_desc",
  other: "employer.onboarding.type_other_desc",
};

/** 1-qadam: oltita karta (3×2, telefonda 2×3) */
export function EmployerTypeStep({
  value,
  onChange,
  disabled,
  note,
  onNoteChange,
}: {
  value: EmployerType | null;
  onChange: (v: EmployerType) => void;
  disabled?: boolean;
  note?: string;
  onNoteChange?: (v: string) => void;
}) {
  const { t, tEnum } = useT();
  const uid = useId();
  return (
    <RadioGroup
      value={value ?? ""}
      onValueChange={(v) => onChange(v as EmployerType)}
      className="grid grid-cols-2 gap-3 sm:grid-cols-3"
      disabled={disabled}
      aria-label={t("employer.onboarding.step_type_title")}
    >
      {/* 2026-11 ("Outreach" uslubi): 3×2 kartalar — chap yuqorida belgi katakchasi, markazda belgi, nom va qisqa izoh */}
      {EMPLOYER_TYPES.map((type) => {
        const Icon = ICONS[type];
        const id = `${uid}-${type}`;
        return (
          <label
            key={type}
            htmlFor={id}
            className="group relative flex cursor-pointer flex-col items-center rounded-2xl border-2 border-border bg-card px-3 pb-4 pt-9 text-center transition-colors hover:border-primary/40 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary-soft"
          >
            <RadioGroupPrimitive.Item
              id={id}
              value={type}
              className="absolute left-3 top-3 flex size-5 items-center justify-center rounded-md border border-input bg-card data-[state=checked]:border-primary data-[state=checked]:bg-primary disabled:opacity-50"
            >
              <RadioGroupPrimitive.Indicator className="flex items-center justify-center">
                <Check className="size-3.5 text-primary-foreground" strokeWidth={3} aria-hidden />
              </RadioGroupPrimitive.Indicator>
            </RadioGroupPrimitive.Item>
            <span className="flex size-14 items-center justify-center rounded-2xl bg-primary-soft text-primary group-has-[[data-state=checked]]:bg-card" aria-hidden>
              <Icon className="size-7" strokeWidth={1.6} />
            </span>
            <span className="mt-3 text-base font-semibold leading-tight">{tEnum("employer_type", type)}</span>
            <span className="mt-1 text-xs leading-snug text-muted-foreground">{t(DESC[type])}</span>
          </label>
        );
      })}
      {value === "other" && onNoteChange ? (
        <Input className="col-span-full" aria-label={t("employer.onboarding.type_other_note")} placeholder={t("employer.onboarding.type_other_note")} maxLength={120} value={note ?? ""} onChange={(e) => onNoteChange(e.target.value)} disabled={disabled} />
      ) : null}
    </RadioGroup>
  );
}
