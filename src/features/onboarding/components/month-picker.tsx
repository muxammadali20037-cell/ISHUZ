"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n/client";
import { Select } from "@/components/ui/select";
import { yearOptions } from "../utils";

/**
 * Oy + yil tanlash ("YYYY-MM"). Ikki native select — mobil uchun eng qulay.
 * Ikkalasi ham tanlanmaguncha null qaytaradi.
 */
export function MonthPicker({
  id,
  value,
  onChange,
  minYear = 1970,
  maxYear = new Date().getFullYear(),
  invalid,
}: {
  id?: string;
  value: string | null;
  onChange: (value: string | null) => void;
  minYear?: number;
  maxYear?: number;
  invalid?: boolean;
}) {
  const { t } = useT();
  const [local, setLocal] = useState(() => {
    const [y = "", m = ""] = value ? value.split("-") : [];
    return { y, m };
  });
  const months = Array.from({ length: 12 }, (_, i) => {
    const mm = String(i + 1).padStart(2, "0");
    return { value: mm, label: t(`onboarding.worker.months.${i + 1}`) };
  });
  const years = yearOptions(minYear, maxYear).map((y) => ({ value: String(y), label: String(y) }));
  const update = (next: { y: string; m: string }) => {
    setLocal(next);
    onChange(next.y && next.m ? `${next.y}-${next.m}` : null);
  };
  return (
    <div className="grid grid-cols-2 gap-2">
      <Select id={id} options={months} placeholder={t("onboarding.worker.common.month")} value={local.m} invalid={invalid} onChange={(e) => update({ ...local, m: e.target.value })} />
      <Select options={years} placeholder={t("onboarding.worker.common.year")} value={local.y} invalid={invalid} onChange={(e) => update({ ...local, y: e.target.value })} />
    </div>
  );
}
