import { BriefcaseBusiness, UsersRound } from "lucide-react";
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
    case "tile_daily_workers":
      return <WindowArtwork art="daily" cover />;
    case "tile_near_workers":
      return <WindowArtwork art="near" cover />;
    case "role_worker":
    case "role_employer": {
      const Icon = slot === "role_worker" ? BriefcaseBusiness : UsersRound;
      return (
        <span className="flex size-full items-center justify-center bg-primary-soft text-primary" aria-hidden>
          <Icon className="size-1/2" strokeWidth={1.6} />
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
