"use client";

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { AiFinder } from "@/features/find/components/ai-finder";
import { TopBar, type TopBarProps } from "./top-bar";
import { BottomNav } from "./app-shell";

/** Qobiq ma'lumoti (serverda Shell tayyorlaydi): yuqori panel, pastki menyu va lupa tugmasi */
export interface FrameChrome {
  top: TopBarProps;
  /** "O'zingizga mosini toping" tugmasi (admin o'chirgan bo'lsa — null) */
  ai: { defaultMode: "jobs" | "workers"; locked: boolean } | null;
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

/*
 * Kontent paydo bo'lishi: sahifaga o'tilganda kontent 350 ms da pastdan yumshoq chiqadi (page-enter). Avval skelet
 * ko'rsatilgan bo'lsa — haqiqiy kontent ikkinchi marta "sakramaydi", faqat 200 ms da ochiladi (page-swap).
 * Birinchi yuklanishda (gidratsiya) animatsiya yo'q — server HTML'i darhol ko'rinadi va klass serverdagi bilan bir xil.
 */
let skeletonOnScreen = false;
const noopSubscribe = () => () => {};

/** true — komponent gidratsiya qilinmoqda (server HTML'i ustiga), false — brauzerda yangi chizilmoqda (o'tish) */
function useHydrating() {
  return useSyncExternalStore(
    noopSubscribe,
    () => false,
    () => true,
  );
}

/**
 * Sahifa qobig'i (mijoz): yuqori panel + kontent + (mobil) pastki menyu + lupa tugmasi.
 * `skeleton` — loading.tsx ichida: qobiq oxirgi sahifadagidek, kontent o'rnida skelet.
 */
export function AppFrame({
  chrome,
  hideNav = false,
  skeleton = false,
  extras,
  children,
}: {
  chrome: FrameChrome | null;
  hideNav?: boolean;
  skeleton?: boolean;
  extras?: ReactNode;
  children: ReactNode;
}) {
  const hydrating = useHydrating();
  const [anim] = useState(() => (hydrating ? "" : !skeleton && skeletonOnScreen ? "page-swap" : "page-enter"));

  useEffect(() => {
    if (!skeleton && chrome) {
      remembered = chrome;
      listeners.forEach((fn) => fn());
    }
  }, [skeleton, chrome]);

  useEffect(() => {
    if (!skeleton) return;
    skeletonOnScreen = true;
    return () => {
      skeletonOnScreen = false;
    };
  }, [skeleton]);

  return (
    <div className="flex min-h-dvh flex-col">
      {chrome ? <TopBar {...chrome.top} /> : null}
      <main className={cn(hideNav ? "flex-1" : "flex-1 page-with-tabbar md:pb-8", anim)}>{children}</main>
      {chrome && !hideNav ? <BottomNav role={chrome.top.role} mode={chrome.top.mode} counts={chrome.top.counts} /> : null}
      {/* o'ng pastda doim: "O'zingizga mosini toping" — joriy rejim ichida qidiradi (admin panelda o'chiriladi) */}
      {chrome?.ai ? <AiFinder key={chrome.top.mode ?? "none"} defaultMode={chrome.ai.defaultMode} locked={chrome.ai.locked} /> : null}
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
