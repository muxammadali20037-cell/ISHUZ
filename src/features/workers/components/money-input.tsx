"use client";

import { Input } from "@/components/ui/input";

const MAX = 1_000_000_000;

function format(n: number | null): string {
  if (n === null) return "";
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/** Pul kiritish: faqat raqamlar, ko'rinishi "5 000 000", qiymati number | null */
export function MoneyInput({
  id,
  value,
  onChange,
  placeholder,
  suffix,
  invalid,
  "aria-label": ariaLabel,
}: {
  id?: string;
  value: number | null;
  onChange: (v: number | null) => void;
  placeholder?: string;
  suffix?: string;
  invalid?: boolean;
  "aria-label"?: string;
}) {
  return (
    <Input
      id={id}
      inputMode="numeric"
      autoComplete="off"
      value={format(value)}
      placeholder={placeholder}
      invalid={invalid}
      aria-label={ariaLabel}
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
        if (!digits) {
          onChange(null);
          return;
        }
        onChange(Math.min(Number(digits), MAX));
      }}
      rightSlot={suffix ? <span className="pr-1 text-sm text-muted-foreground">{suffix}</span> : undefined}
      className="tabular"
    />
  );
}
