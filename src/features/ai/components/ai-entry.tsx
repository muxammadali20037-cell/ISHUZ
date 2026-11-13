import { NewDot } from "@/components/shared/new-badge";
import Link from "next/link";
import { ChevronRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * "AI yordamchi" kirish kartasi (2026-11-12, egasi: "AI yordamchi bo'limi qani — qo'shib ber, bossa ChatGPT kabi ochilsin").
 * Bosh sahifa va "Kabinetim"da; bosilganda — /ai (suhbat oynasi: chap panel, so'nggi suhbatlar, jarayon izi).
 * Matnlar chaqiruvchidan keladi (server yoki mijoz komponenti) — "Universal ustalar" kartasi bilan bir xil shakl.
 * `dense` — telefonda ixcham plitka (faqat nom): bosh sahifada ikki bo'lim bir qatorda, birinchi e'lon birinchi ekranda qoladi.
 */
export function AiEntry({ title, desc, className, to = "home", dense = false }: { title: string; desc?: string; className?: string; to?: string; dense?: boolean }) {
  return (
    <Link
      href="/ai"
      data-track="ai_entry"
      data-track-to={to}
      data-ai-entry
      className={cn(
        // AI — to'q sariq (Universal ustalar kartasi turkuaz): ikkalasi ham boshqa kartalardan ajralib turadi
        "press flex items-center rounded-xl border border-ai/30 bg-ai-soft text-ai shadow-md shadow-ai/10 hover:border-ai/60",
        dense ? "min-h-11 gap-2 px-2.5 py-2 sm:min-h-14 sm:gap-3 sm:px-3.5 sm:py-2.5" : "min-h-14 gap-3 px-3.5 py-2.5",
        className,
      )}
    >
      <span className={cn("flex shrink-0 items-center justify-center rounded-lg bg-ai text-ai-foreground", dense ? "size-8 sm:size-10" : "size-10")} aria-hidden>
        <Sparkles className={dense ? "size-4 sm:size-5" : "size-5"} />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn("block font-bold [overflow-wrap:anywhere]", dense ? "text-sm leading-tight sm:text-base sm:leading-normal" : "text-base")}>
          {title}
          <NewDot feature="ai" className="ml-1.5 align-middle" />
        </span>
        {desc ? <span className={cn("text-sm text-foreground/80", dense ? "hidden sm:block" : "block")}>{desc}</span> : null}
      </span>
      <ChevronRight className={cn("size-5 shrink-0", dense && "hidden sm:block")} aria-hidden />
    </Link>
  );
}
