"use client";

import { SalaryText } from "@/components/shared/salary-text";
import type { OfferVacancy } from "../types";

/**
 * Taklifdagi maosh (C4): ish beruvchi taklifda yozgan maosh — oylik (formada "Oylik maosh"); vakansiya bo'yicha taklifda
 * maosh alohida yozilmaydi — vakansiyaning o'z maoshi va to'lov davri ko'rsatiladi. Hech biri bo'lmasa — "Kelishiladi".
 */
export function OfferSalary({
  offer,
  className,
}: {
  offer: { salary_from: number | null; salary_to: number | null; vacancy: OfferVacancy | null };
  className?: string;
}) {
  if (offer.salary_from || offer.salary_to) {
    return <SalaryText from={offer.salary_from} to={offer.salary_to} type="monthly" className={className} />;
  }
  const v = offer.vacancy;
  if (v && (v.salary_from || v.salary_to || v.salary_negotiable)) {
    return <SalaryText from={v.salary_from ?? null} to={v.salary_to ?? null} type={v.salary_type ?? null} negotiable={v.salary_negotiable ?? false} className={className} />;
  }
  return <SalaryText from={null} to={null} className={className} />;
}
