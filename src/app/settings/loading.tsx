import { SettingsSkeleton } from "@/features/profile/components/profile-skeleton";
import { LoadingShell } from "@/components/shared/app-frame";

function SettingsLoadingContent() {
  return <SettingsSkeleton />;
}

/** Yuklanayotganda: oxirgi sahifaning yuqori paneli va menyusi joyida, kontent o'rnida skelet */
export default function SettingsLoading() {
  return (
    <LoadingShell>
      <SettingsLoadingContent />
    </LoadingShell>
  );
}
