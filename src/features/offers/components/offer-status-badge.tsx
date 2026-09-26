"use client";

import { Badge } from "@/components/ui/badge";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { TONE_BADGE, TONE_DOT } from "@/features/applications/components/tone";
import { OFFER_STATUS_TONE, type OfferStatus } from "../types";

export function OfferStatusBadge({ status, size, className, label }: { status: OfferStatus; size?: "sm" | "default" | "lg"; className?: string; label?: string }) {
  const { tEnum } = useT();
  const tone = OFFER_STATUS_TONE[status];
  return (
    <Badge size={size} className={cn(TONE_BADGE[tone], className)}>
      <span className={cn("size-1.5 shrink-0 rounded-full", TONE_DOT[tone])} aria-hidden />
      {label ?? tEnum("offer_status", status)}
    </Badge>
  );
}
