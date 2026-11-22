import { getListingImageUrl, type ListingEntity } from "../server";

/**
 * E'lon sahifasida — egasi yaratgan AI surat (bo'lsa): ixcham keng banner (ega, 2026-11-20: "ilovada ham ixcham ko'rinsin").
 * Matn suratda yo'q — sarlavha, maosh va joy sahifaning o'zida. Rasm bo'lmasa (yoki 0087 hali qo'llanmagan) — hech narsa.
 */
export async function ListingPhoto({ entity, id, alt }: { entity: ListingEntity; id: string; alt: string }) {
  const url = await getListingImageUrl(entity, id);
  if (!url) return null;
  return (
    // belgisiz (ega, 2026-11-22: "«AI rasm» yozuvi bo'lmasin"); rasmda aniq odam portreti yo'q — prompt.ts
    <figure className="relative overflow-hidden rounded-xl border border-border bg-secondary" data-listing-photo>
      {/* eslint-disable-next-line @next/next/no-img-element -- Supabase ochiq bucket'idagi tayyor JPEG (o'lchami ma'lum) */}
      <img src={url} alt={alt} width={1536} height={1024} loading="lazy" decoding="async" className="aspect-[16/7] w-full object-cover" />
    </figure>
  );
}
