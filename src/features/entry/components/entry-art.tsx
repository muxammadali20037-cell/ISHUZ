import Image from "next/image";
import { ImageOff } from "lucide-react";
import { BUILTIN_CATALOG_PHOTOS, EMPLOYER_PHOTO, HERO_PHOTO } from "@/features/catalog/photos";
import type { CatalogKey } from "@/features/catalog/catalog";
import { Photo } from "@/components/shared/photo";
import { WindowArtwork } from "@/features/home-windows/window-art";
import { MatchArt } from "@/features/intro/intro-art";
import { entryMediaUrl, type EntryMedia, type EntrySlot } from "../media";
import { cn } from "@/lib/utils";

/** O'rnatilgan tasvir (admin rasm yuklamaguncha): faqat brend tokenlari, tarmoqsiz */
function BuiltinArt({ slot }: { slot: EntrySlot }) {
  switch (slot) {
    case "intro_jobs":
      return <WindowArtwork art="jobs" cover />;
    case "intro_workers":
      return <WindowArtwork art="workers" cover />;
    case "intro_ai":
      return <MatchArt />;
    case "home_photo":
      return <Image src={HERO_PHOTO} alt="" sizes="320px" className="size-full object-cover" />;
    case "role_worker":
      // 2.0: egasi bergan suratlar (admin boshqasini yuklaguncha) — ish izlovchi: qurilishdagi ishchi; ish beruvchi: do'kon boshqaruvchisi
      return <Image src={HERO_PHOTO} alt="" sizes="320px" className="size-full object-cover object-top" />;
    case "role_employer":
      return <Image src={EMPLOYER_PHOTO} alt="" sizes="320px" className="size-full object-cover" />;
    default: {
      // kasblar katalogi: o'rnatilgan surat yoki "surat yo'q" (bunday soha saytda "Boshqa kasblar" ro'yxatida)
      const photo = BUILTIN_CATALOG_PHOTOS[slot.slice(4) as CatalogKey];
      return photo ? (
        <Image src={photo} alt="" sizes="320px" className="size-full object-cover" />
      ) : (
        <span className="flex size-full items-center justify-center bg-muted text-muted-foreground" aria-hidden>
          <ImageOff className="size-8" strokeWidth={1.6} />
        </span>
      );
    }
  }
}

/** Joy rasmi: admin yuklagan foto (o'z storage'imizdan) yoki o'rnatilgan tasvir; fayl ochilmasa ham tasvirga qaytadi */
export function EntryImage({ slot, media, sizes, className }: { slot: EntrySlot; media: EntryMedia; sizes: string; className?: string }) {
  const fallback = (
    <span className={cn("block overflow-hidden", className)} aria-hidden>
      <BuiltinArt slot={slot} />
    </span>
  );
  return <Photo src={entryMediaUrl(media[slot])} alt="" sizes={sizes} className={className} fallback={fallback} />;
}
