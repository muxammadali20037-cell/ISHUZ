/** `public.slugify` bilan bir xil alifbo: lotin, kirill (ruscha/o'zbekcha) — avval faqat lotin qabul qilinib, ruscha sarlavhali e'lon 404 edi */
export const VACANCY_SLUG_RE = /^[a-z0-9а-яёўқғҳ-]{3,120}$/u;

/** URL'dagi slug (kodlangan bo'lishi mumkin) → bazadagi ko'rinish; ruxsat etilmagan belgi yoki buzilgan kodlash — null */
export function normalizeVacancySlug(raw: string): string | null {
  let slug: string;
  try {
    slug = decodeURIComponent(raw);
  } catch {
    return null;
  }
  slug = slug.toLowerCase();
  return VACANCY_SLUG_RE.test(slug) ? slug : null;
}
