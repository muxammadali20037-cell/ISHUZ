import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getT } from "@/lib/i18n/server";
import { requireSession, requireWorker } from "@/features/auth/session";
import { Shell } from "@/components/shared/shell";
import { ProfileEditor } from "@/features/profile/components/edit/profile-editor";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("profile.meta.edit") };
}

/** /profile/edit: worker talab qilinadi; faqat employer bo'lsa → /company/settings */
export default async function ProfileEditPage() {
  const pre = await requireSession("/profile/edit");
  if (!pre.workerId && pre.employerId) redirect("/company/settings");
  const session = await requireWorker("/profile/edit");
  return (
    <Shell>
      <ProfileEditor session={session} workerId={session.workerId} />
    </Shell>
  );
}
