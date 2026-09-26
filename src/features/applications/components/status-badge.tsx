"use client";

import { Badge } from "@/components/ui/badge";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { STATUS_TONE, type ApplicationStatus } from "../types";
import { TONE_BADGE, TONE_DOT } from "./tone";

/** Ariza holati nishoni (rang: sent/viewed ko'k, shortlisted/interview primary, offered/hired success, rejected qizil, withdrawn kulrang) */
export function ApplicationStatusBadge({ status, size, className, label }: { status: ApplicationStatus; size?: "sm" | "default" | "lg"; className?: string; label?: string }) {
  const { tEnum } = useT();
  const tone = STATUS_TONE[status];
  return (
    <Badge size={size} className={cn(TONE_BADGE[tone], className)}>
      <span className={cn("size-1.5 shrink-0 rounded-full", TONE_DOT[tone])} aria-hidden />
      {label ?? tEnum("application_status", status)}
    </Badge>
  );
}
