import type { ReactNode } from "react";
import { getSession } from "@/features/auth/session";
import { unreadCounts } from "./unread-counts";
import type { NavRole } from "./app-shell";
import { AppFrame, type FrameChrome } from "./app-frame";
import { LastSeenPing } from "./last-seen-ping";
import { DraftGuard } from "./draft-guard";
import { getHomeSettings } from "@/features/home-windows/queries";
import { getMode } from "@/features/mode/server";
import { findModeOf } from "@/features/mode/mode";
import { billingEnabled } from "@/lib/features";
import { phoneLoginHref } from "@/features/entry/auth-links";

/**
 * Umumiy sahifa qobig'i: yuqori panel + (mobil) pastki navigatsiya.
 * Rejim (ish izlovchi / ish beruvchi): features/mode — navigatsiya nomlari va lupa shu rejimda; kirmagan bo'lsa rol — guest.
 * Ma'lumot shu yerda (serverda) olinadi, chizish — AppFrame (mijoz): u qobiqni eslab qoladi, keyingi sahifa
 * yuklanayotganda panel va menyu joyida turadi.
 */
export async function Shell({ children, forceRole, hideNav, footer }: { children: ReactNode; forceRole?: NavRole; hideNav?: boolean; footer?: ReactNode }) {
  // sessiya va o'qilmaganlar soni parallel (ketma-ket ikki so'rov emas)
  const [session, unread, home, mode] = await Promise.all([getSession(), unreadCounts(), hideNav ? null : getHomeSettings(), getMode()]);
  const role: NavRole = forceRole ?? (session ? (mode === "employer" ? "employer" : "worker") : "guest");
  const chrome: FrameChrome = {
    top: {
      role,
      mode,
      counts: session ? unread : undefined,
      site: !session && !mode ? { pricing: billingEnabled(), registerHref: phoneLoginHref({ next: "/start", mode: null }) } : null,
      user: session
        ? {
            firstName: session.profile.first_name,
            lastName: session.profile.last_name,
            avatarUrl: session.profile.avatar_url,
            roles: session.roles,
            activeRole: session.activeRole,
          }
        : null,
    },
    ai: home?.aiButton ? { defaultMode: mode ? findModeOf(mode) : "jobs", locked: !!mode } : null,
  };
  return (
    <AppFrame
      chrome={chrome}
      hideNav={hideNav}
      footer={footer}
      extras={
        <>
          {session ? <LastSeenPing /> : null}
          <DraftGuard userId={session?.userId ?? null} />
        </>
      }
    >
      {children}
    </AppFrame>
  );
}
