import type { ReactNode } from "react";
import { getSession } from "@/features/auth/session";
import { TopBar, unreadCounts } from "./top-bar";
import { BottomNav, type NavRole } from "./app-shell";
import { LastSeenPing } from "./last-seen-ping";
import { DraftGuard } from "./draft-guard";
import { AiFinder } from "@/features/find/components/ai-finder";
import { getHomeSettings } from "@/features/home-windows/queries";

/**
 * Umumiy sahifa qobig'i: yuqori panel + (mobil) pastki navigatsiya.
 * Rol: sessiyadagi active_role; kirmagan bo'lsa guest.
 */
export async function Shell({ children, forceRole, hideNav }: { children: ReactNode; forceRole?: NavRole; hideNav?: boolean }) {
  // sessiya va o'qilmaganlar soni parallel (ketma-ket ikki so'rov emas)
  const [session, unread, home] = await Promise.all([getSession(), unreadCounts(), hideNav ? null : getHomeSettings()]);
  const role: NavRole = forceRole ?? (session?.activeRole === "employer" ? "employer" : session ? "worker" : "guest");
  const counts = session ? unread : undefined;
  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar role={role} counts={counts} />
      <main className={hideNav ? "flex-1" : "flex-1 page-with-tabbar md:pb-8"}>{children}</main>
      {!hideNav ? <BottomNav role={role} counts={counts} /> : null}
      {/* o'ng pastda doim: "O'zingizga mosini toping" (admin panelda o'chiriladi) */}
      {home?.aiButton ? <AiFinder defaultMode={role === "employer" ? "workers" : "jobs"} /> : null}
      {session ? <LastSeenPing /> : null}
      <DraftGuard userId={session?.userId ?? null} />
    </div>
  );
}
