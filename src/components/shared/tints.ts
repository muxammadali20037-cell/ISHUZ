/**
 * Rangli belgi plitkalari (3.0, 2026-11-15, ega yuborgan namuna rasm): ko'k · binafsha · yashil · to'q sariq.
 * Faqat belgi (ikonka) plitkasi uchun — matn rangi o'zgarmaydi. Ranglar globals.css dagi --tint-* tokenlari
 * (yorug' va qorong'i mavzu; kontrast — brand-contrast.test.ts).
 */
export type Tint = "blue" | "violet" | "green" | "orange";

export const TINT_TILE: Record<Tint, string> = {
  blue: "bg-tint-blue text-tint-blue-ink",
  violet: "bg-tint-violet text-tint-violet-ink",
  green: "bg-tint-green text-tint-green-ink",
  orange: "bg-tint-orange text-tint-orange-ink",
};

const ORDER: Tint[] = ["blue", "violet", "green", "orange"];

/** ro'yxatda navbatma-navbat: 0 — ko'k, 1 — binafsha, 2 — yashil, 3 — to'q sariq, 4 — yana ko'k … */
export const tintAt = (i: number): Tint => ORDER[((i % ORDER.length) + ORDER.length) % ORDER.length]!;

/** bo'lim kalitiga doimiy rang (menyu va yon menyuda bir xil) */
const BY_KEY: Record<string, Tint> = {
  home: "blue",
  jobs: "blue",
  map: "green",
  applications: "violet",
  saved: "orange",
  messages: "blue",
  profile: "violet",
  my_vacancies: "blue",
  candidates: "green",
  company: "orange",
  settings: "violet",
  help: "green",
};

export const tintFor = (key: string, fallback = 0): Tint => BY_KEY[key] ?? tintAt(fallback);
