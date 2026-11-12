import { NewBadge } from "@/components/shared/new-badge";
import Link from "next/link";
import { ChevronRight, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * "Universal ustalar" kirish tugmasi — turkuaz rangda (o'z mavzusi: .theme-masters), sayt menyusi va bosh sahifada boshqa
 * bo'limlardan ajralib turadi. Matnlar chaqiruvchidan (server yoki mijoz komponentidan) keladi.
 */
export function MastersEntry({
  title,
  desc,
  className,
  compact = false,
  dense = false,
}: {
  title: string;
  desc?: string;
  className?: string;
  compact?: boolean;
  /** telefonda ixcham plitka (faqat nom), sm dan — to'liq karta: bosh sahifada "AI yordamchi" bilan bir qatorda */
  dense?: boolean;
}) {
  return (
    <Link
      href="/ustalar"
      data-track="masters_entry"
      data-masters-entry
      className={cn(
        "theme-masters press flex items-center gap-3 rounded-xl border border-primary/30 bg-primary-soft text-primary-ink hover:border-primary/60",
        compact
          ? "min-h-11 px-3 text-sm font-semibold"
          : dense
            ? "min-h-11 gap-2 px-2.5 py-2 sm:min-h-14 sm:gap-3 sm:px-3.5 sm:py-2.5"
            : "min-h-14 px-3.5 py-2.5",
        className,
      )}
    >
      <span
        className={cn(
          "flex shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground",
          compact ? "size-7" : dense ? "size-8 sm:size-10" : "size-10",
        )}
        aria-hidden
      >
        <Wrench
          className={compact ? "size-4" : dense ? "size-4 sm:size-5" : "size-5"}
        />
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "flex items-center gap-1.5 font-bold",
            compact
              ? "text-sm"
              : dense
                ? "text-sm leading-tight sm:text-base sm:leading-normal"
                : "text-base",
          )}
        >
          {title}
          {compact ? null : <NewBadge feature="masters" className={dense ? "max-sm:hidden" : undefined} />}
        </span>
        {desc && !compact ? (
          <span
            className={cn(
              "text-sm text-foreground/80",
              dense ? "hidden sm:block" : "block",
            )}
          >
            {desc}
          </span>
        ) : null}
      </span>
      <ChevronRight
        className={cn("size-5 shrink-0", dense && "hidden sm:block")}
        aria-hidden
      />
    </Link>
  );
}
