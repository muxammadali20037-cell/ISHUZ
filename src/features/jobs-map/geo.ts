/**
 * Xarita uchun sof yordamchilar (testlanadi): masofa, markaz, masshtab, Yandex xarita vidjeti va havola manzillari.
 *
 * Yandex xaritasi — API kalitsiz ishlaydigan "Xarita vidjeti" (iframe, yandex.ru/map-widget/v1): raqamli belgilar
 * (pt=lng,lat,pm2blm1~…) ro'yxatdagi raqamlar bilan mos. Interaktiv JS API kalit talab qiladi (ega olsa — keyingi bosqich).
 * Koordinatalar tartibi Yandex'da: avval uzunlik (lng), keyin kenglik (lat).
 */
export interface LatLng {
  lat: number;
  lng: number;
}

export interface MapPin extends LatLng {
  /** ro'yxatdagi raqam (1…99) */
  n: number;
  /** haqiqiy e'lon — ko'k, namuna — kulrang */
  kind: "real" | "demo";
}

export const MAX_PINS = 30;

export function distanceKm(a: LatLng, b: LatLng): number {
  const rad = (x: number) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Nuqtalar o'rtasi (bo'sh bo'lsa — null) */
export function centroid(points: LatLng[]): LatLng | null {
  if (!points.length) return null;
  const lat = points.reduce((s, p) => s + p.lat, 0) / points.length;
  const lng = points.reduce((s, p) => s + p.lng, 0) / points.length;
  return { lat, lng };
}

/**
 * Bir xil nuqtaga (masalan, tuman markazi) tushgan belgilar ustma-ust chiqmasin: aylana bo'ylab ~250 m ga suriladi.
 * Faqat ko'rinish uchun — ro'yxatda bunday joy "taxminiy (tuman markazi)" deb yoziladi.
 */
export function spread<T extends LatLng>(points: T[]): T[] {
  const groups = new Map<string, number>();
  return points.map((p) => {
    const key = `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`;
    const i = groups.get(key) ?? 0;
    groups.set(key, i + 1);
    if (i === 0) return p;
    const angle = (i * 2 * Math.PI) / 7;
    const ring = 0.0025 * (1 + Math.floor((i - 1) / 7));
    return { ...p, lat: p.lat + ring * Math.sin(angle), lng: p.lng + (ring * Math.cos(angle)) / Math.cos((p.lat * Math.PI) / 180) };
  });
}

/** Barcha nuqtalar sig'adigan masshtab (Yandex z: 9 — viloyat, 15 — mahalla) */
export function zoomFor(points: LatLng[], center: LatLng): number {
  if (points.length < 2) return 13;
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng).map((x) => x * Math.cos((center.lat * Math.PI) / 180));
  const span = Math.max(Math.max(...lats) - Math.min(...lats), Math.max(...lngs) - Math.min(...lngs), 0.005) * 1.5;
  return Math.max(8, Math.min(15, Math.floor(Math.log2(360 / span)) - 1));
}

const fmt = (x: number) => x.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");

const LANG: Record<string, string> = { uz: "uz_UZ", oz: "uz_UZ", ru: "ru_RU", en: "en_US" };

/** Iframe uchun vidjet manzili: raqamli belgilar (ko'k — haqiqiy, kulrang — namuna) */
export function yandexWidgetUrl({ pins, center, zoom, locale }: { pins: MapPin[]; center: LatLng; zoom: number; locale: string }): string {
  const q = new URLSearchParams({ ll: `${fmt(center.lng)},${fmt(center.lat)}`, z: String(zoom), l: "map", lang: LANG[locale] ?? "ru_RU" });
  const pt = pins
    .slice(0, MAX_PINS)
    .map((p) => `${fmt(p.lng)},${fmt(p.lat)},pm2${p.kind === "real" ? "bl" : "gr"}m${Math.min(Math.max(p.n, 1), 99)}`)
    .join("~");
  // URLSearchParams "~" va "," ni kodlaydi — Yandex ikkalasini ham tushunadi, lekin o'qilishi uchun qaytaramiz
  return `https://yandex.ru/map-widget/v1/?${q.toString()}${pt ? `&pt=${pt}` : ""}`;
}

/** "Yandex Kartada ochish" — to'liq ilova/sayt (belgilar uslubsiz: URL sxemasi faqat koordinata qabul qiladi) */
export function yandexMapsUrl({ pins, center, zoom }: { pins: LatLng[]; center: LatLng; zoom: number }): string {
  const pt = pins
    .slice(0, MAX_PINS)
    .map((p) => `${fmt(p.lng)},${fmt(p.lat)}`)
    .join("~");
  return `https://yandex.uz/maps/?ll=${fmt(center.lng)},${fmt(center.lat)}&z=${zoom}${pt ? `&pt=${pt}` : ""}`;
}

/** Ro'yxatdagi masofa: "≈ 800 m" / "≈ 3,5 km" (raqam — chaqiruvchi formatlaydi) */
export function roundKm(km: number): { unit: "m" | "km"; value: number } {
  if (km < 1) return { unit: "m", value: Math.max(100, Math.round((km * 1000) / 100) * 100) };
  return { unit: "km", value: km < 10 ? Math.round(km * 10) / 10 : Math.round(km) };
}
