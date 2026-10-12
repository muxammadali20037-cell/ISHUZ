"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/client";
import { toast } from "@/components/ui/toast";
import { useTelegram } from "./provider";

const FLAG = "ishuz_tg_auto_login";

/** Supabase sessiya cookie'si bormi (sb-<loyiha>-auth-token, bo'laklangan bo'lishi ham mumkin) */
function hasSessionCookie(): boolean {
  return /(?:^|;\s*)sb-[^=;]+-auth-token(?:\.\d+)?=/.test(document.cookie);
}

function attempted(): boolean {
  try {
    return sessionStorage.getItem(FLAG) === "1";
  } catch {
    return false;
  }
}

function markAttempted() {
  try {
    sessionStorage.setItem(FLAG, "1");
  } catch {
    // saqlab bo'lmasa — keyingi sahifada yana bir marta urinadi (zararsiz)
  }
}

/**
 * Telegram Mini App ochilganda: kirmagan foydalanuvchi Telegram tasdiqlagan ma'lumot (initData, serverda HMAC bilan
 * tekshiriladi) orqali darhol kiradi — "Kirish" tugmasi va kod kerak emas. Ilovaning bir ochilishida bir marta urinadi
 * (server rad etsa yoki bot sozlanmagan bo'lsa — qayta-qayta so'rov yubormaydi). Oddiy brauzerda hech narsa qilmaydi.
 * Kirish sahifasi (/auth) buni o'zi bajaradi.
 */
export function TelegramAutoLogin() {
  const { webApp } = useTelegram();
  const router = useRouter();
  const pathname = usePathname();
  const { t, locale } = useT();
  const started = useRef(false);

  useEffect(() => {
    if (!webApp?.initData || started.current) return;
    if (pathname.startsWith("/auth") || pathname.startsWith("/admin") || pathname === "/blocked") return;
    if (hasSessionCookie() || attempted()) return;
    started.current = true;
    markAttempted();
    fetch("/api/auth/telegram", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ initData: webApp.initData, locale }),
    })
      .then((r) => {
        if (!r.ok) return;
        router.refresh();
        toast.success(t("auth.telegram_signed_in"));
      })
      .catch(() => undefined);
  }, [webApp, pathname, router, locale, t]);

  return null;
}
