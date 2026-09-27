import "server-only";

import { getBenefits, getLanguages, getReferenceData, getSkills } from "@/lib/reference";

/**
 * AI uchun ma'lumotnoma: UUID o'rniga qisqa kodlar (c3, s12, r1, d40, k7) — prompt ixcham,
 * javob esa serverda qayta UUID'ga aylantiriladi va bazadagi ro'yxat bilan tekshiriladi.
 */
export interface AiCatalog {
  /** System prompt'ga qo'yiladigan matn (barqaror — keshlanadi) */
  text: string;
  category: Map<string, string>;
  subcategory: Map<string, { id: string; categoryId: string }>;
  region: Map<string, string>;
  district: Map<string, { id: string; regionId: string }>;
  skill: Map<string, { id: string; categoryId: string | null }>;
  languageCodes: Set<string>;
  benefitCodes: Set<string>;
  officialTermCodes: Set<string>;
}

export async function loadAiCatalog(): Promise<AiCatalog> {
  const [refs, skills, languages, benefits] = await Promise.all([getReferenceData(), getSkills(), getLanguages(), getBenefits()]);
  const category = new Map<string, string>();
  const subcategory = new Map<string, { id: string; categoryId: string }>();
  const region = new Map<string, string>();
  const district = new Map<string, { id: string; regionId: string }>();
  const skill = new Map<string, { id: string; categoryId: string | null }>();
  const lines: string[] = [];

  lines.push("## Kategoriyalar (cN) va yo'nalishlar (sN)");
  refs.categories.forEach((c, i) => {
    const code = `c${i + 1}`;
    category.set(code, c.id);
    lines.push(`${code}: ${c.name_uz} / ${c.name_ru}`);
    refs.subcategories
      .filter((s) => s.category_id === c.id)
      .forEach((s) => {
        const sc = `s${subcategory.size + 1}`;
        subcategory.set(sc, { id: s.id, categoryId: c.id });
        lines.push(`  ${sc}: ${s.name_uz} / ${s.name_ru}`);
      });
  });

  lines.push("", "## Viloyatlar (rN) va tumanlar (dN)");
  refs.regions.forEach((r, i) => {
    const code = `r${i + 1}`;
    region.set(code, r.id);
    const ds = refs.districts.filter((d) => d.region_id === r.id);
    const parts = ds.map((d) => {
      const dc = `d${district.size + 1}`;
      district.set(dc, { id: d.id, regionId: r.id });
      return `${dc} ${d.name_uz}`;
    });
    lines.push(`${code}: ${r.name_uz} / ${r.name_ru} — ${parts.join("; ")}`);
  });

  lines.push("", "## Ko'nikmalar (kN)");
  const catCode = new Map([...category].map(([code, id]) => [id, code]));
  skills.forEach((k, i) => {
    const code = `k${i + 1}`;
    skill.set(code, { id: k.id, categoryId: k.category_id });
    lines.push(`${code}: ${k.name_uz} / ${k.name_ru}${k.category_id ? ` (${catCode.get(k.category_id) ?? "-"})` : ""}`);
  });

  lines.push("", "## Tillar (kod)", languages.map((l) => `${l.code}: ${l.name_uz}`).join("; "));
  const benefitList = benefits.filter((b) => b.kind === "benefit");
  const termList = benefits.filter((b) => b.kind === "official_term");
  lines.push("", "## Qulayliklar (benefits, kod)", benefitList.map((b) => `${b.code}: ${b.name_uz}`).join("; "));
  lines.push("", "## Rasmiy shartlar (official_terms, kod)", termList.map((b) => `${b.code}: ${b.name_uz}`).join("; "));

  return {
    text: lines.join("\n"),
    category,
    subcategory,
    region,
    district,
    skill,
    languageCodes: new Set(languages.map((l) => l.code)),
    benefitCodes: new Set(benefitList.map((b) => b.code)),
    officialTermCodes: new Set(termList.map((b) => b.code)),
  };
}
