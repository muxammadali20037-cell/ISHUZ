import { CardSkeleton, Skeleton } from "@/components/ui/skeleton";

/** /profile va ichki sahifalar uchun yuklanish holati */
export function ProfileSkeleton() {
  return (
    <div className="container-app py-4 sm:py-6">
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-6">
        <div className="space-y-4">
          <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-6">
            <div className="flex items-start gap-4">
              <Skeleton className="size-20 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-6 w-1/2" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-1/3" />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <Skeleton className="h-11 w-32 rounded-xl" />
              <Skeleton className="h-11 w-32 rounded-xl" />
            </div>
          </div>
          <CardSkeleton lines={2} />
          <CardSkeleton lines={3} />
          <CardSkeleton lines={2} />
        </div>
        <div className="hidden space-y-4 lg:block">
          <CardSkeleton lines={4} />
          <CardSkeleton lines={1} />
        </div>
      </div>
    </div>
  );
}

/** Sozlamalar sahifasi uchun skeleton */
export function SettingsSkeleton() {
  return (
    <div className="container-narrow space-y-4 py-4 sm:py-6">
      <Skeleton className="h-8 w-40" />
      <CardSkeleton lines={1} />
      <CardSkeleton lines={4} />
      <CardSkeleton lines={2} />
      <CardSkeleton lines={2} />
    </div>
  );
}
