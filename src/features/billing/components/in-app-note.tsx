"use client";

import { Info } from "lucide-react";
import { useT } from "@/lib/i18n/client";

/** Google Play ilovasida: narx va to'lov tugmalari o'rniga neytral izoh (Play to'lov qoidasi) */
export function InAppNote() {
  const { t } = useT();
  return (
    <p className="flex items-start gap-2 rounded-2xl bg-secondary p-4 text-sm text-muted-foreground">
      <Info className="mt-0.5 size-4 shrink-0" />
      {t("billing.in_app_note")}
    </p>
  );
}
