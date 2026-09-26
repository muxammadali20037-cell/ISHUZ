"use client";

import { useT } from "@/lib/i18n/client";
import { formatMoney } from "@/lib/format";
import { Input } from "@/components/ui/input";

const MAX_DIGITS = 11;

/** Pul kiritish: faqat raqamlar, mingliklar bo'sh joy bilan, qiymat butun so'm (number | null) */
export function MoneyInput({
  id,
  value,
  onChange,
  placeholder,
  invalid,
  disabled,
}: {
  id?: string;
  value: number | null;
  onChange: (next: number | null) => void;
  placeholder?: string;
  invalid?: boolean;
  disabled?: boolean;
}) {
  const { locale } = useT();
  const currency = formatMoney(1, locale).replace(/^[\d\s]+/, "");
  const display = value === null ? "" : formatMoney(value, locale, { withCurrency: false });
  return (
    <Input
      id={id}
      inputMode="numeric"
      autoComplete="off"
      value={display}
      placeholder={placeholder}
      invalid={invalid}
      disabled={disabled}
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, "").slice(0, MAX_DIGITS);
        onChange(digits ? Number(digits) : null);
      }}
      rightSlot={<span className="text-sm text-muted-foreground">{currency}</span>}
      className="tabular"
    />
  );
}
