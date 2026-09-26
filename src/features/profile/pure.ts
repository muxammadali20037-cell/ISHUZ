/**
 * Profil moduli — sof (pure) yordamchilar. Alias importlarsiz: vitest konfiguratsiyasiz ham ishlaydi.
 */
import { format } from "date-fns";
import { ru as ruLocale, uz as uzLocale } from "date-fns/locale";

export type ProfileLocale = "uz" | "ru";

export const EDIT_SECTIONS = ["personal", "about", "location", "category", "experience", "skills", "languages", "education", "preferences", "visibility"] as const;
export type EditSection = (typeof EDIT_SECTIONS)[number];

export const COMPLETENESS_SUGGESTIONS = [
  "add_name",
  "add_photo",
  "add_category",
  "add_headline",
  "add_location",
  "add_skills",
  "add_experience",
  "add_education",
  "add_salary",
  "add_languages",
  "add_portfolio",
] as const;
export type CompletenessSuggestion = (typeof COMPLETENESS_SUGGESTIONS)[number];

const SUGGESTION_LINKS: Record<CompletenessSuggestion, string> = {
  add_name: "/profile/edit#personal",
  add_photo: "/profile/edit#personal",
  add_category: "/profile/edit#category",
  add_headline: "/profile/edit#about",
  add_location: "/profile/edit#location",
  add_skills: "/profile/edit#skills",
  add_experience: "/profile/edit#experience",
  add_education: "/profile/edit#education",
  add_salary: "/profile/edit#preferences",
  add_languages: "/profile/edit#languages",
  add_portfolio: "/profile/portfolio",
};

export function isCompletenessSuggestion(value: string): value is CompletenessSuggestion {
  return (COMPLETENESS_SUGGESTIONS as readonly string[]).includes(value);
}

/** worker_completeness.suggestions → {key, href} (noma'lum kalitlar tashlab yuboriladi) */
export function suggestionLinks(suggestions: readonly string[]): { key: CompletenessSuggestion; href: string }[] {
  return suggestions.filter(isCompletenessSuggestion).map((key) => ({ key, href: SUGGESTION_LINKS[key] }));
}

/** Tajriba oralig'i: "Yanvar 2022 – hozir" / "Март 2019 – Июнь 2021" */
export function formatMonthYear(iso: string | null | undefined, locale: ProfileLocale): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const s = format(d, "LLLL yyyy", { locale: locale === "ru" ? ruLocale : uzLocale });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function formatExperienceRange(
  startedOn: string,
  endedOn: string | null | undefined,
  isCurrent: boolean,
  locale: ProfileLocale,
  presentLabel: string,
): string {
  const start = formatMonthYear(startedOn, locale);
  const end = isCurrent || !endedOn ? presentLabel : formatMonthYear(endedOn, locale);
  return `${start} – ${end}`;
}

/** "2018 – 2022", "2018 – …", "2022" */
export function formatYearRange(startedYear: number | null | undefined, endedYear: number | null | undefined): string {
  if (startedYear && endedYear) return startedYear === endedYear ? String(startedYear) : `${startedYear} – ${endedYear}`;
  if (startedYear) return `${startedYear} – …`;
  if (endedYear) return String(endedYear);
  return "";
}

