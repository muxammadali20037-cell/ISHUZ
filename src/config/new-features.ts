/**
 * Yangi bo'lim belgisi (NewDot — yozuvsiz yonib-o'chuvchi nuqta): muhim yangi bo'limlar menyuda va bosh sahifada ajralib
 * turadi. Belgi muddati tugagach o'zi yo'qoladi (eskirgan belgi qolib ketmasin). Sana — shu kungacha (UTC) ko'rsatiladi.
 */
export const NEW_FEATURES = {
  /** AI yordamchi (/ai): suhbat, statistika, karyera, tez e'lon */
  ai: "2027-01-15",
  /** Universal ustalar (/ustalar) */
  masters: "2027-01-15",
  /** Yaqin atrofdagi ishlar — xaritada (/jobs/xarita) */
  map: "2027-01-15",
} as const;

export type NewFeature = keyof typeof NEW_FEATURES;

export function isNewFeature(key: NewFeature, now: number = Date.now()): boolean {
  return now < Date.parse(`${NEW_FEATURES[key]}T00:00:00Z`);
}
