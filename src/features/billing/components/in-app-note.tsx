"use client";

import { Info } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { usePurchaseLock } from "@/lib/use-purchase-lock";

/**
 * Ilova ichida (Google Play yoki Telegram Mini App): narx va to'lov tugmalari o'rniga neytral izoh.
 * Tashqi to'lovga havola yoki "saytda arzonroq" degan gap yo'q — ikkala platforma qoidasi shuni talab qiladi.
 */
export function InAppNote() {
  const { t } = useT();
  const lock = usePurchaseLock();
  return (
    <p className="flex items-start gap-2 rounded-2xl bg-secondary p-4 text-sm text-muted-foreground" data-in-app-note={lock ?? "android"}>
      <Info className="mt-0.5 size-4 shrink-0" />
      {t(lock === "telegram" ? "billing.in_telegram_note" : "billing.in_app_note")}
    </p>
  );
}
