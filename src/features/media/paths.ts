/**
 * Profil rasmi va kompaniya logotipi fayl yo'llari (0059). Mijoz va server uchun umumiy, sof funksiyalar.
 *  · karantin (yopiq):   media-uploads/<tur>/<egasi>/<uuid>.<ext>   — brauzer faqat yuklaydi;
 *  · eski nom (o'tish):  <bucket>/<egasi>/<tur>.<ext>                — 0059 qo'llanmagan bazada brauzer shu yerga yuklaydi;
 *  · tekshirilgan:       <bucket>/<egasi>/v-<sha256>.webp             — faqat server yozadi, o'zgarmaydi.
 * Egasi: profil rasmi — foydalanuvchi id, logotip — kompaniya id.
 */
export type MediaKind = "avatar" | "logo";

export const MEDIA_QUARANTINE = "media-uploads";
export const MEDIA_BUCKET: Record<MediaKind, string> = { avatar: "avatars", logo: "company-logos" };

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const isUuid = (s: string) => new RegExp(`^${UUID}$`).test(s);

export function rawMediaPath(kind: MediaKind, owner: string, ext: string, id: string = crypto.randomUUID()): string {
  return `${kind}/${owner}/${id}.${ext}`;
}

export function legacyMediaPath(kind: MediaKind, owner: string, ext: string): string {
  return `${owner}/${kind}.${ext}`;
}

export function isRawMediaPath(kind: MediaKind, owner: string, path: string): boolean {
  return isUuid(owner) && new RegExp(`^${kind}/${owner}/${UUID}\\.(jpg|png|webp)$`).test(path);
}

export function isLegacyMediaPath(kind: MediaKind, owner: string, path: string): boolean {
  return isUuid(owner) && new RegExp(`^${owner}/${kind}\\.(jpg|png|webp)$`).test(path);
}

export function isVerifiedMediaPath(owner: string, path: string): boolean {
  return isUuid(owner) && new RegExp(`^${owner}/v-[0-9a-f]{64}\\.webp$`).test(path);
}
