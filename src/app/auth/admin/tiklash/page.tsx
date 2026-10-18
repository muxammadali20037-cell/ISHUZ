import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getT } from "@/lib/i18n/server";
import { adminUiEnabled } from "@/lib/features";
import { ADMIN_LOGIN_PATH } from "@/features/auth/admin-login";
import { AdminRecover } from "@/features/auth/components/admin-login";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("auth.admin.recover_title"), robots: { index: false, follow: false } };
}

/** Admin: parol o'rnatish / tiklash havolasini emailga so'rash */
export default function AdminRecoverPage() {
  if (!adminUiEnabled()) notFound();
  return <AdminRecover loginHref={ADMIN_LOGIN_PATH} />;
}
