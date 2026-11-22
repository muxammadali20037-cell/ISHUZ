import { getT } from "@/lib/i18n/server";
import { getListingImageUrl, type ListingEntity } from "../server";

/**
 * E'lon sahifasida — egasi yaratgan AI surat (bo'lsa): ixcham keng banner (ega, 2026-11-20: "ilovada ham ixcham ko'rinsin").
 * Matn suratda yo'q — sarlavha, maosh va joy sahifaning o'zida. Rasm bo'lmasa (yoki 0087 hali qo'llanmagan) — hech narsa.
 */
export async function ListingPhoto({ entity, id, alt }: { entity: ListingEntity; id: string; alt: string }) {
  const url = await getListingImageUrl(entity, id);
  if (!url) return null;
  const { t } = await getT();
  return (
    // "AI rasm" belgisi — rasm haqiqiy surat (ish joyi yoki ishchining o'zi) deb o'ylanmasin
    <figure className="relative overflow-hidden rounded-xl border border-border bg-secondary" data-listing-photo>
      {/* eslint-disable-next-line @next/next/no-img-element -- Supabase ochiq bucket'idagi tayyor JPEG (o'lchami ma'lum) */}
      <img src={url} alt={alt} width={1536} height={1024} loading="lazy" decoding="async" className="aspect-[16/7] w-full object-cover" />
      <figcaption className="absolute bottom-2 left-2 rounded-md bg-black/60 px-2 py-0.5 text-xs font-semibold text-white">{t("easy.photo.ai_label")}</figcaption>
    </figure>
  );
}
