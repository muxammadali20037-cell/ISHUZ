import { Skeleton, ListSkeleton } from "@/components/ui/skeleton";
import { LoadingShell } from "@/components/shared/app-frame";

function LoadingContent() {
  return (
    <div className="container-narrow py-5 sm:py-8">
      <Skeleton className="mb-4 h-8 w-40" />
      <Skeleton className="mb-4 h-11 w-full rounded-xl" />
      <ListSkeleton count={3} lines={2} />
    </div>
  );
}

/** Yuklanayotganda: oxirgi sahifaning yuqori paneli va menyusi joyida, kontent o'rnida skelet */
export default function Loading() {
  return (
    <LoadingShell>
      <LoadingContent />
    </LoadingShell>
  );
}
