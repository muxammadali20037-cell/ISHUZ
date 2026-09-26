import { Skeleton } from "@/components/ui/skeleton";

export default function NotificationsLoading() {
  return (
    <div className="container-narrow py-4 md:py-6">
      <Skeleton className="mb-4 h-7 w-48" />
      <Skeleton className="mb-3 h-3 w-24" />
      <div className="overflow-hidden rounded-2xl border border-border/70 bg-card divide-y divide-border/70">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-start gap-3 px-4 py-3.5">
            <Skeleton className="size-10 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
