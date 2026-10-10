/**
 * Xavfsizlik sarlavhalari (sof funksiya: next.config.ts va testlar ishlatadi).
 *
 * CSP 1-bosqich (majburiy): tashqi skript/ulanish/rasm manbalari ro'yxat bilan, plaginlar va <base> yo'q, formalar faqat o'zimizga,
 * sahifani faqat o'zimiz va Telegram Web ramkaga ola oladi; admin panel — hech kim.
 * 'unsafe-inline' (skript) hozircha qoladi: Next.js App Router inline RSC skriptlari nonce'siz ishlamaydi, nonce esa barcha
 * sahifalarni dinamik qiladi (kesh yo'qoladi). 2-bosqich (nonce + 'strict-dynamic') — docs/SECURITY_PLAN.md.
 */

export interface CspOptions {
  supabaseUrl?: string | null;
  /** admin panel: ramkaga olish butunlay taqiqlanadi */
  admin?: boolean;
  dev?: boolean;
}

/** Telegram Web (brauzer) Mini App'ni iframe ichida ochadi; mobil/desktop ilovalar — o'z webview'i */
export const TELEGRAM_FRAME_ANCESTORS = ["https://web.telegram.org", "https://webk.telegram.org", "https://webz.telegram.org"] as const;

function originOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? u.origin : null;
  } catch {
    return null;
  }
}

export function buildCsp({ supabaseUrl, admin = false, dev = false }: CspOptions): string {
  const sb = originOf(supabaseUrl);
  const sbWs = sb ? sb.replace(/^http/, "ws") : null;
  const list = (...xs: (string | null | false | undefined)[]) => xs.filter(Boolean).join(" ");
  const directives: [string, string][] = [
    ["default-src", "'self'"],
    ["base-uri", "'self'"],
    ["object-src", "'none'"],
    ["form-action", "'self'"],
    ["frame-ancestors", admin ? "'none'" : list("'self'", ...TELEGRAM_FRAME_ANCESTORS)],
    ["frame-src", "'self'"],
    ["script-src", list("'self'", "'unsafe-inline'", dev && "'unsafe-eval'", "https://telegram.org")],
    ["style-src", "'self' 'unsafe-inline'"],
    ["img-src", list("'self'", "data:", "blob:", sb, "https://t.me", "https://*.telesco.pe")],
    ["media-src", list("'self'", "blob:", sb)],
    ["font-src", "'self' data:"],
    ["connect-src", list("'self'", sb, sbWs, dev && "ws:")],
    ["worker-src", "'self' blob:"],
    ["manifest-src", "'self'"],
  ];
  if (!dev) directives.push(["upgrade-insecure-requests", ""]);
  return directives.map(([k, v]) => (v ? `${k} ${v}` : k)).join("; ");
}

export interface HeaderPair {
  key: string;
  value: string;
}

/** Barcha javoblar uchun */
export function baseSecurityHeaders(opts: CspOptions): HeaderPair[] {
  const h: HeaderPair[] = [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=(self), payment=(), usb=(), interest-cohort=()" },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
    { key: "Content-Security-Policy", value: buildCsp(opts) },
  ];
  if (!opts.dev) h.push({ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" });
  return h;
}

/** Admin panel (alohida host yoki /admin yo'li): ramka taqiqi ikki usulda */
export function adminSecurityHeaders(opts: Omit<CspOptions, "admin">): HeaderPair[] {
  return [
    { key: "Content-Security-Policy", value: buildCsp({ ...opts, admin: true }) },
    { key: "X-Frame-Options", value: "DENY" },
  ];
}
