import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { adminUiEnabled } from "@/lib/features";
import { getAdminContext } from "@/features/admin/context";
import { AdminShell } from "@/features/admin/components/admin-shell";

/** Admin panel layout: o'z qobig'i (public Shell emas). Har sahifa ham requireAdmin + ruxsat tekshiradi. */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  // Joriy relizda admin panel mijoz ilovasida o'chiq (alohida loyiha bo'ladi)
  if (!adminUiEnabled()) notFound();
  const ctx = await getAdminContext();
  return <AdminShell ctx={ctx}>{children}</AdminShell>;
}
