/**
 * Telegram Mini App'ni haqiqiy ilova kabi ochish qoidalari (sof funksiyalar — unit test: fullscreen.test.ts).
 * To'liq ekran (Bot API 8.0) — faqat telefonda: kompyuter Telegram'ida butun monitorni egallash noqulay, u yerda faqat expand().
 */

/** "7.10" ≥ "7.7" kabi taqqoslash (Telegram versiyasi — nuqtali raqamlar, satr sifatida taqqoslab bo'lmaydi) */
export function versionAtLeast(version: string | undefined, min: string): boolean {
  if (!version) return false;
  const a = version.split(".").map((x) => Number.parseInt(x, 10) || 0);
  const b = min.split(".").map((x) => Number.parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d !== 0) return d > 0;
  }
  return true;
}

const MOBILE = new Set(["android", "android_x", "ios"]);

/** Telefon ilovasida, to'liq ekranni qo'llab-quvvatlaydigan versiyada — ochilganda butun ekranni egallaydi */
export function wantsFullscreen(platform: string | undefined, version: string | undefined): boolean {
  return MOBILE.has((platform ?? "").toLowerCase()) && versionAtLeast(version, "8.0");
}

/** Ro'yxatni pastga aylantirganda Mini App yopilib qolmasin (Bot API 7.7+) */
export function canDisableVerticalSwipes(version: string | undefined): boolean {
  return versionAtLeast(version, "7.7");
}

export interface Insets {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/** Telegram bergan chetlar → CSS o'zgaruvchilari (globals.css: html.tg-fullscreen --safe-top / --safe-bottom) */
export function insetVars(safe: Partial<Insets> | undefined, content: Partial<Insets> | undefined): Record<string, string> {
  const px = (n: number | undefined) => `${Math.max(0, Math.round(n ?? 0))}px`;
  const out: Record<string, string> = {};
  for (const side of ["top", "bottom", "left", "right"] as const) {
    out[`--tg-safe-area-inset-${side}`] = px(safe?.[side]);
    out[`--tg-content-safe-area-inset-${side}`] = px(content?.[side]);
  }
  return out;
}

/** Brend tokeni (#rrggbb) — Telegram setHeaderColor/setBackgroundColor faqat shu ko'rinishni qabul qiladi */
export function hexColor(value: string | undefined): string | null {
  const v = (value ?? "").trim();
  if (/^#[0-9a-f]{6}$/i.test(v)) return v.toLowerCase();
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(v);
  return short ? `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`.toLowerCase() : null;
}
