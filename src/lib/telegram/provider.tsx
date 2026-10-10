"use client";

import { createContext, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";

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
  enableClosingConfirmation?: () => void;
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
  haptic: (style?: "light" | "medium" | "heavy") => void;
  notify: (type: "success" | "error" | "warning") => void;
};

const TelegramContext = createContext<TelegramContextValue>({ isTelegram: false, webApp: null, haptic: () => {}, notify: () => {} });

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
    webApp.ready();
    webApp.expand();
    document.documentElement.classList.add("tg");
    if (webApp.colorScheme === "dark") document.documentElement.classList.add("dark");
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
      haptic: (style = "light") => webApp?.HapticFeedback?.impactOccurred(style),
      notify: (type) => webApp?.HapticFeedback?.notificationOccurred(type),
    }),
    [webApp],
  );

  return <TelegramContext.Provider value={value}>{children}</TelegramContext.Provider>;
}

export function useTelegram() {
  return useContext(TelegramContext);
}
