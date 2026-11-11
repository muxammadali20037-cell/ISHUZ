import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { categoryHref } from "../catalog";
import type { CatalogItem } from "../queries";

const num = (n: number) => new Intl.NumberFormat("ru-RU").format(n);

/**
 * Suratli soha kartasi: 4:3 surat (hamma kartada bir xil nisbat, layout siljimaydi), ostida soha nomi va haqiqiy vakansiyalar
 * soni. Matn surat ustida emas — kontrast har qanday suratda bir xil. Hover: surat sekin yaqinlashadi (harakat kamaytirilganda —
 * yo'q), chegara ko'k. Butun karta — bitta havola (/jobs?category=…).
 */
export function CategoryPhotoCard({ item, countLabel, sizes, priority = false }: { item: CatalogItem; countLabel: (count: string) => string; sizes: string; priority?: boolean }) {
  if (!item.photo) return null;
  return (
    <Link
      href={categoryHref(item.slug)}
      prefetch={false}
      data-track="home_category"
      data-track-to={item.slug}
      className="group flex w-full flex-col overflow-hidden rounded-2xl border border-border bg-card transition-[border-color,box-shadow] duration-200 hover:border-primary/40 hover:shadow-md"
    >
      <span className="relative block aspect-[4/3] overflow-hidden bg-muted">
        {item.photo.kind === "static" ? (
          <Image
            src={item.photo.src}
            alt={item.alt}
            fill
            sizes={sizes}
            placeholder="blur"
            priority={priority}
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          />
        ) : (
          // admin yuklagan surat: o'z storage'imizda, yuklashda WebP ga qayta kodlangan (≤1600 px)
          <Image
            src={item.photo.src}
            alt={item.alt}
            fill
            unoptimized
            sizes={sizes}
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          />
        )}
      </span>
      <span className="flex flex-1 items-center gap-3 p-3 sm:p-4">
        <span className="min-w-0 flex-1">
          <span className="block break-words font-display text-base font-semibold leading-snug text-foreground sm:text-lg">{item.label}</span>
          {item.count ? <span className="mt-0.5 block text-sm text-muted-foreground">{countLabel(num(item.count))}</span> : null}
        </span>
        <span
          className="hidden size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-ink transition-colors group-hover:bg-primary group-hover:text-primary-foreground sm:flex"
          aria-hidden
        >
          <ArrowUpRight className="size-4.5" />
        </span>
      </span>
    </Link>
  );
}
