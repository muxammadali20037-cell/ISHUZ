import { Skeleton, ListSkeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="container-narrow py-5 sm:py-8">
      <Skeleton className="mb-4 h-8 w-40" />
      <Skeleton className="mb-4 h-11 w-full rounded-xl" />
      <ListSkeleton count={4} lines={2} />
    </div>
  );
}
