"use client";

import { createContext, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { canDisableVerticalSwipes, hexColor, insetVars, versionAtLeast, wantsFullscreen } from "./fullscreen";

/**
 * Har qanday CSS rang (tokenlar 5.0 da oklch; CSS yig'uvchi ularni lab(...) ga aylantiradi) → #rrggbb.
 * Avval sof tahlil (hex, oklch), bo'lmasa — brauzerning o'zi: 1×1 canvas'ga bo'yab, pikselni o'qiymiz (sRGB).
 */
function toHex(value: string): string | null {
  const plain = hexColor(value);
  if (plain || !value.trim()) return plain;
  try {
    const ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.fillStyle = "#000";
    ctx.fillStyle = value.trim();
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    if (!a) return null;
    return "#" + [r, g, b].map((n) => (n ?? 0).toString(16).padStart(2, "0")).join("");
  } catch {
    return null;
  }
}

/** Telegram Mini App SDK ning biz ishlatadigan qismi (window.Telegram.WebApp) */
export interface TelegramWebApp {
  initData: string;
  initDataUnsafe: { user?: { id: number; first_name: string; last_name?: string; username?: string; language_code?: string; photo_url?: string }; start_param?: string };
  colorScheme: "light" | "dark";
  themeParams: Record<string, string>;
  platform: string;
  version: string;
  ready: () => void;
  expand: () => void;
  close: () => void;
  BackButton: { show: () => void; hide: () => void; onClick: (cb: () => void) => void; offClick: (cb: () => void) => void; isVisible: boolean };
  MainButton: { show: () => void; hide: () => void; setText: (t: string) => void; onClick: (cb: () => void) => void; offClick: (cb: () => void) => void; showProgress: (leaveActive?: boolean) => void; hideProgress: () => void; enable: () => void; disable: () => void };
  HapticFeedback?: { impactOccurred: (style: "light" | "medium" | "heavy" | "rigid" | "soft") => void; notificationOccurred: (type: "error" | "success" | "warning") => void };
  openTelegramLink: (url: string) => void;
  openLink: (url: string) => void;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  /** Bot API 7.10+ */
  setBottomBarColor?: (color: string) => void;
  enableClosingConfirmation?: () => void;
  /** Bot API 7.7+: pastga surish bilan yopilmasin (ro'yxat aylantirilganda) */
  disableVerticalSwipes?: () => void;
  /** Bot API 8.0+: telefonda butun ekran (Telegram sarlavhasisiz) */
  requestFullscreen?: () => void;
  isFullscreen?: boolean;
  /** Bot API 8.0+: tizim paneli va Telegram'ning ✕/⋯ tugmalari egallagan joy (px) */
  safeAreaInset?: { top: number; bottom: number; left: number; right: number };
  contentSafeAreaInset?: { top: number; bottom: number; left: number; right: number };
  onEvent?: (event: string, cb: () => void) => void;
  offEvent?: (event: string, cb: () => void) => void;
  /** Bot API 6.9+: foydalanuvchi raqamini botga ulashadi (Telegram tasdiqlagan raqam, SMS kodsiz) */
  requestContact?: (callback?: (shared: boolean) => void) => void;
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

type TelegramContextValue = {
  /** Telegram ichida ochilganmi */
  isTelegram: boolean;
  webApp: TelegramWebApp | null;
  /** natija haqida qisqa tebranish (faqat foydalanuvchi amalining natijasida; bezak uchun emas) */
  notify: (type: "success" | "error" | "warning") => void;
};

const TelegramContext = createContext<TelegramContextValue>({ isTelegram: false, webApp: null, notify: () => {} });

const ROOT_PATHS = new Set(["/", "/jobs", "/workers", "/applications", "/messages", "/profile", "/employer", "/employer/candidates", "/employer/vacancies"]);

/** SDK odatda gidratsiyadan oldin tayyor; tarmoq sekin bo'lib keyinroq yuklansa — "tg-sdk" hodisasi (layout.tsx) */
function subscribeSdk(cb: () => void) {
  window.addEventListener("tg-sdk", cb);
  return () => window.removeEventListener("tg-sdk", cb);
}
/** Telegram SDK tashqi tizim: initData bo'lsa — Mini App ichidamiz */
function getWebAppSnapshot(): TelegramWebApp | null {
  const wa = window.Telegram?.WebApp;
  return wa && wa.initData ? wa : null;
}

export function TelegramProvider({ children }: { children: ReactNode }) {
  const webApp = useSyncExternalStore(subscribeSdk, getWebAppSnapshot, () => null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!webApp) return;
    const root = document.documentElement;
    webApp.ready();
    webApp.expand();
    root.classList.add("tg");
    // ega (2026-11-17): "kirganda birinchi kunduzgi rejim" — Telegram tungi bo'lsa ham; tungi faqat sozlamada tanlansa
    // ("Tungi" yoki "Tizim bo'yicha" — unda Telegram'ning rejimiga ergashadi)
    const chosen = document.cookie.match(/(?:^|; )ishuz_theme=(dark|light|system)/)?.[1];
    if (chosen === "dark" || (chosen === "system" && webApp.colorScheme === "dark")) root.classList.add("dark");
    // eski Telegram versiyalarida usul yo'q yoki xato tashlaydi — ilova baribir ochiladi
    const safely = (fn: (() => void) | undefined) => {
      try {
        fn?.();
      } catch {
        // qo'llab-quvvatlanmaydi
      }
    };

    // Telegram panellari ilova ranglarida (yuqori — karta, orqa fon — sahifa, pastki — pastki menyu)
    const paintChrome = () => {
      const css = getComputedStyle(root);
      const card = toHex(css.getPropertyValue("--card"));
      const bg = toHex(css.getPropertyValue("--background"));
      if (card && versionAtLeast(webApp.version, "6.9")) safely(() => webApp.setHeaderColor?.(card));
      if (bg && versionAtLeast(webApp.version, "6.1")) safely(() => webApp.setBackgroundColor?.(bg));
      if (card && versionAtLeast(webApp.version, "7.10")) safely(() => webApp.setBottomBarColor?.(card));
    };
    // to'liq ekranda sahifa tizim paneli va Telegram tugmalari ostidan boshlanadi (globals.css: html.tg-fullscreen)
    const syncInsets = () => {
      for (const [k, v] of Object.entries(insetVars(webApp.safeAreaInset, webApp.contentSafeAreaInset))) root.style.setProperty(k, v);
      root.classList.toggle("tg-fullscreen", !!webApp.isFullscreen);
    };

    paintChrome();
    syncInsets();
    if (canDisableVerticalSwipes(webApp.version)) safely(() => webApp.disableVerticalSwipes?.());
    const events = ["safeAreaChanged", "contentSafeAreaChanged", "fullscreenChanged", "fullscreenFailed"];
    for (const e of events) webApp.onEvent?.(e, syncInsets);
    webApp.onEvent?.("themeChanged", paintChrome);
    // telefonda haqiqiy ilova kabi: butun ekran (kompyuter Telegram'ida — faqat expand)
    if (wantsFullscreen(webApp.platform, webApp.version) && !webApp.isFullscreen) safely(() => webApp.requestFullscreen?.());
    return () => {
      for (const e of events) webApp.offEvent?.(e, syncInsets);
      webApp.offEvent?.("themeChanged", paintChrome);
    };
  }, [webApp]);

  // Telegram "Orqaga" tugmasi: ildiz sahifalarda yashirin, boshqalarida router.back()
  useEffect(() => {
    if (!webApp) return;
    const onBack = () => router.back();
    if (ROOT_PATHS.has(pathname)) {
      webApp.BackButton.hide();
    } else {
      webApp.BackButton.onClick(onBack);
      webApp.BackButton.show();
    }
    return () => webApp.BackButton.offClick(onBack);
  }, [webApp, pathname, router]);

  const value = useMemo<TelegramContextValue>(
    () => ({
      isTelegram: !!webApp,
      webApp,
      notify: (type) => webApp?.HapticFeedback?.notificationOccurred(type),
    }),
    [webApp],
  );

  return <TelegramContext.Provider value={value}>{children}</TelegramContext.Provider>;
}

export function useTelegram() {
  return useContext(TelegramContext);
}
