"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTelegram } from "@/lib/telegram/provider";
import { useT } from "@/lib/i18n/client";
import { toast } from "@/components/ui/toast";
import { googleLoginAllowedIn } from "../google-profile";

const noop = () => () => undefined;

/**
 * "Google orqali kirish" (ega, 2026-11-26). Supabase OAuth (PKCE): Google'ga o'tadi, qaytishda
 * /api/auth/google/callback sessiyani shu brauzerda ochadi. Telegram Mini App va boshqa o'rnatilgan oynalarda
 * (Instagram, WebView) Google kirishni bloklaydi — u yerda tugma umuman chiqmaydi.
 */
export function GoogleLoginButton({ next, className, children }: { next: string; className?: string; children: ReactNode }) {
  const { t } = useT();
  const { webApp } = useTelegram();
  const ua = useSyncExternalStore(noop, () => navigator.userAgent, () => null);
  const [pending, setPending] = useState(false);
  if (ua === null || !googleLoginAllowedIn(ua, !!webApp)) return null;

  const start = async () => {
    if (pending) return;
    setPending(true);
    const redirectTo = `${window.location.origin}/api/auth/google/callback?${new URLSearchParams({ next }).toString()}`;
    const { error } = await createClient().auth.signInWithOAuth({ provider: "google", options: { redirectTo, queryParams: { prompt: "select_account" } } });
    if (error) {
      setPending(false);
      toast.error(t("auth.google_failed"));
    }
  };

  return (
    <button type="button" onClick={start} disabled={pending} aria-busy={pending || undefined} className={className} data-google-login data-track="auth_method" data-track-to="google">
      {children}
    </button>
  );
}
