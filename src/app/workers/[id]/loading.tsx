import { CandidatePageSkeleton } from "@/features/workers/components/skeletons";
import { LoadingShell } from "@/components/shared/app-frame";

function CandidateLoadingContent() {
  return <CandidatePageSkeleton />;
}

/** Yuklanayotganda: oxirgi sahifaning yuqori paneli va menyusi joyida, kontent o'rnida skelet */
export default function CandidateLoading() {
  return (
    <LoadingShell>
      <CandidateLoadingContent />
    </LoadingShell>
  );
}
