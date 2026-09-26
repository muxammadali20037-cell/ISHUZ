import { Skeleton, CardSkeleton } from "@/components/ui/skeleton";

export function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-border/70 bg-card p-4">
          <Skeleton className="size-9 rounded-xl" />
          <Skeleton className="mt-3 h-7 w-12" />
          <Skeleton className="mt-2 h-3 w-20" />
        </div>
      ))}
    </div>
  );
}

export function CardsSectionSkeleton({ count = 3 }: { count?: number }) {
  return (
    <section className="mt-8">
      <div className="mb-3 flex items-end justify-between">
        <Skeleton className="h-6 w-44" />
        <Skeleton className="h-4 w-24" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: count }).map((_, i) => (
          <CardSkeleton key={i} lines={2} />
        ))}
      </div>
    </section>
  );
}

export function RowsSectionSkeleton({ count = 3 }: { count?: number }) {
  return (
    <section className="mt-8">
      <div className="mb-3 flex items-end justify-between">
        <Skeleton className="h-6 w-44" />
        <Skeleton className="h-4 w-16" />
      </div>
      <div className="divide-y divide-border rounded-2xl border border-border/70 bg-card">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-4">
            <Skeleton className="size-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-1/3" />
            </div>
            <Skeleton className="h-5 w-16 rounded-lg" />
          </div>
        ))}
      </div>
    </section>
  );
}

/** /employer loading.tsx uchun to'liq sahifa skeleti */
export function DashboardSkeleton() {
  return (
    <div className="container-app py-6">
      <div className="flex items-center gap-4">
        <Skeleton className="size-16 rounded-2xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-7 w-2/3 max-w-xs" />
          <Skeleton className="h-4 w-1/2 max-w-[200px]" />
        </div>
      </div>
      <div className="mt-5 flex gap-2">
        <Skeleton className="h-12 w-44 rounded-xl" />
        <Skeleton className="h-12 w-36 rounded-xl" />
      </div>
      <div className="mt-6">
        <StatsSkeleton />
      </div>
      <CardsSectionSkeleton />
      <RowsSectionSkeleton />
    </div>
  );
}
