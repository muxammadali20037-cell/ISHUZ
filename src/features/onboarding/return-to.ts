import { safeInternalPath } from "@/lib/security/safe-path";

/**
 * Onboardingdan keyin qaytish manzili (F1): masalan, ariza tugmasidan kelgan foydalanuvchi profilini to'ldirgach aynan o'sha
 * vakansiyaga (ariza oynasi ochiq) qaytadi. Qadamlar orasida URL'da yo'qolmasligi uchun shu tabning sessionStorage'ida,
 * 1 soatgacha; faqat shu saytdagi yo'l (safeInternalPath). Bir marta o'qiladi va o'chiriladi.
 */
const KEY = "ib_onb_return";
const TTL_MS = 60 * 60 * 1000;

export function rememberReturnTo(path: string, now = Date.now()): void {
  const safe = safeInternalPath(path, "");
  if (!safe) return;
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ path: safe, at: now }));
  } catch {
    // sessionStorage yo'q (maxfiy rejim cheklovi) — odatiy yakuniy sahifa ishlatiladi
  }
}

export function takeReturnTo(now = Date.now()): string | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as { path?: unknown; at?: unknown };
    if (typeof v.path !== "string" || typeof v.at !== "number" || now - v.at > TTL_MS || now < v.at) return null;
    return safeInternalPath(v.path, "") || null;
  } catch {
    return null;
  }
}