/** "2022-03" (yil-oy) → "2022-03-01"; noto'g'ri bo'lsa null */
export function monthToIsoDate(year: number | null | undefined, month: number | null | undefined): string | null {
  if (!year || !month || month < 1 || month > 12 || year < 1950 || year > 2100) return null;
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

export function isoDateToMonth(iso: string | null | undefined): { year: number | null; month: number | null } {
  if (!iso) return { year: null, month: null };
  const m = /^(\d{4})-(\d{2})/.exec(iso);
  if (!m) return { year: null, month: null };
  return { year: Number(m[1]), month: Number(m[2]) };
}

/** Foydalanuvchi qo'shgan ko'nikma uchun slug: "Kassa apparati" → "custom-kassa-apparati-x7k2q" */
export function customSkillSlug(name: string, random: string = Math.random().toString(36).slice(2, 7)): string {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’ʻ`]/g, "")
    .replace(/[^a-z0-9а-яёўқғҳ]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `custom-${base || "skill"}-${random}`;
}

// ---------- Fayllar ----------

export const AVATAR_MAX_BYTES = 3 * 1024 * 1024;
export const AVATAR_MIME: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export const PORTFOLIO_MAX_BYTES = 25 * 1024 * 1024;
export const PORTFOLIO_MAX_FILES = 10;
export const PORTFOLIO_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
};

export type PortfolioType = "image" | "video" | "pdf" | "document" | "link";

/** Portfolio turi bo'yicha ruxsat etilgan MIME'lar */
export const PORTFOLIO_TYPE_MIME: Record<PortfolioType, string[]> = {
  image: ["image/jpeg", "image/png", "image/webp"],
  video: ["video/mp4"],
  pdf: ["application/pdf"],
  document: ["application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  link: [],
};

export type FileCheck = { ok: true; ext: string } | { ok: false; error: "file_type" | "file_too_large" };

export function checkAvatarFile(file: { type: string; size: number }): FileCheck {
  const ext = AVATAR_MIME[file.type];
  if (!ext) return { ok: false, error: "file_type" };
  if (file.size > AVATAR_MAX_BYTES) return { ok: false, error: "file_too_large" };
  return { ok: true, ext };
}

export function checkPortfolioFile(file: { type: string; size: number }, type: PortfolioType): FileCheck {
  const ext = PORTFOLIO_MIME[file.type];
  if (!ext || !PORTFOLIO_TYPE_MIME[type].includes(file.type)) return { ok: false, error: "file_type" };
  if (file.size > PORTFOLIO_MAX_BYTES) return { ok: false, error: "file_too_large" };
  return { ok: true, ext };
}

/** Storage yo'lidan kengaytma: "u/abc.PDF" → "pdf" */
export function pathExtension(path: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(path);
  return m ? m[1]!.toLowerCase() : "";
}

export function mediaKind(path: string): "image" | "video" | "pdf" | "document" | "other" {
  const ext = pathExtension(path);
  if (["jpg", "jpeg", "png", "webp", "gif"].includes(ext)) return "image";
  if (["mp4", "webm", "mov"].includes(ext)) return "video";
  if (ext === "pdf") return "pdf";
  if (["doc", "docx"].includes(ext)) return "document";
  return "other";
}

// ---------- Tartiblash ----------

/** sort_order bo'yicha ro'yxatda elementni yuqoriga/pastga siljitish; yangi (id → sort_order) juftliklarini qaytaradi */
export function reorderItems<T extends { id: string }>(items: readonly T[], id: string, direction: "up" | "down"): { id: string; sort_order: number }[] | null {
  const idx = items.findIndex((i) => i.id === id);
  if (idx < 0) return null;
  const target = direction === "up" ? idx - 1 : idx + 1;
  if (target < 0 || target >= items.length) return null;
  const ids = items.map((i) => i.id);
  [ids[idx], ids[target]] = [ids[target]!, ids[idx]!];
  return ids.map((itemId, i) => ({ id: itemId, sort_order: i }));
}

// ---------- Mavzu ----------

export const THEMES = ["system", "light", "dark"] as const;
export type Theme = (typeof THEMES)[number];
export const THEME_COOKIE = "ishuz_theme";

export function isTheme(v: unknown): v is Theme {
  return typeof v === "string" && (THEMES as readonly string[]).includes(v);
}

/** Cookie qiymatidan mavzu: "dark"/"light" → o'zi, boshqa → system */
export function themeFromCookie(value: string | undefined): Theme {
  return value === "dark" || value === "light" ? value : "system";
}

/** Qorong'i rejim qo'llanadimi (system → prefers-color-scheme) */
export function resolveDark(theme: Theme, prefersDark: boolean): boolean {
  if (theme === "dark") return true;
  if (theme === "light") return false;
  return prefersDark;
}

// ---------- Statistika ----------

export const EMPLOYER_STAT_KEYS = ["active_vacancies", "total_vacancies", "applications", "new_applications", "views", "saved_workers", "offers_sent", "hired"] as const;
export type EmployerStatKey = (typeof EMPLOYER_STAT_KEYS)[number];

/** employer_dashboard_stats() jsonb → raqamlar (yo'q/noto'g'ri → 0) */
export function parseEmployerStats(json: unknown): Record<EmployerStatKey, number> {
  const obj = json && typeof json === "object" && !Array.isArray(json) ? (json as Record<string, unknown>) : {};
  const out = {} as Record<EmployerStatKey, number>;
  for (const key of EMPLOYER_STAT_KEYS) {
    const v = obj[key];
    const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : 0;
    out[key] = Number.isFinite(n) ? n : 0;
  }
  return out;
}

/** Yosh (tug'ilgan sana YYYY-MM-DD) — `now` test uchun */
export function ageFrom(birthDate: string | null | undefined, now: Date = new Date()): number | null {
  if (!birthDate) return null;
  const d = new Date(birthDate);
  if (Number.isNaN(d.getTime())) return null;
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}
