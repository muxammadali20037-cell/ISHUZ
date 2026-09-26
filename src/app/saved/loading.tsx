import { CardSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function SavedLoading() {
  return (
    <div className="container-app py-5 sm:py-8" aria-busy>
      <Skeleton className="mb-2 h-7 w-56" />
      <Skeleton className="mb-5 h-4 w-24" />
      <div className="grid gap-3 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <CardSkeleton key={i} lines={2} />
        ))}
      </div>
    </div>
  );
}
