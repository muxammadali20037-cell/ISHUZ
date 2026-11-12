import { describe, expect, it } from "vitest";
import { centroid, distanceKm, roundKm, spread, yandexMapsUrl, yandexWidgetUrl, zoomFor } from "./geo";

const TASHKENT = { lat: 41.2995, lng: 69.2401 };
const SAMARKAND = { lat: 39.6542, lng: 66.9597 };

describe("jobs-map/geo", () => {
  it("masofa: Toshkent — Samarqand ≈ 270 km", () => {
    const km = distanceKm(TASHKENT, SAMARKAND);
    expect(km).toBeGreaterThan(260);
    expect(km).toBeLessThan(280);
    expect(distanceKm(TASHKENT, TASHKENT)).toBe(0);
  });

  it("markaz va masshtab", () => {
    expect(centroid([])).toBeNull();
    expect(centroid([TASHKENT, TASHKENT])).toEqual(TASHKENT);
    expect(zoomFor([TASHKENT], TASHKENT)).toBe(13);
    const wide = zoomFor([TASHKENT, SAMARKAND], centroid([TASHKENT, SAMARKAND])!);
    const near = zoomFor([TASHKENT, { lat: 41.31, lng: 69.25 }], TASHKENT);
    expect(wide).toBeLessThan(near);
    expect(wide).toBeGreaterThanOrEqual(8);
    expect(near).toBeLessThanOrEqual(15);
  });

  it("bir nuqtadagi belgilar suriladi (ustma-ust emas), birinchisi joyida", () => {
    const out = spread([{ ...TASHKENT, id: 1 }, { ...TASHKENT, id: 2 }, { ...TASHKENT, id: 3 }]);
    expect(out[0]).toMatchObject(TASHKENT);
    const keys = new Set(out.map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`));
    expect(keys.size).toBe(3);
    for (const p of out) expect(distanceKm(p, TASHKENT)).toBeLessThan(0.5);
  });

  it("vidjet manzili: lng,lat tartibi, raqamli belgilar, rang turi bo'yicha, til", () => {
    const url = yandexWidgetUrl({
      pins: [
        { ...TASHKENT, n: 1, kind: "real" },
        { lat: 41.31, lng: 69.25, n: 2, kind: "demo" },
      ],
      center: TASHKENT,
      zoom: 12,
      locale: "uz",
    });
    expect(url.startsWith("https://yandex.ru/map-widget/v1/?")).toBe(true);
    expect(url).toContain("ll=69.2401%2C41.2995");
    expect(url).toContain("z=12");
    expect(url).toContain("lang=uz_UZ");
    expect(url).toContain("&pt=69.2401,41.2995,pm2blm1~69.25,41.31,pm2grm2");
  });

  it("belgilar 30 tadan oshmaydi; tashqi havola uslubsiz koordinatalar bilan", () => {
    const pins = Array.from({ length: 40 }, (_, i) => ({ lat: 41 + i / 100, lng: 69, n: i + 1, kind: "real" as const }));
    expect(yandexWidgetUrl({ pins, center: TASHKENT, zoom: 11, locale: "ru" }).split("~")).toHaveLength(30);
    const ext = yandexMapsUrl({ pins: [TASHKENT], center: TASHKENT, zoom: 12 });
    expect(ext).toBe("https://yandex.uz/maps/?ll=69.2401,41.2995&z=12&pt=69.2401,41.2995");
  });

  it("masofani yaxlitlash", () => {
    expect(roundKm(0.04)).toEqual({ unit: "m", value: 100 });
    expect(roundKm(0.76)).toEqual({ unit: "m", value: 800 });
    expect(roundKm(3.46)).toEqual({ unit: "km", value: 3.5 });
    expect(roundKm(27.4)).toEqual({ unit: "km", value: 27 });
  });
});
