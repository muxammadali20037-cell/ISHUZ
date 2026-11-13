import { checkRules } from "./rules";

/**
 * Jazo siyosati (sof modul — testlanadi). Ega, 2026-11-13: "erotika, diniy ekstremizm, qonunga xilof e'lonlar — e'lon
 * joylay olmasin, joylamoqchi bo'lsa o'sha zahoti bloklansin; joylagandan keyin har bir so'z tekshirilsin (ma'nosi yaqin
 * bo'lsa ham) — e'lon ham o'chirilsin, o'zi ham bloklansin".
 *
 * Muallif bloklanadi, agar e'lon RAD ETILGAN bo'lsa va toifasi og'ir bo'lsa:
 *  - qoidalar (darhol, AI'gacha): har qanday "block" qoidasi — u faqat og'ir toifalarda bor;
 *  - AI (ma'no bo'yicha, joylagandan keyin ham): quyidagi toifalarda "reject".
 * "review" (shubha) — bloklamaydi: admin hal qiladi. Siyosat, spam, ishga aloqasiz — faqat e'lon rad etiladi (muallif emas).
 */
export const BAN_CATEGORIES: ReadonlySet<string> = new Set(["sexual_services", "extremism", "illegal_activity", "religious_propaganda"]);

export function shouldBan(v: { decision: string; category: string | null | undefined }): boolean {
  return v.decision === "reject" && !!v.category && BAN_CATEGORIES.has(v.category);
}

/** profiles.blocked_reason uchun qisqa yozuv (admin ko'radi; foydalanuvchi matni yo'q) */
export function banReason(category: string, code: string): string {
  return `auto_moderation:${category}:${code}`.replace(/[^a-z0-9_:.-]/gi, "_").slice(0, 120);
}

/**
 * Taqiqlangan kasb nomi (masalan "Massajchi", "Spa massajchi"): katalogda ko'rsatilmaydi va tanlanmaydi — aks holda
 * foydalanuvchi uni tanlab, darhol bloklanib qolardi. Bazadagi tugunlar ham o'chiriladi (supabase/prod/pending.sql),
 * bu esa unga qadar va keyin ham himoya.
 */
export function isProhibitedProfession(n: { name_uz?: string | null; name_ru?: string | null; name_en?: string | null }): boolean {
  return !!checkRules({ name: [n.name_uz, n.name_ru, n.name_en].filter(Boolean).join(" \n ") }).block;
}
