"use client";

import { forwardRef } from "react";
import { useT } from "@/lib/i18n/client";
import { Input, type InputProps } from "@/components/ui/input";
import { formatThousands, parseMoneyInput } from "../utils";

/**
 * So'mda summa: "5 000 000" ko'rinishida yoziladi, qiymat — butun son (so'm) yoki null.
 */
export const MoneyInput = forwardRef<HTMLInputElement, Omit<InputProps, "value" | "onChange" | "type"> & { value: number | null; onChange: (value: number | null) => void }>(
  ({ value, onChange, ...props }, ref) => {
    const { t } = useT();
    return (
      <Input
        ref={ref}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={formatThousands(value)}
        onChange={(e) => onChange(parseMoneyInput(e.target.value))}
        rightSlot={<span className="text-sm font-medium text-muted-foreground">{t("onboarding.worker.preferences.currency")}</span>}
        className="tabular"
        {...props}
      />
    );
  },
);
MoneyInput.displayName = "MoneyInput";
