/**
 * Rasmiy ijtimoiy tarmoq sahifalari (Telegram kanal, Instagram) — Vercel'dagi SOCIAL_*_URL dan (egasi sozlagan; soxta havola
 * yo'q: sozlanmagan tarmoq ko'rsatilmaydi). Foydalanuvchiga nomi va @manzili bilan ko'rsatiladi.
 */
export type SocialKey = "telegram" | "instagram" | "facebook";

export interface SocialLink {
  key: SocialKey;
  href: string;
  /** "@ish_topdim_uz" — URL'dan olinadi; aniqlab bo'lmasa null */
  handle: string | null;
}

const LABEL: Record<SocialKey, string> = { telegram: "Telegram", instagram: "Instagram", facebook: "Facebook" };
export const socialLabel = (k: SocialKey) => LABEL[k];

/** URL'dagi birinchi yo'l bo'lagi — sahifa nomi: t.me/ish_topdim_uz → @ish_topdim_uz, instagram.com/ishtopdim/ → @ishtopdim */
export function socialHandle(href: string): string | null {
  try {
    const u = new URL(href);
    if (u.protocol !== "https:") return null;
    const first = u.pathname.split("/").filter(Boolean)[0];
    return first && /^[A-Za-z0-9_.]{3,64}$/.test(first) ? `@${first}` : null;
  } catch {
    return null;
  }
}

export function socialLinks(env: { SOCIAL_TELEGRAM_URL?: string; SOCIAL_INSTAGRAM_URL?: string; SOCIAL_FACEBOOK_URL?: string }): SocialLink[] {
  const list: [SocialKey, string | undefined][] = [
    ["telegram", env.SOCIAL_TELEGRAM_URL],
    ["instagram", env.SOCIAL_INSTAGRAM_URL],
    ["facebook", env.SOCIAL_FACEBOOK_URL],
  ];
  return list.filter((x): x is [SocialKey, string] => !!x[1] && x[1].startsWith("https://")).map(([key, href]) => ({ key, href, handle: socialHandle(href) }));
}
