"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, RotateCw } from "lucide-react";
import { useT } from "@/lib/i18n/client";

type Phase = "idle" | "waiting" | "expired" | "blocked";
const POLL_MS = 2000;
const GIVE_UP_MS = 6 * 60 * 1000;

/** bir martalik kirish havolasi (0085); bot yoki baza sozlanmagan bo'lsa — null (eski havola ishlatiladi) */
async function requestLoginUrl(): Promise<string | null> {
  try {
    const r = await fetch("/api/auth/telegram-web/start", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    const j = r.ok ? ((await r.json()) as { url?: string }) : null;
    return j?.url ?? null;
  } catch {
    return null;
  }
}

/**
 * "Telegram orqali kirish" — kodsiz (0085; ega, 2026-11-18: "bossa Telegramga olib kirsin, kod terib yurmasin").
 * Sahifa ochilganda bir martalik so'rov yaratiladi (havola tayyor turadi — mobil brauzer yangi oynani to'smaydi).
 * Bosilganda Telegram ochiladi; foydalanuvchi botda "✅ Kirish"ni bosadi, bu sahifa esa har 2 soniyada (va sahifaga
 * qaytganda darhol) holatni so'raydi — tasdiqlangach o'zi kiradi. Bot yoki 0085 sozlanmagan bo'lsa — eski havola
 * (`?start=login`: bot ochiladi, "Ish topdim" tugmasi Mini App'da avtomatik kiritadi).
 */
export function TelegramWebLoginButton({ botUsername, next, className, children }: { botUsername: string; next: string; className: string; children: React.ReactNode }) {
  const { t } = useT();
  const [url, setUrl] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const startedAt = useRef(0);
  const legacy = `https://t.me/${botUsername}?start=login`;

  useEffect(() => {
    let alive = true;
    void requestLoginUrl().then((u) => {
      if (alive) setUrl(u);
    });
    return () => {
      alive = false;
    };
  }, []);

  const poll = useCallback(async () => {
    if (Date.now() - startedAt.current > GIVE_UP_MS) {
      setPhase("expired");
      return;
    }
    try {
      const r = await fetch("/api/auth/telegram-web/status", { method: "POST", headers: { "content-type": "application/json" }, body: "{}", cache: "no-store" });
      const { status } = (await r.json().catch(() => ({}))) as { status?: string };
      if (status === "ok") {
        // sessiya cookie'lari shu javobda — to'liq yuklash (sarlavha, menyu va rol yangilansin)
        window.location.assign(next);
        return;
      }
      if (status === "blocked") setPhase("blocked");
      else if (status === "expired" || status === "used" || status === "invalid") setPhase("expired");
    } catch {
      /* tarmoq uzildi — keyingi urinishda */
    }
  }, [next]);

  useEffect(() => {
    if (phase !== "waiting") return;
    const id = window.setInterval(() => void poll(), POLL_MS);
    // Telegram'dan qaytganda — kutmay darhol
    const onVisible = () => {
      if (document.visibilityState === "visible") void poll();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [phase, poll]);

  const retry = async () => {
    setPhase("idle");
    setUrl(null);
    setUrl(await requestLoginUrl());
  };

  return (
    <div className="grid gap-3">
      <a
        href={url ?? legacy}
        target="_blank"
        rel="noopener noreferrer"
        data-track="auth_method"
        data-track-to="telegram"
        data-tg-login={url ? "web" : "legacy"}
        className={className}
        onClick={() => {
          if (!url) return;
          startedAt.current = Date.now();
          setPhase("waiting");
        }}
      >
        {children}
      </a>
      {phase === "waiting" ? (
        <div role="status" data-tg-login-waiting className="flex items-start gap-3 rounded-2xl border border-primary/30 bg-primary-soft/50 p-4 text-left">
          <Loader2 className="mt-0.5 size-5 shrink-0 animate-spin text-primary-ink" aria-hidden />
          <div>
            <p className="text-base font-bold">{t("auth.tg_web.waiting_title")}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">{t("auth.tg_web.waiting_desc")}</p>
          </div>
        </div>
      ) : null}
      {phase === "expired" || phase === "blocked" ? (
        <div role="alert" data-tg-login-state={phase} className="space-y-2 rounded-2xl border border-warning/40 bg-warning-soft p-4 text-left">
          <p className="text-base text-warning">{t(phase === "blocked" ? "common.errors.blocked" : "auth.tg_web.expired")}</p>
          {phase === "expired" ? (
            <button type="button" onClick={() => void retry()} className="press inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-4 text-base font-semibold hover:bg-secondary">
              <RotateCw className="size-4" aria-hidden /> {t("auth.tg_web.retry")}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
