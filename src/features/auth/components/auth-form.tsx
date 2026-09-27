"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Phone, Send } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { useTelegram } from "@/lib/telegram/provider";
import { formatPhoneAsYouType, formatPhone, normalizePhone } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Spinner } from "@/components/ui/misc";
import { sendPhoneOtp, verifyPhoneOtp } from "@/features/auth/actions";

type Step = "phone" | "code";

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
  const tgStarted = useRef(false);
  const codeRef = useRef<HTMLInputElement>(null);
  const tgLoading = isTelegram && !tgFailed;

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

  const submitPhone = (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);
    if (!normalizePhone(phone)) {
      setError(t("auth.errors.invalid_phone"));
      return;
    }
    startTransition(async () => {
      const res = await sendPhoneOtp({ phone, locale });
      if (!res.ok) {
        setError(t(`auth.errors.${res.error}`));
        return;
      }
      setStep("code");
      setCountdown(60);
      setTimeout(() => codeRef.current?.focus(), 50);
    });
  };

  const submitCode = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await verifyPhoneOtp({ phone, token: code.trim() });
      if (!res.ok) {
        setError(t(`auth.errors.${res.error}`));
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

  return (
    <div className="space-y-5">
      {tgFailed ? <p className="rounded-xl bg-warning-soft p-3 text-sm text-warning">{t("auth.telegram_failed")}</p> : null}

      {step === "phone" ? (
        <form onSubmit={submitPhone} className="space-y-4">
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
            {t("auth.send_code")}
          </Button>
        </form>
      ) : (
        <form onSubmit={submitCode} className="space-y-4">
          <p className="text-sm text-muted-foreground">{t("auth.code_sent", { phone: formatPhone(normalizePhone(phone)) })}</p>
          <Field label={t("auth.code_label")} htmlFor="code" error={error ?? undefined}>
            <Input
              ref={codeRef}
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d*"
              maxLength={8}
              placeholder={t("auth.code_placeholder")}
              value={code}
              invalid={!!error}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className="text-center text-2xl tracking-[0.4em]"
            />
          </Field>
          <Button type="submit" size="lg" fullWidth loading={pending} disabled={code.length < 4}>
            {t("auth.verify")}
          </Button>
          <div className="flex items-center justify-between text-sm">
            <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => { setStep("phone"); setCode(""); setError(null); }}>
              {t("auth.change_phone")}
            </button>
            {countdown > 0 ? (
              <span className="tabular text-muted-foreground">{t("auth.resend_in", { seconds: countdown })}</span>
            ) : (
              <button type="button" className="font-medium text-primary" onClick={() => submitPhone()} disabled={pending}>
                {t("auth.resend")}
              </button>
            )}
          </div>
        </form>
      )}

      {!isTelegram && botUsername ? (
        <>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            {t("auth.or")}
            <span className="h-px flex-1 bg-border" />
          </div>
          <Button asChild variant="outline" size="lg" fullWidth>
            <a href={`https://t.me/${botUsername}?startapp=login`}>
              <Send className="size-5 text-[#2AABEE]" /> {t("auth.telegram_login")}
            </a>
          </Button>
        </>
      ) : null}

      <p className="text-center text-xs text-muted-foreground">
        {t("auth.agree", { terms: t("auth.terms"), privacy: t("auth.privacy") })}
      </p>
    </div>
  );
}
