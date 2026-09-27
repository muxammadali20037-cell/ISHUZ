"use client";

import { useEffect, useState } from "react";
import { TrendingUp } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { formatMoney } from "@/lib/format";
import type { Enums } from "@/types/database.types";
import { getSalaryInsight, type SalaryInsight } from "../../insights";

/**
 * "Shu lavozimdagi e'lonlarda odatda X–Y" — faqat yetarli haqiqiy ma'lumot bo'lsa ko'rinadi.
 * Bosilsa oraliq maydonlarga qo'yiladi.
 */
export function SalaryInsightHint({
  subcategoryId,
  regionId,
  salaryType,
  onApply,
}: {
  subcategoryId: string | null;
  regionId: string | null;
  salaryType: Enums<"salary_type"> | undefined;
  onApply: (from: number, to: number) => void;
}) {
  const { t, locale } = useT();
  const [insight, setInsight] = useState<{ key: string; data: SalaryInsight } | null>(null);
  const key = `${subcategoryId}|${regionId}|${salaryType}`;

  useEffect(() => {
    if (!subcategoryId || !salaryType || salaryType === "negotiable") return;
    let alive = true;
    getSalaryInsight({ subcategoryId, regionId, salaryType }).then((res) => {
      if (alive && res.ok && res.data) setInsight({ key, data: res.data });
    });
    return () => {
      alive = false;
    };
  }, [subcategoryId, regionId, salaryType, key]);

  if (!insight || insight.key !== key) return null;
  const d = insight.data;
  return (
    <button
      type="button"
      onClick={() => onApply(d.p25, d.p75)}
      className="flex w-full items-start gap-3 rounded-2xl border border-primary/30 bg-primary-soft/50 p-3 text-left text-sm transition-colors hover:bg-primary-soft active:scale-[0.99]"
    >
      <TrendingUp className="mt-0.5 size-5 shrink-0 text-primary" />
      <span className="min-w-0">
        <span className="block font-semibold">
          {t("vacancies.quality.salary_range", { from: formatMoney(d.p25, locale), to: formatMoney(d.p75, locale) })}
        </span>
        <span className="block text-xs text-muted-foreground">
          {t(d.scope === "region" ? "vacancies.quality.salary_basis_region" : "vacancies.quality.salary_basis_country", { count: d.sample })} · {t("vacancies.quality.salary_apply")}
        </span>
      </span>
    </button>
  );
}
