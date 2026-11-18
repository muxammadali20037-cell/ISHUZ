/**
 * Telegram Mini App'ga to'g'ridan-to'g'ri havola: https://t.me/<bot>?startapp=<param> — ilova Telegram ichida ochiladi
 * (asosiy Mini App BotFather'da yoqilgan bo'lsa), foydalanuvchi avtomatik kiradi va kerakli sahifaga o'tadi.
 *
 * Telegram cheklovi: start_param — faqat A–Z a–z 0–9 _ -, ko'pi bilan 64 belgi. Shuning uchun yo'l qisqa kodga aylanadi:
 *   /jobs/<slug>        → j_<slug>
 *   /listing/<uuid>     → l_<32 hex>
 *   /workers/<uuid>     → w_<32 hex>
 *   boshqa ichki yo'l   → p_<base64url(yo'l)>
 * Sig'masa — null (chaqiruvchi oddiy sayt havolasini ishlatadi). Ochishda yo'l qat'iy tekshiriladi: faqat ichki, "/" bilan
 * boshlanadigan, xavfsiz belgilardan iborat yo'l (tashqi manzilga yo'naltirib bo'lmaydi).
 */

const MAX = 64;
const SAFE_PARAM = /^[A-Za-z0-9_-]{1,64}$/;
const SAFE_PATH = /^\/(?!\/)[A-Za-z0-9\-._~/?=&%]*$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEX32 = /^[0-9a-f]{32}$/i;

function hexToUuid(h: string): string {
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`.toLowerCase();
}

function b64urlEncode(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): string | null {
  try {
    const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
    return new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
  } catch {
    return null;
  }
}

export function encodeStartParam(path: string): string | null {
  if (!SAFE_PATH.test(path)) return null;
  const parts = path.split("?")[0]!.split("/").filter(Boolean);
  let out: string | null = null;
  if (!path.includes("?") && parts.length === 2) {
    const [kind, id] = parts as [string, string];
    if (kind === "jobs" && /^[A-Za-z0-9-]+$/.test(id)) out = `j_${id}`;
    else if ((kind === "listing" || kind === "workers") && UUID.test(id)) out = `${kind === "listing" ? "l" : "w"}_${id.replace(/-/g, "").toLowerCase()}`;
  }
  if (!out || out.length > MAX) out = `p_${b64urlEncode(path)}`;
  return out.length <= MAX && SAFE_PARAM.test(out) ? out : null;
}

export function decodeStartParam(param: string | null | undefined): string | null {
  if (!param || !SAFE_PARAM.test(param)) return null;
  const [kind, ...rest] = param.split("_");
  const v = rest.join("_");
  let path: string | null = null;
  if (kind === "j" && /^[A-Za-z0-9-]+$/.test(v)) path = `/jobs/${v}`;
  else if (kind === "l" && HEX32.test(v)) path = `/listing/${hexToUuid(v)}`;
  else if (kind === "w" && HEX32.test(v)) path = `/workers/${hexToUuid(v)}`;
  else if (kind === "p") path = b64urlDecode(v);
  return path && SAFE_PATH.test(path) ? path : null;
}

/** t.me havolasi (bot nomi bo'lmasa yoki yo'l sig'masa — null) */
export function miniAppLink(path: string, botUsername: string | null | undefined): string | null {
  const bot = botUsername?.replace(/^@/, "").trim();
  if (!bot || !/^[A-Za-z0-9_]{5,32}$/.test(bot)) return null;
  const param = encodeStartParam(path);
  return param ? `https://t.me/${bot}?startapp=${param}` : null;
}
