/**
 * Foydalanuvchiga ko'rinadigan brend — kod shu yerdan oladi (logo, sarlavha, metadata, JSON-LD, bot, AI ko'rsatmalari).
 * Tarjima matnlaridagi nom `messages/*` da (brand-guard.test.ts nomni tekshiradi). Repo (ISHUZ) va domen nomi bu yerda emas.
 */
export const BRAND = {
  name: "Ish topdim",
  /** logo matni: birinchi qism oddiy, ikkinchisi asosiy rangda */
  wordmark: ["Ish", "topdim"] as const,
  /** fayl nomlari uchun (eksport, rasm) */
  fileSlug: "ishtopdim",
} as const;
