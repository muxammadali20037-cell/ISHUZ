import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { requireSession } from "@/features/auth/session";
import { Shell } from "@/components/shared/shell";
import { SettingsView } from "@/features/profile/components/settings/settings-view";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("profile.meta.settings") };
}

export default async function SettingsPage() {
  const session = await requireSession("/settings");
  return (
    <Shell>
      <SettingsView session={session} />
    </Shell>
  );
}
