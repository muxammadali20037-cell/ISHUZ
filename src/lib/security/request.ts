import { createHmac } from "node:crypto";

/**
 * So'rov bo'yicha xavfsizlik yordamchilari (server). Sof funksiyalar — testlanadi.
 *
 * IP: Vercel tashqaridan kelgan X-Forwarded-For / X-Real-IP ni o'zinikiga almashtiradi, shuning uchun bu sarlavhalarga
 * Vercel ortida ishonish mumkin. Boshqa proksi (Cloudflare va h.k.) qo'yilsa — docs/SECURITY_RUNBOOK.md ga qarang.
 * IP odamning kimligi emas: bir NAT/mobil operator ortida ko'p foydalanuvchi bo'ladi — shuning uchun IP limiti
 * yumshoq, qattiq cheklovlar telefon/hisob bo'yicha.
 */
export function clientIp(headers: Headers): string {
  const real = headers.get("x-real-ip")?.trim();
  if (real) return real;
  const xff = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return xff || "unknown";
}

/** Limit "chelagi": IPv4 — o'zi, IPv6 — /64 tarmoq (bir qurilma o'z /64 ichida manzilni cheksiz almashtira oladi) */
export function ipBucket(ip: string): string {
  const v = ip.trim().toLowerCase();
  if (!v.includes(":")) return v;
  const [head] = v.split("%");
  const parts = expandIpv6(head ?? "");
  return parts ? `${parts.slice(0, 4).join(":")}::/64` : v;
}

function expandIpv6(ip: string): string[] | null {
  if (ip.includes(".")) return null; // IPv4-mapped — kamdan-kam; o'zgarishsiz
  const halves = ip.split("::");
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const fill = halves.length === 2 ? 8 - left.length - right.length : 0;
  if (fill < 0) return null;
  const all = [...left, ...Array(fill).fill("0"), ...right];
  if (all.length !== 8 || all.some((p) => !/^[0-9a-f]{1,4}$/.test(p))) return null;
  return all.map((p) => p.replace(/^0+(?=.)/, ""));
}

/**
 * Shaxsiy qiymatni (telefon, IP) limit kalitlari va xavfsizlik jurnaliga ochiq yozmaslik uchun: HMAC-SHA256 (32 belgi).
 * Kalit: SECURITY_PEPPER → CRON_SECRET → service kaliti. Almashtirilsa — faqat eski hisoblagichlar "yangilanadi".
 */
export function subjectHash(kind: string, value: string): string {
  const pepper = process.env.SECURITY_PEPPER || process.env.CRON_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "local-dev-pepper";
  return createHmac("sha256", pepper).update(`${kind}:${value}`).digest("hex").slice(0, 32);
}

/**
 * Boshqa saytdan yuborilgan so'rovmi (CSRF/login CSRF). Brauzer POST'da doim Origin yuboradi; boshqa sayt formasi —
 * boshqa Origin. Origin bo'lmasa (curl, server-server) Sec-Fetch-Site ga qaraladi; ikkalasi ham bo'lmasa — brauzer
 * emas, cookie bilan CSRF qilib bo'lmaydi, ruxsat.
 * allowedOrigins — ilova va admin host manzillari (https://...).
 */
export function isCrossSiteRequest(headers: Headers, requestOrigin: string, allowedOrigins: readonly string[] = []): boolean {
  const origin = headers.get("origin");
  if (origin !== null) {
    if (origin === "null") return true;
    const allowed = new Set([requestOrigin, ...allowedOrigins].map((o) => o.replace(/\/$/, "").toLowerCase()));
    return !allowed.has(origin.replace(/\/$/, "").toLowerCase());
  }
  const site = headers.get("sec-fetch-site");
  if (site !== null) return !(site === "same-origin" || site === "none");
  return false;
}

/** JSON qabul qiluvchi so'rov: Content-Type application/json (oddiy HTML forma JSON yubora olmaydi) */
export function isJsonRequest(headers: Headers): boolean {
  return /^application\/json\b/i.test(headers.get("content-type") ?? "");
}
