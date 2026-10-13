import type { ReactNode } from "react";
import { getSession } from "@/features/auth/session";
import { TopBar, unreadCounts } from "./top-bar";
import { BottomNav, type NavRole } from "./app-shell";
import { LastSeenPing } from "./last-seen-ping";
import { DraftGuard } from "./draft-guard";
import { AiFinder } from "@/features/find/components/ai-finder";
import { getHomeSettings } from "@/features/home-windows/queries";
import { getMode } from "@/features/mode/server";
import { findModeOf } from "@/features/mode/mode";

/**
 * Umumiy sahifa qobig'i: yuqori panel + (mobil) pastki navigatsiya.
 * Rejim (ish izlovchi / ish beruvchi): features/mode — navigatsiya nomlari va lupa shu rejimda; kirmagan bo'lsa rol — guest.
 */
export async function Shell({ children, forceRole, hideNav }: { children: ReactNode; forceRole?: NavRole; hideNav?: boolean }) {
  // sessiya va o'qilmaganlar soni parallel (ketma-ket ikki so'rov emas)
  const [session, unread, home, mode] = await Promise.all([getSession(), unreadCounts(), hideNav ? null : getHomeSettings(), getMode()]);
  const role: NavRole = forceRole ?? (session ? (mode === "employer" ? "employer" : "worker") : "guest");
  const counts = session ? unread : undefined;
  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar role={role} mode={mode} counts={counts} />
      <main className={hideNav ? "flex-1" : "flex-1 page-with-tabbar md:pb-8"}>{children}</main>
      {!hideNav ? <BottomNav role={role} mode={mode} counts={counts} /> : null}
      {/* o'ng pastda doim: "O'zingizga mosini toping" — joriy rejim ichida qidiradi (admin panelda o'chiriladi) */}
      {home?.aiButton ? <AiFinder key={mode ?? "none"} defaultMode={mode ? findModeOf(mode) : "jobs"} locked={!!mode} /> : null}
      {session ? <LastSeenPing /> : null}
      <DraftGuard userId={session?.userId ?? null} />
    </div>
  );
}
