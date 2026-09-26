import { Skeleton, CardSkeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="container-narrow py-4 sm:py-8">
      <div className="mb-4 flex items-center gap-3">
        <Skeleton className="size-10 rounded-xl" />
        <Skeleton className="h-7 w-32" />
      </div>
      <div className="space-y-4">
        <CardSkeleton lines={2} />
        <Skeleton className="h-16 w-full rounded-2xl" />
        <CardSkeleton lines={4} />
        <CardSkeleton lines={5} />
      </div>
    </div>
  );
}
