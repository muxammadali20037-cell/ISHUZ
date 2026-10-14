import { WorkersPageSkeleton } from "@/features/workers/components/skeletons";
import { LoadingShell } from "@/components/shared/app-frame";

function WorkersLoadingContent() {
  return <WorkersPageSkeleton />;
}

/** Yuklanayotganda: oxirgi sahifaning yuqori paneli va menyusi joyida, kontent o'rnida skelet */
export default function WorkersLoading() {
  return (
    <LoadingShell>
      <WorkersLoadingContent />
    </LoadingShell>
  );
}
