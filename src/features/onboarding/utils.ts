/**
 * Onboarding uchun sof (pure) yordamchi funksiyalar — server va client'da ishlaydi, test qilinadi.
 */
import { REVIEW_STEP, WIZARD_PATH } from "./types";

/** Wizard qadami URL i (server va client komponentlarda ishlatiladi) */
export function stepHref(step: number) {
  return `${WIZARD_PATH}?step=${step}`;
}

/** So'ralgan qadamni saqlangan qadamdan oshirmaydi: oldinga sakrab bo'lmaydi, orqaga mumkin */
export function clampStep(requested: number | null | undefined, saved: number): number {
  const max = Math.min(Math.max(saved, 1), REVIEW_STEP);
  if (requested === null || requested === undefined || !Number.isFinite(requested)) return max;
  return Math.min(Math.max(Math.trunc(requested), 1), max);
}

/** Qadam saqlangach keyingi qadam: orqaga qaytib tahrirlaganda progress yo'qolmaydi */
export function nextStepAfter(savedStep: number, completedStep: number): number {
  return Math.min(Math.max(savedStep, completedStep + 1), REVIEW_STEP);
}

/** "5000000" / "5 000 000" / "5,000,000 so'm" → 5000000 (bo'sh bo'lsa null) */
export function parseMoneyInput(raw: string): number | null {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  const n = Number.parseInt(digits.slice(0, 12), 10);
  return Number.isFinite(n) ? n : null;
}

/** 5000000 → "5 000 000" */
export function formatThousands(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "";
  return Math.trunc(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/** "YYYY-MM" → "YYYY-MM-01" (Postgres date) */
export function monthToDate(month: string): string {
  return `${month}-01`;
}

/** "YYYY-MM-DD" → "YYYY-MM" */
export function dateToMonth(date: string | null | undefined): string | null {
  if (!date) return null;
  const m = /^(\d{4})-(\d{2})/.exec(date);
  return m ? `${m[1]}-${m[2]}` : null;
}

/** "YYYY-MM" ni solishtirish uchun songa aylantiradi (2024-03 → 202403) */
export function monthIndex(month: string): number {
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  if (!m) return Number.NaN;
  return Number(m[1]) * 100 + Number(m[2]);
}

function toIsoDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function shiftYears(base: Date, years: number, days = 0): Date {
  const d = new Date(Date.UTC(base.getUTCFullYear() + years, base.getUTCMonth(), base.getUTCDate() + days));
  return d;
}

/**
 * Tug'ilgan sana chegaralari (DB: birth_date > today - 90y AND birth_date < today - 14y).
 * `min`/`max` — <input type="date"> uchun.
 */
export function birthDateBounds(now = new Date()): { min: string; max: string } {
  return { min: toIsoDate(shiftYears(now, -90, 1)), max: toIsoDate(shiftYears(now, -14, -1)) };
}

/** 14–90 yosh oralig'ida va haqiqiy sana ekanini tekshiradi */
export function isBirthDateValid(iso: string, now = new Date()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || toIsoDate(d) !== iso) return false;
  const { min, max } = birthDateBounds(now);
  return iso >= min && iso <= max;
}

/** Foydalanuvchi qo'shgan ko'nikma uchun slug: "Adobe Premiere" → "adobe-premiere-x7k2q9" */
export function slugifyText(input: string): string {
  return input
    .toLowerCase()
    .replace(/['’ʻ`]/g, "")
    .replace(/[^a-z0-9а-яёўқғҳ]+/gi, "-")
    .replace(/^-+|-+$/g, "");
}

export function customSkillSlug(name: string, random: () => number = Math.random): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let suffix = "";
  for (let i = 0; i < 6; i++) suffix += alphabet[Math.floor(random() * alphabet.length)] ?? "x";
  const base = slugifyText(name).slice(0, 40) || "skill";
  return `custom-${base}-${suffix}`;
}

/** Fayl kengaytmasi (MIME bo'yicha; bo'lmasa nomdan) */
export function fileExtension(file: { name: string; type: string }): string {
  const byMime: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "video/mp4": "mp4",
    "application/pdf": "pdf",
    "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  };
  const fromMime = byMime[file.type];
  if (fromMime) return fromMime;
  const m = /\.([a-z0-9]{1,5})$/i.exec(file.name);
  return m?.[1]?.toLowerCase() ?? "bin";
}

/** Fayl tekshiruvi: turi va hajmi. Xato bo'lsa i18n kaliti qaytaradi */
export function validateFile(
  file: { type: string; size: number },
  allowedMime: readonly string[],
  maxMb: number,
): { key: "common.errors.file_type" | "common.errors.file_too_large"; params?: { max: number } } | null {
  if (!allowedMime.includes(file.type)) return { key: "common.errors.file_type" };
  if (file.size > maxMb * 1024 * 1024) return { key: "common.errors.file_too_large", params: { max: maxMb } };
  return null;
}

/** Storage yo'li foydalanuvchining o'z papkasida ekanini tekshiradi: "<userId>/..." */
export function isOwnStoragePath(path: string, userId: string): boolean {
  if (!path || path.includes("..") || path.startsWith("/")) return false;
  return path.startsWith(`${userId}/`) && path.length > userId.length + 1;
}

/** Public URL bucket ichidagi foydalanuvchi papkasiga ishora qiladimi */
export function isOwnPublicUrl(url: string, supabaseUrl: string, bucket: string, userId: string): boolean {
  const base = supabaseUrl.replace(/\/+$/, "");
  const prefix = `${base}/storage/v1/object/public/${bucket}/${userId}/`;
  if (!url.startsWith(prefix)) return false;
  const rest = url.slice(prefix.length).split("?")[0] ?? "";
  return rest.length > 0 && !rest.includes("..");
}

/** Public URL → bucket ichidagi yo'l ("<userId>/avatar.jpg"); mos kelmasa null */
export function storagePathFromPublicUrl(url: string, bucket: string): string | null {
  const marker = `/storage/v1/object/public/${bucket}/`;
  const i = url.indexOf(marker);
  if (i < 0) return null;
  const rest = url.slice(i + marker.length).split("?")[0] ?? "";
  return rest || null;
}

/** Telegram username: "@ali_valiyev" → "ali_valiyev" */
export function normalizeTelegramUsername(input: string): string {
  return input.trim().replace(/^@/, "").replace(/^https?:\/\/t\.me\//i, "");
}

/** Yil ro'yxati (ta'lim / tajriba selectlari uchun) */
export function yearOptions(from: number, to: number): number[] {
  const out: number[] = [];
  for (let y = to; y >= from; y--) out.push(y);
  return out;
}
