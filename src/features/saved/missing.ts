/**
 * Jadval/funksiya bazada hali yo'q (migratsiya qo'llanmagan) — eski yo'lga o'tish uchun.
 * `status` — PostgREST javobi: 404 yo'q jadval/funksiyani bildiradi (ba'zi versiyalarda tanasi bo'sh `{}`, kodsiz).
 */
export function isMissingRelation(error: { code?: string | null; message?: string | null } | null | undefined, status?: number): boolean {
  if (!error) return false;
  if (status === 404) return true;
  return ["42P01", "PGRST205", "PGRST202", "42883"].includes(error.code ?? "") || /does not exist|could not find the (table|function)/i.test(error.message ?? "");
}
