"use server";

import { z } from "zod";
import type { ActionResult } from "@/features/auth/actions";
import { getSession } from "@/features/auth/session";
import { revealListingPhone, type RevealedPhones } from "@/features/contacts/reveal-actions";
import { getVacancyBySlug } from "@/features/jobs/queries";
import type { VacancyDetail } from "@/features/jobs/types";
import { formatWorkTime } from "@/lib/format";
import type { Enums } from "@/types/database.types";

/** Nomli ma'lumot (qulaylik, rasmiy shart) — tarjima ekranda */
export interface NamedItem {
  code: string;
  name_uz: string;
  name_ru: string;
}

/**
 * Yordamchi kartasidagi "E'lonni to'liq ko'rish" (ega, 2026-11-19): e'lonning qolgan ma'lumotlari tartib bilan.
 * Faqat sahifada hammaga ochiq maydonlar; telefon bu yerda yo'q (u alohida — revealListingPhone, limit bilan).
 */
export interface VacancyCardDetails {
  description: string | null;
  schedule: Enums<"work_schedule">;
  time: string | null;
  employment: Enums<"employment_type">;
  format: Enums<"work_format">;
  experienceMonths: number;
  education: Enums<"education_level"> | null;
  ageMin: number | null;
  ageMax: number | null;
  gender: Enums<"gender"> | null;
  address: string | null;
  mapHref: string | null;
  benefits: NamedItem[];
  officialTerms: NamedItem[];
}

const named = (b: NamedItem): NamedItem => ({ code: b.code, name_uz: b.name_uz, name_ru: b.name_ru });

function toDetails(v: VacancyDetail): VacancyCardDetails {
  return {
    description: v.description?.trim() || null,
    schedule: v.schedule,
    time: v.work_time_from && v.work_time_to ? `${formatWorkTime(v.work_time_from)}–${formatWorkTime(v.work_time_to)}` : null,
    employment: v.employment_type,
    format: v.work_format,
    experienceMonths: v.experience_min_months,
    education: v.education_min,
    ageMin: v.age_min,
    ageMax: v.age_max,
    gender: v.gender,
    address: v.is_remote ? null : v.address?.trim() || null,
    mapHref: v.lat !== null && v.lng !== null ? `https://yandex.uz/maps/?pt=${v.lng},${v.lat}&z=16` : null,
    benefits: v.benefits.map(named),
    officialTerms: v.officialTerms.map(named),
  };
}

export type CardPhone = { phase: "shown"; phones: RevealedPhones } | { phase: "error"; error: string };

async function cardPhone(kind: "vacancy" | "worker", id: string): Promise<{ phone: CardPhone; signedIn: boolean }> {
  const [res, session] = await Promise.all([revealListingPhone({ kind, id }).catch(() => null), getSession().catch(() => null)]);
  const phone: CardPhone = res?.ok && res.data ? { phase: "shown", phones: res.data } : { phase: "error", error: res && !res.ok ? res.error : "unavailable" };
  return { phone, signedIn: !!session };
}

/**
 * "E'lonni to'liq ko'rish" (vakansiya): tafsilotlar + telefon (bosish — aniq harakat, shuning uchun raqam ham shu yerda
 * ochiladi; limitlar o'sha-o'sha: mehmon — IP, kirgan — 0074).
 */
export async function openVacancyCard(input: unknown): Promise<ActionResult<{ details: VacancyCardDetails; phone: CardPhone; signedIn: boolean }>> {
  const parsed = z.object({ slug: z.string().min(1).max(200) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const v = await getVacancyBySlug(parsed.data.slug).catch(() => null);
  if (!v || v.status !== "active" || v.is_expired) return { ok: false, error: "not_found" };
  const { phone, signedIn } = await cardPhone("vacancy", v.id);
  return { ok: true, data: { details: toDetails(v), phone, signedIn } };
}

/** "E'lonni to'liq ko'rish" (ishchi e'loni): ma'lumotlar kartada bor — faqat telefon */
export async function openWorkerCard(input: unknown): Promise<ActionResult<{ phone: CardPhone; signedIn: boolean }>> {
  const parsed = z.object({ id: z.uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  return { ok: true, data: await cardPhone("worker", parsed.data.id) };
}
