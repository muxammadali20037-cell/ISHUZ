import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getT } from "@/lib/i18n/server";
import { adminUiEnabled } from "@/lib/features";
import { ADMIN_RECOVER_PATH, adminNext } from "@/features/auth/admin-login";
import { AdminPasswordLogin } from "@/features/auth/components/admin-login";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("auth.admin.title"), robots: { index: false, follow: false } };
}

/** Admin: email + parol (Telegram ishlamaganda). Keyin baribir autentifikator kodi. `?next=` — faqat admin panel ichida */
export default async function AdminPasswordPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (!adminUiEnabled()) notFound();
  const next = adminNext((await searchParams).next);
  return <AdminPasswordLogin next={next} recoverHref={ADMIN_RECOVER_PATH} methodsHref={`/auth?next=${encodeURIComponent(next)}`} />;
}
