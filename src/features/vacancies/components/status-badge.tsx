"use client";

import { useT } from "@/lib/i18n/client";
import { Badge } from "@/components/ui/badge";
import { STATUS_TONE } from "../status";
import type { VacancyStatus } from "../types";

export function VacancyStatusBadge({ status, size, className }: { status: VacancyStatus; size?: "default" | "sm" | "lg"; className?: string }) {
  const { tEnum } = useT();
  return (
    <Badge variant={STATUS_TONE[status]} size={size} className={className}>
      {tEnum("vacancy_status", status)}
    </Badge>
  );
}
