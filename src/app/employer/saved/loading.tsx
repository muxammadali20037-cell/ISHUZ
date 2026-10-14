import { SavedPageSkeleton } from "@/features/workers/components/skeletons";
import { LoadingShell } from "@/components/shared/app-frame";

function SavedLoadingContent() {
  return <SavedPageSkeleton />;
}

/** Yuklanayotganda: oxirgi sahifaning yuqori paneli va menyusi joyida, kontent o'rnida skelet */
export default function SavedLoading() {
  return (
    <LoadingShell>
      <SavedLoadingContent />
    </LoadingShell>
  );
}
