import { DashboardSkeleton } from "@/features/employer/components/dashboard/skeletons";
import { LoadingShell } from "@/components/shared/app-frame";

function EmployerLoadingContent() {
  return <DashboardSkeleton />;
}

/** Yuklanayotganda: oxirgi sahifaning yuqori paneli va menyusi joyida, kontent o'rnida skelet */
export default function EmployerLoading() {
  return (
    <LoadingShell>
      <EmployerLoadingContent />
    </LoadingShell>
  );
}
