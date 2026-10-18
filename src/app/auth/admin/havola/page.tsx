import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getT } from "@/lib/i18n/server";
import { adminUiEnabled } from "@/lib/features";
import { ADMIN_RECOVER_PATH } from "@/features/auth/admin-login";
import { AdminLinkLanding } from "@/features/auth/components/admin-login";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("auth.admin.link_title"), robots: { index: false, follow: false }, referrer: "no-referrer" };
}

/** Emaildagi havola qaytadigan joy (tokenlar URL qismida — serverga yetmaydi; sessiyani brauzer ochadi) */
export default function AdminLinkPage() {
  if (!adminUiEnabled()) notFound();
  return <AdminLinkLanding recoverHref={ADMIN_RECOVER_PATH} />;
}
