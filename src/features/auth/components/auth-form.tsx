"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Phone, Send } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { useTelegram } from "@/lib/telegram/provider";
import { TelegramWebLogin } from "./telegram-web-login";
import { formatPhoneAsYouType, formatPhone, normalizePhone } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Spinner } from "@/components/ui/misc";

type Step = "phone" | "link" | "code";

const KNOWN_ERRORS = new Set([
  "invalid_phone",
  "otp_send_failed",
  "invalid_code",
  "code_expired",
  "rate_limited",
  "telegram_not_configured",
  "telegram_not_linked",
  "telegram_blocked",
  "wait_before_resend",
  "auth_failed",
]);

async function postJson(url: string, body: unknown): Promise<{ ok: boolean; error?: string }> {
  try {
    const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const data = (await r.json().catch(() => ({}))) as { error?: string };
    return r.ok ? { ok: true } : { ok: false, error: data.error ?? "auth_failed" };
  } catch {
    return { ok: false, error: "auth_failed" };
  }
}

/**
 * Kirish: telefon raqam → kod Telegram bot orqali (SMS o'rniga) → tasdiqlash.
 * Telegram Mini App ichida initData bilan avtomatik kiriladi.
 */
export function AuthForm({ next, botUsername }: { next: string; botUsername: string | null }) {
  const { t, locale } = useT();
  const router = useRouter();
  const { isTelegram, webApp } = useTelegram();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("+998 ");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [countdown, setCountdown] = useState(0);
  const [tgFailed, setTgFailed] = useState(false);
  // Brauzerda asosiy usul — Telegram orqali kodsiz kirish; telefon+kod faqat zaxira
  const [codeMode, setCodeMode] = useState(!botUsername);
  const tgStarted = useRef(false);
  const codeRef = useRef<HTMLInputElement>(null);
  const tgLoading = isTelegram && !tgFailed;
  const botLink = botUsername ? `https://t.me/${botUsername}?start=login` : null;
  const errorText = (code: string | undefined) => t(`auth.errors.${code && KNOWN_ERRORS.has(code) ? code : "auth_failed"}`);

  // Telegram ichida: initData bilan avtomatik kirish (bir marta)
  useEffect(() => {
    if (!isTelegram || !webApp?.initData || tgStarted.current) return;
    tgStarted.current = true;
    fetch("/api/auth/telegram", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ initData: webApp.initData, locale }),
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(String(r.status));
        router.replace(next);
        router.refresh();
      })
      .catch(() => setTgFailed(true));
  }, [isTelegram, webApp, router, next, locale]);

  useEffect(() => {
    if (countdown <= 0) return;
    const id = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [countdown]);

  const sendCode = (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);
    const normalized = normalizePhone(phone);
    if (!normalized) {
      setError(t("auth.errors.invalid_phone"));
      return;
    }
    startTransition(async () => {
      const res = await postJson("/api/auth/phone-code/send", { phone: normalized, locale });
      if (!res.ok) {
        if (res.error === "telegram_not_linked") {
          setStep("link");
          return;
        }
        setError(errorText(res.error));
        return;
      }
      setCode("");
      setStep("code");
      setCountdown(60);
      setTimeout(() => codeRef.current?.focus(), 50);
    });
  };

  const submitCode = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await postJson("/api/auth/phone-code/verify", { phone: normalizePhone(phone), code: code.trim() });
      if (!res.ok) {
        setError(errorText(res.error));
        return;
      }
      router.replace(next);
      router.refresh();
    });
  };

  if (tgLoading) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <Spinner />
        <p className="text-sm text-muted-foreground">{t("auth.telegram_auto")}</p>
      </div>
    );
  }

  const prettyPhone = formatPhone(normalizePhone(phone));

  if (!isTelegram && !codeMode) {
    return (
      <div className="space-y-5">
        <TelegramWebLogin next={next} onUseCode={() => setCodeMode(true)} />
        <p className="text-center text-xs text-muted-foreground">{t("auth.agree", { terms: t("auth.terms"), privacy: t("auth.privacy") })}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {tgFailed ? <p className="rounded-xl bg-warning-soft p-3 text-sm text-warning">{t("auth.telegram_failed")}</p> : null}

      {step === "phone" ? (
        <form onSubmit={sendCode} className="space-y-4">
          <Field label={t("auth.phone_label")} htmlFor="phone" error={error ?? undefined}>
            <Input
              id="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              autoFocus
              leftIcon={<Phone />}
              placeholder={t("auth.phone_placeholder")}
              value={phone}
              invalid={!!error}
              onChange={(e) => {
                const raw = e.target.value;
                setPhone(raw.length < phone.length ? raw : formatPhoneAsYouType(raw.startsWith("+") ? raw : `+${raw}`));
              }}
            />
          </Field>
          <Button type="submit" size="lg" fullWidth loading={pending}>
            <Send className="size-4" /> {t("auth.send_code")}
          </Button>
        </form>
      ) : null}

      {step === "link" ? (
        <div className="space-y-4 rounded-2xl border border-border bg-card p-4">
          <div>
            <h2 className="font-semibold">{t("auth.link_title")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("auth.link_desc", { phone: prettyPhone })}</p>
          </div>
          <ol className="list-decimal space-y-1.5 pl-5 text-sm">
            <li>{t("auth.link_step1")}</li>
            <li>{t("auth.link_step2")}</li>
            <li>{t("auth.link_step3")}</li>
          </ol>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <div className="grid gap-2 sm:grid-cols-2">
            {botLink ? (
              <Button asChild size="lg" variant="outline">
                <a href={botLink} target="_blank" rel="noopener noreferrer">
                  <Send className="size-4 text-[#2AABEE]" /> {t("auth.open_bot")}
                </a>
              </Button>
            ) : null}
            <Button size="lg" onClick={() => sendCode()} loading={pending}>
              {t("auth.retry")}
            </Button>
          </div>
          <button type="button" className="text-sm text-muted-foreground hover:text-foreground" onClick={() => { setStep("phone"); setError(null); }}>
            {t("auth.change_phone")}
          </button>
        </div>
      ) : null}

      {step === "code" ? (
        <form onSubmit={submitCode} className="space-y-4">
          <p className="text-sm text-muted-foreground">{t("auth.code_sent_telegram", { phone: prettyPhone, bot: botUsername ?? "" })}</p>
          <Field label={t("auth.code_label")} htmlFor="code" error={error ?? undefined}>
            <Input
              ref={codeRef}
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d*"
              maxLength={6}
              placeholder={t("auth.code_placeholder")}
              value={code}
              invalid={!!error}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className="text-center text-2xl tracking-[0.4em]"
            />
          </Field>
          <Button type="submit" size="lg" fullWidth loading={pending} disabled={code.length !== 6}>
            {t("auth.verify")}
          </Button>
          {botLink ? (
            <Button asChild variant="ghost" size="sm" fullWidth>
              <a href={`https://t.me/${botUsername}`} target="_blank" rel="noopener noreferrer">
                <Send className="size-4 text-[#2AABEE]" /> {t("auth.open_bot")}
              </a>
            </Button>
          ) : null}
          <div className="flex items-center justify-between text-sm">
            <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => { setStep("phone"); setCode(""); setError(null); }}>
              {t("auth.change_phone")}
            </button>
            {countdown > 0 ? (
              <span className="tabular text-muted-foreground">{t("auth.resend_in", { seconds: countdown })}</span>
            ) : (
              <button type="button" className="font-medium text-primary" onClick={() => sendCode()} disabled={pending}>
                {t("auth.resend")}
              </button>
            )}
          </div>
        </form>
      ) : null}

      {!isTelegram && botUsername && step === "phone" ? (
        <>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            {t("auth.or")}
            <span className="h-px flex-1 bg-border" />
          </div>
          <Button variant="outline" size="lg" fullWidth onClick={() => setCodeMode(false)}>
            <Send className="size-5 text-[#2AABEE]" /> {t("auth.telegram_login")}
          </Button>
        </>
      ) : null}

      <p className="text-center text-xs text-muted-foreground">
        {t("auth.agree", { terms: t("auth.terms"), privacy: t("auth.privacy") })}
      </p>
    </div>
  );
}
