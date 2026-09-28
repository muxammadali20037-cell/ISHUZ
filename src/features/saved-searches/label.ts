/**
 * Saqlangan qidiruv uchun qisqa nom: "Oshpaz · Chilonzor · 5 mln dan".
 * Sof modul (runtime import yo'q) — vitest bilan testlanadi.
 */
import type { JobsSearchParams } from "@/features/jobs/search-params";

interface Named {
  slug?: string;
  id?: string;
  name_uz: string;
  name_ru: string;
}

export function savedSearchLabel(
  p: JobsSearchParams,
  refs: { categories: Named[]; subcategories: Named[]; regions: Named[]; districts: Named[] },
  locale: "uz" | "ru",
  words: { salaryFrom: (amount: string) => string; remote: string; noExperience: string },
): string {
  const nm = (r: Named | undefined) => (r ? (locale === "ru" ? r.name_ru : r.name_uz) : null);
  const parts: string[] = [];
  const sub = p.subcategory ? refs.subcategories.find((s) => s.slug === p.subcategory) : undefined;
  const cat = p.category ? refs.categories.find((c) => c.slug === p.category) : undefined;
  const profession = nm(sub) ?? nm(cat);
  if (profession) parts.push(profession);
  if (p.q) parts.push(`«${p.q}»`);
  const districts = p.district.map((id) => nm(refs.districts.find((d) => d.id === id))).filter((x): x is string => !!x);
  if (districts.length) parts.push(districts.slice(0, 2).join(", ") + (districts.length > 2 ? ` +${districts.length - 2}` : ""));
  else if (p.region) {
    const r = nm(refs.regions.find((x) => x.slug === p.region));
    if (r) parts.push(r);
  }
  if (p.salaryMin) parts.push(words.salaryFrom(formatMillions(p.salaryMin, locale)));
  if (p.remote) parts.push(words.remote);
  if (p.noExperience) parts.push(words.noExperience);
  return (parts.join(" · ") || "—").slice(0, 160);
}

function formatMillions(n: number, locale: "uz" | "ru"): string {
  if (n >= 1_000_000) {
    const v = Math.round((n / 1_000_000) * 10) / 10;
    return `${String(v).replace(".", ",")} ${locale === "ru" ? "млн" : "mln"}`;
  }
  return `${Math.round(n / 1000)} ${locale === "ru" ? "тыс" : "ming"}`;
}
