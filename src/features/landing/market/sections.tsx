import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Vakansiyalar bo'limi skeleti: kartalar/qatorlar balandligiga yaqin — kontent kelganda sahifa siljimaydi */
export function ListSkeleton({ grid = false }: { grid?: boolean }) {
  return (
    <div className="container-wide py-10 sm:py-14" aria-hidden>
      <Skeleton className="h-8 w-56" />
      <Skeleton className="mt-2 h-5 w-80 max-w-full" />
      <div className={cn("mt-6 grid gap-3 sm:gap-4", grid ? "grid-cols-1 sm:grid-cols-2 xl:grid-cols-4" : "grid-cols-1")}>
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className={cn("w-full rounded-2xl", grid ? "h-52" : "h-20")} />
        ))}
      </div>
    </div>
  );
}
