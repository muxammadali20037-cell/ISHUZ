"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Send } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/misc";

/**
 * Brauzerda kodsiz kirish: bosiladi → Telegram ochiladi → bot "Kirishni tasdiqlaysizmi?" → "Ha" → shu sahifa o'zi kiradi.
 * Telefon, SMS yoki kod yozish yo'q.
 */
export function TelegramWebLogin({ next, onUseCode }: { next: string; onUseCode: () => void }) {
  const { t } = useT();
  const router = useRouter();
  const [state, setState] = useState<"idle" | "starting" | "waiting" | "done" | "expired" | "error">("idle");
  const [url, setUrl] = useState<string | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => () => void (timer.current && window.clearTimeout(timer.current)), []);

  const poll = (startedAt: number) => {
    timer.current = window.setTimeout(async () => {
      if (Date.now() - startedAt > 10 * 60 * 1000) {
        setState("expired");
        return;
      }
      try {
        const r = await fetch("/api/auth/telegram/web/poll", { method: "POST" });
        const { status } = (await r.json()) as { status: string };
        if (status === "ok") {
          setState("done");
          router.replace(next);
          router.refresh();
          return;
        }
        if (status === "expired") {
          setState("expired");
          return;
        }
      } catch {
        /* tarmoq uzildi — keyingi urinishda */
      }
      poll(startedAt);
    }, 2000);
  };

  const start = async () => {
    // Oynani darhol ochamiz (brauzer bloklamasligi uchun), manzilni keyin beramiz
    const win = window.open("", "_blank");
    setState("starting");
    try {
      const r = await fetch("/api/auth/telegram/web/start", { method: "POST" });
      const data = (await r.json()) as { url?: string };
      if (!r.ok || !data.url) throw new Error("start");
      setUrl(data.url);
      if (win) win.location.href = data.url;
      else window.location.href = data.url;
      setState("waiting");
      poll(Date.now());
    } catch {
      win?.close();
      setState("error");
    }
  };

  if (state === "waiting" || state === "done") {
    return (
      <div className="space-y-4 rounded-2xl border border-border bg-card p-5 text-center">
        {state === "done" ? <CheckCircle2 className="mx-auto size-10 text-success" /> : <Spinner />}
        <h2 className="text-lg font-bold">{t(state === "done" ? "auth.web_login.done" : "auth.web_login.waiting_title")}</h2>
        {state === "waiting" ? (
          <>
            <ol className="mx-auto max-w-xs list-decimal space-y-1 pl-5 text-left text-sm text-muted-foreground">
              <li>{t("auth.web_login.step1")}</li>
              <li>{t("auth.web_login.step2")}</li>
              <li>{t("auth.web_login.step3")}</li>
            </ol>
            {url ? (
              <Button asChild size="lg" variant="outline" fullWidth>
                <a href={url} target="_blank" rel="noopener noreferrer">
                  <Send className="size-5 text-[#2AABEE]" /> {t("auth.web_login.open_again")}
                </a>
              </Button>
            ) : null}
          </>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {state === "expired" || state === "error" ? (
        <p className="rounded-xl bg-warning-soft p-3 text-sm text-foreground" role="status">
          {t(state === "expired" ? "auth.web_login.expired_web" : "auth.web_login.error")}
        </p>
      ) : null}
      <Button size="lg" className="h-14 w-full bg-[#2AABEE] text-base text-white hover:bg-[#229ED9]" onClick={() => void start()} loading={state === "starting"}>
        <Send className="size-5" /> {t("auth.telegram_login")}
      </Button>
      <p className="text-center text-sm text-muted-foreground">{t("auth.web_login.hint")}</p>
      <button type="button" onClick={onUseCode} className="w-full text-center text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
        {t("auth.web_login.use_code")}
      </button>
    </div>
  );
}
