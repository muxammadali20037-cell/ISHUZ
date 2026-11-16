/** OKLCH → sRGB hex (Björn Ottosson OKLab formulasi; gamut tashqarisi kesiladi). 5.0 tokenlari oklch da —
 *  hex kerak bo'lgan joylar (Telegram panellari, kontrast testi) shu orqali oladi. */
export function oklchToHex(L: number, C: number, H: number): string {
  const a = C * Math.cos((H * Math.PI) / 180);
  const b = C * Math.sin((H * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const lin = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  return (
    "#" +
    lin
      .map((c) => {
        const x = Math.min(1, Math.max(0, c));
        const e = x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055;
        return Math.round(e * 255).toString(16).padStart(2, "0");
      })
      .join("")
  );
}

/** `oklch(L C H)` (L 0–1 yoki %) → hex; boshqa ko'rinish — null */
export function parseOklch(value: string): string | null {
  const m = /^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)(?:deg)?\s*(?:\/\s*[\d.]+%?\s*)?\)$/i.exec(value.trim());
  if (!m) return null;
  const L = m[2] ? Number(m[1]) / 100 : Number(m[1]);
  return oklchToHex(L, Number(m[3]), Number(m[4]));
}
