import type { ReactNode } from "react";
import { getSession } from "@/features/auth/session";
import { unreadCounts } from "./unread-counts";
import type { NavRole } from "./app-shell";
import { AppFrame, type FrameChrome } from "./app-frame";
import { LastSeenPing } from "./last-seen-ping";
import { DraftGuard } from "./draft-guard";
import { getMode } from "@/features/mode/server";
import { billingEnabled } from "@/lib/features";
import { phoneLoginHref } from "@/features/entry/auth-links";
import { getHomePlace } from "@/features/landing/home-queries";
import { placeChooserHref } from "@/features/landing/quick-filters";
import { getT } from "@/lib/i18n/server";

/**
 * Umumiy sahifa qobig'i: yuqori panel + (mobil) pastki navigatsiya.
 * Rejim (ish izlovchi / ish beruvchi): features/mode — navigatsiya nomlari va lupa shu rejimda; kirmagan bo'lsa rol — guest.
 * Ma'lumot shu yerda (serverda) olinadi, chizish — AppFrame (mijoz): u qobiqni eslab qoladi, keyingi sahifa
 * yuklanayotganda panel va menyu joyida turadi.
 */
export async function Shell({ children, forceRole, hideNav, footer }: { children: ReactNode; forceRole?: NavRole; hideNav?: boolean; footer?: ReactNode }) {
  // sessiya va o'qilmaganlar soni parallel (ketma-ket ikki so'rov emas)
  const [session, unread, mode] = await Promise.all([getSession(), unreadCounts(), getMode()]);
  const role: NavRole = forceRole ?? (session ? (mode === "employer" ? "employer" : "worker") : "guest");
  // ish qidiruvchi rejimi: telefonda bosh sahifa panelidagi hudud (eslab qolingan; bo'lmasa — butun O'zbekiston)
  const place = mode === "worker" && !hideNav ? await placeLabel() : null;
  const chrome: FrameChrome = {
    top: {
      role,
      mode,
      counts: session ? unread : undefined,
      site: !session && !mode ? { pricing: billingEnabled(), registerHref: phoneLoginHref({ next: "/start", mode: null }) } : null,
      place,
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

async function placeLabel(): Promise<{ label: string; href: string }> {
  const [{ t, name }, place] = await Promise.all([getT(), getHomePlace()]);
  // sarlavhada qisqa: tuman bo'lsa — tuman, bo'lmasa — viloyat
  const label = place.district ? name(place.district) : place.region ? name(place.region) : t("easy.location.whole_country");
  return { label, href: placeChooserHref("jobs") };
}
