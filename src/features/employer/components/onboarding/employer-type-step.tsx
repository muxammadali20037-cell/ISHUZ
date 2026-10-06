"use client";

import { Building2, Briefcase, HelpCircle, Home, Landmark, Store, type LucideIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useT } from "@/lib/i18n/client";
import { RadioGroup, RadioItem } from "@/components/ui/checkbox";
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

/** 1-qadam: uchta katta karta (RadioItem) */
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
  return (
    <RadioGroup value={value ?? ""} onValueChange={(v) => onChange(v as EmployerType)} className="space-y-3" disabled={disabled} aria-label={t("employer.onboarding.step_type_title")}>
      {EMPLOYER_TYPES.map((type) => {
        const Icon = ICONS[type];
        return (
          <RadioItem
            key={type}
            value={type}
            className="p-4 sm:p-5"
            label={
              <span className="flex items-center gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                  <Icon className="size-5.5" />
                </span>
                <span className="text-base font-semibold">{tEnum("employer_type", type)}</span>
              </span>
            }
            description={t(DESC[type])}
          />
        );
      })}
      {value === "other" && onNoteChange ? (
        <Input aria-label={t("employer.onboarding.type_other_note")} placeholder={t("employer.onboarding.type_other_note")} maxLength={120} value={note ?? ""} onChange={(e) => onNoteChange(e.target.value)} disabled={disabled} />
      ) : null}
    </RadioGroup>
  );
}
