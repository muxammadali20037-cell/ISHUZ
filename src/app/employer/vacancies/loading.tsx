import { ListSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="container-app py-5 sm:py-8">
      <div className="mb-4 flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-11 w-36 rounded-xl" />
      </div>
      <Skeleton className="mb-4 h-11 w-full max-w-md rounded-xl" />
      <ListSkeleton count={4} lines={2} />
    </div>
  );
}
