import { Skeleton } from "@/components/ui/skeleton";

/** Wizard yuklanayotganda skeleton */
export default function WorkerOnboardingLoading() {
  return (
    <div className="flex min-h-dvh flex-col">
      <div className="h-14 border-b border-border/70 bg-card/90" />
      <div className="container-narrow py-5 sm:py-8">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-10" />
        </div>
        <div className="mt-2 flex gap-1">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-1.5 flex-1 rounded-full" />
          ))}
        </div>
        <Skeleton className="mt-7 h-8 w-2/3" />
        <Skeleton className="mt-2 h-4 w-full" />
        <div className="mt-6 space-y-4">
          <Skeleton className="h-24 rounded-2xl" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Skeleton className="h-12 rounded-xl" />
            <Skeleton className="h-12 rounded-xl" />
          </div>
          <Skeleton className="h-12 rounded-xl" />
          <div className="flex gap-2">
            <Skeleton className="h-10 w-24 rounded-full" />
            <Skeleton className="h-10 w-24 rounded-full" />
            <Skeleton className="h-10 w-24 rounded-full" />
          </div>
          <Skeleton className="h-12 rounded-xl" />
        </div>
        <Skeleton className="mt-8 h-13 rounded-2xl" />
      </div>
    </div>
  );
}
