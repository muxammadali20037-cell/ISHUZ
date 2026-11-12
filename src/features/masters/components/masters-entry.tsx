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
}: {
  title: string;
  desc?: string;
  className?: string;
  compact?: boolean;
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
          : "min-h-14 px-3.5 py-2.5",
        className,
      )}
    >
      <span
        className={cn(
          "flex shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground",
          compact ? "size-7" : "size-10",
        )}
        aria-hidden
      >
        <Wrench className={compact ? "size-4" : "size-5"} />
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={cn("block font-bold", compact ? "text-sm" : "text-base")}
        >
          {title}
        </span>
        {desc && !compact ? (
          <span className="block text-sm text-foreground/80">{desc}</span>
        ) : null}
      </span>
      <ChevronRight className="size-5 shrink-0" aria-hidden />
    </Link>
  );
}
