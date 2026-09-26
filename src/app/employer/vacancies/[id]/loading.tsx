import { CardSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="container-app py-5 sm:py-8">
      <Skeleton className="h-7 w-2/3 max-w-md" />
      <Skeleton className="mt-2 h-4 w-1/2 max-w-sm" />
      <div className="mt-4 flex gap-2">
        <Skeleton className="h-11 w-32 rounded-xl" />
        <Skeleton className="h-11 w-28 rounded-xl" />
      </div>
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-2xl" />
        ))}
      </div>
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        <CardSkeleton lines={2} />
        <CardSkeleton lines={2} />
      </div>
    </div>
  );
}
