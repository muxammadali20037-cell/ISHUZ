import { Skeleton, ListSkeleton } from "@/components/ui/skeleton";

/** Natijalar bloki (son + saralash + kartalar) */
export function WorkersResultsSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="space-y-3" aria-busy="true">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-10 w-40 rounded-xl" />
      </div>
      <ListSkeleton count={count} lines={2} />
    </div>
  );
}

/** Qidiruv sahifasi to'liq skeleti (loading.tsx) */
export function WorkersPageSkeleton() {
  return (
    <div className="container-app py-4 md:py-6" aria-busy="true">
      <Skeleton className="mb-4 h-7 w-40" />
      <Skeleton className="h-12 w-full rounded-xl" />
      <div className="mt-3 flex gap-2 overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-24 shrink-0 rounded-full" />
        ))}
      </div>
      <div className="mt-5">
        <WorkersResultsSkeleton />
      </div>
    </div>
  );
}

/** Nomzod sahifasi skeleti */
export function CandidatePageSkeleton() {
  return (
    <div className="container-app py-4 md:py-6" aria-busy="true">
      <Skeleton className="mb-4 h-6 w-32" />
      <div className="grid gap-6 md:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-border/70 bg-card p-5">
            <div className="flex items-start gap-4">
              <Skeleton className="size-20 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-6 w-1/2" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-1/3" />
              </div>
            </div>
          </div>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-border/70 bg-card p-5">
              <Skeleton className="mb-3 h-5 w-32" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="mt-2 h-4 w-5/6" />
            </div>
          ))}
        </div>
        <div className="hidden space-y-4 md:block">
          <Skeleton className="h-44 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

/** Saqlanganlar sahifasi skeleti */
export function SavedPageSkeleton() {
  return (
    <div className="container-app py-4 md:py-6" aria-busy="true">
      <Skeleton className="mb-1 h-7 w-56" />
      <Skeleton className="mb-4 h-4 w-24" />
      <div className="mb-4 flex gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-24 rounded-full" />
        ))}
      </div>
      <ListSkeleton count={4} lines={2} />
    </div>
  );
}
