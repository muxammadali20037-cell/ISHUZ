"use client";

import { useT } from "@/lib/i18n/client";
import { formatSalaryRange } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Enums } from "@/types/database.types";

/** "5 000 000 – 7 000 000 so'm/oy" yoki "Kelishiladi" */
export function SalaryText({
  from,
  to,
  type,
  negotiable,
  className,
}: {
  from: number | null | undefined;
  to: number | null | undefined;
  type?: Enums<"salary_type"> | null;
  negotiable?: boolean | null;
  className?: string;
}) {
  const { t, tEnum, locale } = useT();
  const text =
    negotiable || (!from && !to)
      ? t("common.labels.negotiable")
      : formatSalaryRange(from, to, locale, { negotiable: t("common.labels.negotiable"), from: t("common.labels.from"), to: t("common.labels.to") });
  const suffix = !negotiable && (from || to) && type && type !== "negotiable" ? tEnum("salary_type_suffix", type) : "";
  return (
    <span className={cn("font-semibold tabular", className)}>
      {text}
      {suffix ? <span className="font-normal text-muted-foreground">{suffix}</span> : null}
    </span>
  );
}
