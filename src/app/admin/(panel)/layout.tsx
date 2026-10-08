import type { ReactNode } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { adminUiEnabled } from "@/lib/features";
import { getAdminContext } from "@/features/admin/context";
import { AdminShell } from "@/features/admin/components/admin-shell";

// admin sahifalari qidiruv tizimlariga ko'rinmaydi (proxy ham X-Robots-Tag qo'yadi)
export const metadata: Metadata = { robots: { index: false, follow: false, nocache: true } };

/** Admin panel layout: o'z qobig'i (public Shell emas). Har sahifa ham requireAdmin + ruxsat tekshiradi. */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  // ADMIN_UI_ENABLED=false bo'lsa panel butunlay o'chiq; aks holda u alohida hostda (ADMIN_HOST) ochiladi
  if (!adminUiEnabled()) notFound();
  const ctx = await getAdminContext();
  return <AdminShell ctx={ctx}>{children}</AdminShell>;
}
