import { CardSkeleton, Skeleton } from "@/components/ui/skeleton";

/** Qidiruv natijalari (sarlavha + kartalar) */
export function ResultsSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="mt-4" aria-busy>
      <div className="mb-3 flex items-center justify-between">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-10 w-44 rounded-xl" />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {Array.from({ length: count }).map((_, i) => (
          <CardSkeleton key={i} lines={2} />
        ))}
      </div>
    </div>
  );
}

/** Qidiruv maydoni + filtr chiplari */
export function JobsHeaderSkeleton() {
  return (
    <div className="space-y-3" aria-busy>
      <Skeleton className="h-12 w-full rounded-xl" />
      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-24 shrink-0 rounded-full" />
        ))}
      </div>
    </div>
  );
}

/** Bosh sahifa bo'limi: sarlavha + gorizontal kartalar */
export function HomeSectionSkeleton() {
  return (
    <section aria-busy>
      <div className="mb-3 flex items-end justify-between">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-24" />
      </div>
      <div className="-mx-4 flex gap-3 overflow-hidden px-4 sm:mx-0 sm:px-0">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="w-[300px] shrink-0 sm:w-[340px]">
            <CardSkeleton lines={2} />
          </div>
        ))}
      </div>
    </section>
  );
}

export function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-busy>
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-24 rounded-2xl" />
      ))}
    </div>
  );
}

/** Vakansiya sahifasi */
export function VacancyDetailSkeleton() {
  return (
    <div className="container-app py-4 sm:py-8" aria-busy>
      <Skeleton className="mb-4 h-5 w-28" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-border/70 bg-card p-5">
            <div className="flex gap-4">
              <Skeleton className="size-16 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-6 w-1/2" />
              </div>
            </div>
          </div>
          <div className="grid gap-3 rounded-2xl border border-border/70 bg-card p-5 sm:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-4 w-36" />
              </div>
            ))}
          </div>
          <div className="space-y-2 rounded-2xl border border-border/70 bg-card p-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-3" style={{ width: `${95 - i * 12}%` }} />
            ))}
          </div>
        </div>
        <div className="hidden lg:block">
          <Skeleton className="h-40 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
