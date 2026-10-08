"use client";

import { BadgeCheck, Phone } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { formatPhone, formatPhoneAsYouType } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatMoneyInput } from "../schema";

const big = "h-14 rounded-2xl text-lg";

/** Telefon: raqamli klaviatura, +998 avtomatik, guruhlab yoziladi */
export function PhoneInput({ id, value, onChange, invalid, describedBy }: { id: string; value: string; onChange: (v: string) => void; invalid?: boolean; describedBy?: string }) {
  const { t } = useT();
  // bazadan kelgan "+998901234567" ham "+998 90 123 45 67" ko'rinishida chiqadi
  const shown = value && /^\+998\d{9}$/.test(value) ? formatPhone(value) : value || "+998 ";
  return (
    <Input
      id={id}
      type="tel"
      inputMode="tel"
      autoComplete="tel"
      leftIcon={<Phone />}
      placeholder={t("auth.phone_placeholder")}
      value={shown}
      invalid={invalid}
      aria-describedby={describedBy}
      className={big}
      onChange={(e) => {
        const raw = e.target.value;
        onChange(raw.length < shown.length ? raw : formatPhoneAsYouType(raw.startsWith("+") ? raw : `+${raw}`));
      }}
    />
  );
}

/** Tasdiqlangan telefon (o'zgartirib bo'lmaydi — hisob raqami) */
export function VerifiedPhone({ phone }: { phone: string }) {
  const { t } = useT();
  return (
    <div className="flex min-h-14 items-center gap-3 rounded-2xl border border-border bg-secondary/60 px-4 text-lg font-semibold">
      <Phone className="size-5 text-muted-foreground" aria-hidden />
      <span className="tabular">{formatPhone(phone)}</span>
      <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-success-soft px-2.5 py-1 text-sm font-semibold text-success">
        <BadgeCheck className="size-4" aria-hidden /> {t("easy.worker.phone_verified")}
      </span>
    </div>
  );
}

/** Summa: raqamli klaviatura, 5 000 000 ko'rinishida */
export function MoneyInput({ id, value, onChange, placeholder, invalid, disabled, label }: { id: string; value: string; onChange: (v: string) => void; placeholder?: string; invalid?: boolean; disabled?: boolean; label?: string }) {
  return (
    <Input
      id={id}
      inputMode="numeric"
      autoComplete="off"
      placeholder={placeholder}
      value={formatMoneyInput(value)}
      invalid={invalid}
      disabled={disabled}
      aria-label={label}
      className={cn(big, "tabular")}
      onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, "").slice(0, 10))}
    />
  );
}

export const bigInput = big;

/** Katta belgilash qutisi (rozilik) — matn bosilganda ham belgilanadi */
export function BigCheckbox({ id, checked, onChange, title, description }: { id: string; checked: boolean; onChange: (v: boolean) => void; title: string; description?: string }) {
  return (
    <label htmlFor={id} className={cn("flex cursor-pointer items-start gap-3 rounded-2xl border-2 p-4", checked ? "border-primary bg-primary-soft/60" : "border-border bg-card")}>
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 size-7 shrink-0 accent-[var(--primary)]" />
      <span className="min-w-0">
        <span className="block text-lg font-semibold leading-snug">{title}</span>
        {description ? <span className="mt-0.5 block text-base text-muted-foreground">{description}</span> : null}
      </span>
    </label>
  );
}
