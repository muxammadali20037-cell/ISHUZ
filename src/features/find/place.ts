/**
 * Eslab qolingan hudud ("Yaqin atrofda" bir marta aniqlangach): faqat viloyat va tuman, shu qurilmada (cookie).
 * Aniq koordinata hech qayerda saqlanmaydi.
 */
export const PLACE_COOKIE = "ib_place";

export interface Place {
  region: string;
  district: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** "viloyat~tuman" — "~" cookie'da kodlanmaydi (Next "|" ni %7C qilib yozadi) */
export function parsePlace(raw: string | null | undefined): Place | null {
  const [region, district] = (raw ?? "").split("~");
  if (!region || !/^[a-z0-9_-]{2,60}$/.test(region)) return null;
  if (!district || !(district === "all" || UUID.test(district))) return null;
  return { region, district };
}

export function formatPlace(p: Place): string {
  return `${p.region}~${p.district}`;
}
