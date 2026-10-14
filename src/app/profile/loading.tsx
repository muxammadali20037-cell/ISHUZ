import { ProfileSkeleton } from "@/features/profile/components/profile-skeleton";
import { LoadingShell } from "@/components/shared/app-frame";

function ProfileLoadingContent() {
  return <ProfileSkeleton />;
}

/** Yuklanayotganda: oxirgi sahifaning yuqori paneli va menyusi joyida, kontent o'rnida skelet */
export default function ProfileLoading() {
  return (
    <LoadingShell>
      <ProfileLoadingContent />
    </LoadingShell>
  );
}
