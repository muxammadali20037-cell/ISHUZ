"use client";

import { Fragment } from "react";
import { useT } from "@/lib/i18n/client";
import { formatSalaryRange } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Enums } from "@/types/database.types";

/** "10 000 000" kabi raqam guruhlari */
const AMOUNT = /(\d{1,3}(?: \d{3})+)/;

/**
 * Tor kartada qator faqat so'zlar orasida bo'linsin: "10 | 000 000" (raqam ichida) yoki "сум/ | мес" (birlik ichida)
 * bo'linmaydi. Har bo'lak qisqa (≤ ~10 belgi), shuning uchun katta shriftda ham karta chetidan chiqmaydi.
 */
export function SalaryParts({ text, suffix }: { text: string; suffix: string }) {
  const parts = text.split(AMOUNT);
  const last = parts.length - 1;
  return parts.map((part, i) => {
    if (i % 2 === 1) return <span key={i} className="whitespace-nowrap">{part}</span>;
    if (i !== last || !suffix) return <Fragment key={i}>{part}</Fragment>;
    // oxirgi so'z (valyuta) + "/oy" — bitta yaxlit bo'lak
    const cut = part.lastIndexOf(" ") + 1;
    return (
      <Fragment key={i}>
        {part.slice(0, cut)}
        <span className="whitespace-nowrap">
          {part.slice(cut)}
          <span className="font-normal text-muted-foreground">{suffix}</span>
        </span>
      </Fragment>
    );
  });
}

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
      : formatSalaryRange(from, to, locale, { negotiable: t("common.labels.negotiable"), from: t("common.labels.salary_from"), to: t("common.labels.salary_to") });
  const suffix = !negotiable && (from || to) && type && type !== "negotiable" ? tEnum("salary_type_suffix", type) : "";
  return (
    <span className={cn("font-semibold tabular", className)}>
      <SalaryParts text={text} suffix={suffix} />
    </span>
  );
}
