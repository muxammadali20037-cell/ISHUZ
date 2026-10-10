/** Pul summasi matni (zod'siz — client komponentlar uchun yengil) */

/** "5 000 000" / "5000000" → 5000000; bo'sh → null */
export function parseMoney(text: string): number | null {
  const digits = text.replace(/[^\d]/g, "");
  if (!digits) return null;
  const n = Number(digits);
  return Number.isSafeInteger(n) ? n : null;
}

/** Yozilayotgan summani guruhlab ko'rsatish: 5000000 → "5 000 000" */
export function formatMoneyInput(text: string): string {
  const digits = text.replace(/[^\d]/g, "").slice(0, 10);
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}
