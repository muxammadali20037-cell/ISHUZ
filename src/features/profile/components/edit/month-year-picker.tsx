"use client";

import { useMemo } from "react";
import { format } from "date-fns";
import { ru as ruLocale, uz as uzLocale } from "date-fns/locale";
import { useT } from "@/lib/i18n/client";
import { Select } from "@/components/ui/select";
import { yearOptions } from "./form-utils";

export type MonthYear = { year: number | null; month: number | null };

/** Oy + yil tanlovi (Safari'da type="month" yo'q; ikkita native select) */
export function MonthYearPicker({ value, onChange, disabled, invalid, minYear = 1970 }: { value: MonthYear; onChange: (v: MonthYear) => void; disabled?: boolean; invalid?: boolean; minYear?: number }) {
  const { t, locale } = useT();
  const months = useMemo(() => {
    const l = locale === "ru" ? ruLocale : uzLocale;
    return Array.from({ length: 12 }, (_, i) => {
      const label = format(new Date(2000, i, 1), "LLLL", { locale: l });
      return { value: String(i + 1), label: label.charAt(0).toUpperCase() + label.slice(1) };
    });
  }, [locale]);
  const years = useMemo(() => yearOptions(minYear, new Date().getFullYear()), [minYear]);
  return (
    <div className="grid grid-cols-2 gap-2">
      <Select
        aria-label={t("profile.labels.month")}
        options={months}
        placeholder={t("profile.labels.month")}
        value={value.month ? String(value.month) : ""}
        onChange={(e) => onChange({ ...value, month: e.target.value ? Number(e.target.value) : null })}
        disabled={disabled}
        invalid={invalid}
      />
      <Select
        aria-label={t("profile.labels.year")}
        options={years}
        placeholder={t("profile.labels.year")}
        value={value.year ? String(value.year) : ""}
        onChange={(e) => onChange({ ...value, year: e.target.value ? Number(e.target.value) : null })}
        disabled={disabled}
        invalid={invalid}
      />
    </div>
  );
}
