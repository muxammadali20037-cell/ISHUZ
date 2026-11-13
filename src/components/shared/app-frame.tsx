"use client";

import type { SocialLink } from "@/lib/social";
import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { TopBar, type TopBarProps } from "./top-bar";
import { BottomNav, SideNav } from "./app-shell";
import { GlobalBack } from "./global-back";

/** Qobiq ma'lumoti (serverda Shell tayyorlaydi): yuqori panel va pastki menyu */
export interface FrameChrome {
  top: TopBarProps;
  /** rasmiy Telegram va Instagram (yon menyuda) */
  social?: SocialLink[];
}

/*
 * Oxirgi ko'rsatilgan qobiq: sahifa yuklanayotganda (loading.tsx) xuddi shu panel va menyu joyida qoladi —
 * ekran butunlay skeletga aylanib, menyu yo'qolib qolmaydi (operator panelidagi kabi faqat kontent almashadi).
 * Faqat brauzerda: serverda va gidratsiyada null (birinchi ochilishda yuklanish skeleti avvalgidek).
 */
let remembered: FrameChrome | null = null;
const listeners = new Set<() => void>();
function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Sahifa qobig'i (mijoz): yuqori panel + kontent + (mobil) pastki menyu. AI qidiruv — sahifalarda, qidiruv yonida (suzuvchi tugma yo'q).
 * `skeleton` — loading.tsx ichida: qobiq oxirgi sahifadagidek, kontent o'rnida skelet.
 */
export function AppFrame({
  chrome,
  hideNav = false,
  skeleton = false,
  extras,
  footer,
  children,
}: {
  chrome: FrameChrome | null;
  hideNav?: boolean;
  skeleton?: boolean;
  extras?: ReactNode;
  /** sahifa pastki qismi (bosh sahifa): <main> dan tashqarida — ekran o'qigichlari uchun alohida "contentinfo" hudud */
  footer?: ReactNode;
  children: ReactNode;
}) {
  // sahifa almashganda kontent darhol (animatsiyasiz) ko'rinadi — namunadagidek tez; skelet ham oniy

  useEffect(() => {
    if (!skeleton && chrome) {
      remembered = chrome;
      listeners.forEach((fn) => fn());
    }
  }, [skeleton, chrome]);


  // kirgan foydalanuvchi, kompyuter (lg+): chap yon menyu (2026-11); yuqori paneldagi bo'lim havolalari o'shanda yashiriladi
  // kirgan foydalanuvchi, kompyuter (lg+): ekran bo'yi to'q ko'k yon menyu, yuqori panel yo'q ("SAT MASTER" uslubi, 2026-11)
  const side = !!chrome?.top.user && !hideNav;
  return (
    <div className={cn("flex min-h-dvh flex-col", side && "lg:pl-64")}>
      {chrome ? <TopBar {...chrome.top} side={side} back={!hideNav} /> : null}
      {side && chrome ? <SideNav mode={chrome.top.mode} counts={chrome.top.counts} user={chrome.top.user} social={chrome.social} /> : null}
      {/* pastki qism bo'lsa — pastki menyu uchun joy o'sha yerda (aks holda kontent ostida) */}
      {/* kompyuterda sahifa tepasida kichik "‹ Orqaga" (telefonda — yuqori panelda); bosh sahifada yo'q; menyusiz ustalarda —
          pastki katta "Orqaga" tugmasi bor. <main> dan tashqarida: navigatsiya, sahifa mazmuni emas */}
      {hideNav ? null : <GlobalBack />}
      <main className={cn("min-w-0 flex-1", hideNav || footer ? "" : "page-with-tabbar md:pb-8", side && "lg:pt-2")}>{children}</main>
      {footer}
      {chrome && !hideNav ? <BottomNav role={chrome.top.role} mode={chrome.top.mode} counts={chrome.top.counts} /> : null}
      {extras}
    </div>
  );
}

/** loading.tsx uchun: oxirgi sahifaning qobig'i ichida skelet (qobiq bo'lmasa — avvalgidek faqat skelet) */
export function LoadingShell({ children, hideNav = false }: { children: ReactNode; hideNav?: boolean }) {
  const chrome = useSyncExternalStore(
    subscribe,
    () => remembered,
    () => null,
  );
  return (
    <AppFrame chrome={chrome} hideNav={hideNav} skeleton>
      {children}
    </AppFrame>
  );
}
