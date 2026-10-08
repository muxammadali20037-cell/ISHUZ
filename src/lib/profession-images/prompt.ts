/**
 * Kasb rasmi uchun so'rov shabloni. Butun to'plam bir xil uslubda bo'lishi uchun matn o'zgarmaydi —
 * faqat kasb va mutaxassislik nomi qo'yiladi.
 */
export const PROFESSION_IMAGE_TEMPLATE =
  "Create a professional, realistic occupation illustration for {profession_name}, specialization {specialization_name}. " +
  "Show an adult professional performing a typical task in an appropriate workplace, with accurate tools, clothing and necessary safety equipment. " +
  "Contemporary Uzbekistan context, clean composition, natural lighting, recognizable at small mobile card size. " +
  "Consistent visual style across the collection. No text, letters, numbers, logos, watermarks or exaggerated luxury. " +
  "This is an illustrative occupation image, not a portrait of the actual applicant or a photograph of the actual employer.";

const clean = (s: string) =>
  s
    .replace(/[{}<>\n\r]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);

export function buildProfessionPrompt(professionName: string, specializationName: string): string {
  const profession = clean(professionName) || "worker";
  const specialization = clean(specializationName) || profession;
  return PROFESSION_IMAGE_TEMPLATE.replace("{profession_name}", profession).replace("{specialization_name}", specialization);
}

interface PathNode {
  kind: string;
  name_en: string | null;
  name_ru: string;
  name_uz: string;
}

/** Rasm modeliga ingliz (bo'lmasa rus) nomi tushunarliroq */
export const promptName = (n: PathNode) => n.name_en?.trim() || n.name_ru?.trim() || n.name_uz;

/**
 * Daraxt yo'lidan (ildiz → tugun) kasb va mutaxassislikni ajratadi:
 * "Tibbiyot › Shifokorlar › Kardiolog (specialization)" → kasb = eng yaqin "profession" tuguni, mutaxassislik = tugunning o'zi.
 */
export function professionAndSpecialization(path: PathNode[]): { profession: string; specialization: string } | null {
  const self = path.at(-1);
  if (!self) return null;
  const professionNode = [...path].reverse().find((n) => n.kind === "profession") ?? self;
  const profession = promptName(professionNode);
  if (professionNode !== self) return { profession, specialization: promptName(self) };
  // kasbning o'zi tanlangan: mutaxassislik o'rniga uning sohasi/guruhi (masalan Accountant → Accounting)
  const group = path.length > 1 ? path[path.length - 2] : null;
  return { profession, specialization: group ? promptName(group) : profession };
}
