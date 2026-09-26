import { Skeleton, CardSkeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="container-app py-4 sm:py-8">
      <div className="mb-4 flex items-center gap-3">
        <Skeleton className="size-10 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
      <div className="mb-4 flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-24 rounded-full" />
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <CardSkeleton key={i} lines={2} />
        ))}
      </div>
    </div>
  );
}
