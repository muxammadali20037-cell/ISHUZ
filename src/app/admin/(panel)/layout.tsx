import type { ReactNode } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { adminUiEnabled } from "@/lib/features";
import { getAdminContext } from "@/features/admin/context";
import { AdminShell } from "@/features/admin/components/admin-shell";
import { I18nProvider } from "@/lib/i18n/client";
import { getLocale } from "@/lib/i18n/server";
import { clientMessages } from "@/lib/i18n/translate";

// admin sahifalari qidiruv tizimlariga ko'rinmaydi (proxy ham X-Robots-Tag qo'yadi)
export const metadata: Metadata = { robots: { index: false, follow: false, nocache: true } };

/** Admin panel layout: o'z qobig'i (public Shell emas). Har sahifa ham requireAdmin + ruxsat tekshiradi. */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  // ADMIN_UI_ENABLED=false bo'lsa panel butunlay o'chiq; aks holda u alohida hostda (ADMIN_HOST) ochiladi
  if (!adminUiEnabled()) notFound();
  const [ctx, locale] = await Promise.all([getAdminContext(), getLocale()]);
  // admin tarjimalari faqat panelda (ommaviy sahifalar bundle'iga tushmaydi)
  return (
    <I18nProvider locale={locale} messages={clientMessages(locale, { admin: true })}>
      <AdminShell ctx={ctx}>{children}</AdminShell>
    </I18nProvider>
  );
}
