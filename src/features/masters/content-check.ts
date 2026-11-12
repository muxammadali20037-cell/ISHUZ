import { checkRules, type RuleHit } from "@/features/moderation/rules";

/**
 * "Universal ustalar" matnlari uchun tezkor tekshiruv (vakansiyalardagi qoidalar bilan bir xil — src/features/moderation/rules.ts):
 *  - "block" (aniq taqiqlangan: intim xizmat, giyohvand moddalar, karta/akkaunt sotib olish, soxta hujjat, buzib kirish,
 *    ekstremizm) — saqlanmaydi, foydalanuvchiga sabab aytiladi;
 *  - "flag" (shubhali: savdo, "oldindan to'lov", siyosat, ko'p havola …) — saqlanadi, lekin admin moderatsiya navbatida
 *    ogohlantirish sifatida ko'rinadi (yakuniy qaror — odamda; yangi e'lon baribir tasdiqsiz chiqmaydi).
 * Sof modul — testlanadi.
 */
export type MasterTextKind = "listing" | "request" | "review";

export interface MasterTextVerdict {
  blocked: boolean;
  /** birinchi "block" topilmasi toifasi (foydalanuvchi xabari uchun) */
  category: RuleHit["category"] | null;
  /** admin uchun ogohlantirishlar (takrorsiz qoida nomlari) */
  flags: string[];
}

export function checkMasterText(fields: Record<string, string | string[] | null | undefined>): MasterTextVerdict {
  const flat: Record<string, string | null | undefined> = {};
  for (const [k, v] of Object.entries(fields)) flat[k] = Array.isArray(v) ? v.join("\n") : v;
  const res = checkRules(flat);
  return {
    blocked: !!res.block,
    category: res.block?.category ?? null,
    flags: [...new Set(res.hits.filter((h) => h.severity === "flag").map((h) => h.rule))],
  };
}
