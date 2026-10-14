import { Skeleton } from "@/components/ui/skeleton";
import { LoadingShell } from "@/components/shared/app-frame";

function MessagesLoadingContent() {
  return (
    <div className="container-narrow py-4 md:py-6">
      <Skeleton className="mb-4 h-7 w-32" />
      <div className="overflow-hidden rounded-2xl border border-border/70 bg-card divide-y divide-border/70">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3.5">
            <Skeleton className="size-14 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-1/3" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Yuklanayotganda: oxirgi sahifaning yuqori paneli va menyusi joyida, kontent o'rnida skelet */
export default function MessagesLoading() {
  return (
    <LoadingShell>
      <MessagesLoadingContent />
    </LoadingShell>
  );
}
