"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, MessageSquareText, Phone, Send, Smartphone } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { formatPhone, phoneInputChange, normalizePhone } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { safeInternalPath } from "@/lib/security/safe-path";
import { BrandMark } from "@/components/shared/brand-mark";
import { BrandWordmark } from "@/components/shared/brand-wordmark";
import { EntryBack, EntryHeading, EntryIcon, EntryScreen } from "@/features/entry/components/entry-screen";
import { cn } from "@/lib/utils";
import { TelegramGate } from "./telegram-login";

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
  // serverning aniq javoblari (avval umumiy "Kirib bo'lmadi" ko'rinardi)
  "temporarily_restricted",
  "temporarily_unavailable",
  "blocked",
  "cross_site",
  // brauzer tomoni: so'rov serverga yetmadi
  "offline",
  "network",
]);

const CODE_LENGTH = 6;
/** Serverdagi LOGIN_CODE_RESEND_SECONDS bilan bir xil (server baribir o'zi tekshiradi) */
const RESEND_SECONDS = 60;

async function postJson(url: string, body: unknown): Promise<{ ok: boolean; error?: string }> {
  try {
    const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const data = (await r.json().catch(() => ({}))) as { error?: string };
    return r.ok ? { ok: true } : { ok: false, error: data.error ?? "auth_failed" };
  } catch {
    return { ok: false, error: typeof navigator !== "undefined" && navigator.onLine === false ? "offline" : "network" };
  }
}

/** Telegram belgisi (rasmiy rang) */
function TelegramIcon({ className }: { className?: string }) {
  return <Send className={cn("text-[#2AABEE]", className)} aria-hidden />;
}

/**
 * 6-ekran: kirish usuli. Faqat haqiqatan ishlaydigan usullar: telefon (kod Telegram bot orqali) va Telegram (bot ochiladi,
 * undagi ilova tugmasi — avtomatik kirish). Google kirish sozlanmagan — ko'rsatilmaydi. Telegram Mini App ichida — darhol kiriladi.
 */
export function LoginMethods({ next, phoneHref, botUsername, backHref }: { next: string; phoneHref: string; botUsername: string | null; backHref: string }) {
  const { t } = useT();
  return (
    <TelegramGate next={next}>
      {(failed) => (
        <EntryScreen left={<EntryBack href={backHref} label={t("common.actions.back")} />}>
          <div className="flex flex-1 flex-col">
            <div className="flex flex-col items-center pt-6 text-center">
              <BrandMark className="size-16 rounded-2xl" />
              <span className="mt-3 text-2xl font-extrabold tracking-tight">
                <BrandWordmark />
              </span>
            </div>
            <EntryHeading className="mt-8" title={t("auth.method.title")} subtitle={t("auth.method.subtitle")} />
            {failed ? <p className="mt-6 rounded-xl bg-warning-soft p-3 text-sm text-warning">{t("auth.telegram_failed")}</p> : null}
            <nav aria-label={t("auth.method.label")} className="mt-8 grid gap-3">
              <Link
                href={phoneHref}
                data-track="auth_method"
                data-track-to="phone"
                className="press flex min-h-16 items-center gap-3 rounded-2xl bg-primary px-4 py-3 text-primary-foreground hover:bg-primary-hover"
              >
                <Phone className="size-6 shrink-0" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-bold leading-tight">{t("auth.method.phone")}</span>
                  <span className="mt-0.5 block text-sm leading-snug opacity-90">{t("auth.method.phone_desc")}</span>
                </span>
              </Link>
              {botUsername ? (
                <a
                  href={`https://t.me/${botUsername}?start=login`}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-track="auth_method"
                  data-track-to="telegram"
                  className="press flex min-h-16 items-center gap-3 rounded-2xl border-2 border-border bg-card px-4 py-3 hover:border-primary/50"
                >
                  <TelegramIcon className="size-6 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-base font-bold leading-tight">{t("auth.method.telegram")}</span>
                    <span className="mt-0.5 block text-sm leading-snug text-muted-foreground">{t("auth.method.telegram_desc")}</span>
                  </span>
                </a>
              ) : null}
            </nav>
            <Link href="/" className="mx-auto mt-5 inline-flex min-h-11 items-center px-2 text-base font-semibold text-primary hover:underline">
              {t("auth.method.browse")}
            </Link>
            <div className="flex-1" />
            <p className="pb-[max(1rem,var(--safe-bottom))] pt-6 text-center text-xs text-muted-foreground">
              <AgreeText text={t("auth.agree", { terms: "\u0001", privacy: "\u0002" })} terms={t("auth.terms")} privacy={t("auth.privacy")} />
            </p>
          </div>
        </EntryScreen>
      )}
    </TelegramGate>
  );
}

/**
 * 8–9-ekranlar: telefon raqam → kod (Telegram bot orqali, SMS emas) → tasdiqlash. Kod faqat serverda tekshiriladi
 * (muddat, urinishlar soni, tezlik cheklovi — /api/auth/phone-code/*). Telegram Mini App ichida — avtomatik kirish.
 */
export function PhoneLogin({ next, botUsername, initialPhone, backHref }: { next: string; botUsername: string | null; initialPhone?: string | null; backHref: string }) {
  return (
    <TelegramGate next={next}>
      {(failed) => <PhoneLoginInner next={next} botUsername={botUsername} initialPhone={initialPhone} backHref={backHref} tgFailed={failed} />}
    </TelegramGate>
  );
}

function PhoneLoginInner({ next, botUsername, initialPhone, backHref, tgFailed }: { next: string; botUsername: string | null; initialPhone?: string | null; backHref: string; tgFailed: boolean }) {
  const { t, locale } = useT();
  const router = useRouter();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState(initialPhone ? formatPhone(initialPhone) : "+998 ");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [countdown, setCountdown] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);
  /** bitta kod bir marta avtomatik yuboriladi (xato bo'lsa — qayta yozilganda yana) */
  const autoSent = useRef<string | null>(null);
  const botLink = botUsername ? `https://t.me/${botUsername}?start=login` : null;
  const errorText = (c: string | undefined) => t(`auth.errors.${c && KNOWN_ERRORS.has(c) ? c : "auth_failed"}`);
  const prettyPhone = formatPhone(normalizePhone(phone));

  // raqam maydoni: fokusda kursor oxirida ("+998 " prefiksi oldiga yoki o'rtasiga raqam tushib qolmasin)
  const phoneRef = useRef<HTMLInputElement>(null);
  const caretToEnd = (el: HTMLInputElement | null) => {
    if (!el) return;
    const end = el.value.length;
    // darhol (dasturiy fokus, birinchi bosilgan raqam) va keyingi kadrda (telefonda bosilgan joyga qo'yilgan kursorni ham)
    el.setSelectionRange(end, end);
    requestAnimationFrame(() => el.setSelectionRange(el.value.length, el.value.length));
  };
  useEffect(() => {
    if (step !== "phone") return;
    phoneRef.current?.focus();
    caretToEnd(phoneRef.current);
  }, [step]);

  useEffect(() => {
    if (countdown <= 0) return;
    const id = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [countdown]);

  const sendCode = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (pending) return;
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
      autoSent.current = null;
      setStep("code");
      setCountdown(RESEND_SECONDS);
      setTimeout(() => codeRef.current?.focus(), 50);
    });
  };

  const verify = (value: string) => {
    if (pending || value.length !== CODE_LENGTH) return;
    setError(null);
    startTransition(async () => {
      const res = await postJson("/api/auth/phone-code/verify", { phone: normalizePhone(phone), code: value });
      if (!res.ok) {
        setError(errorText(res.error));
        return;
      }
      router.replace(safeInternalPath(next));
      router.refresh();
    });
  };

  const onCodeChange = (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, CODE_LENGTH);
    setCode(digits);
    if (error) setError(null);
    // to'liq kiritilganda (yoki avtoto'ldirish/joylash) — avtomatik tekshiriladi, bir kod uchun bir marta
    if (digits.length === CODE_LENGTH && autoSent.current !== digits) {
      autoSent.current = digits;
      verify(digits);
    }
  };

  const back =
    step === "phone" ? (
      <EntryBack href={backHref} label={t("common.actions.back")} />
    ) : (
      <button
        type="button"
        onClick={() => {
          setStep("phone");
          setCode("");
          setError(null);
        }}
        aria-label={t("auth.change_phone")}
        className="inline-flex size-11 items-center justify-center rounded-xl hover:bg-secondary"
      >
        <ChevronLeft className="size-6" aria-hidden />
      </button>
    );

  if (step === "code") {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          verify(code);
        }}
        noValidate
      >
        <EntryScreen
          left={back}
          footer={
            <Button type="submit" size="lg" fullWidth loading={pending} disabled={code.length !== CODE_LENGTH} className="h-14 text-base font-bold">
              {t("auth.code.continue")}
            </Button>
          }
        >
          <div className="pt-4">
            <EntryIcon>
              <MessageSquareText />
            </EntryIcon>
            <EntryHeading className="mt-5" title={t("auth.code.title")} subtitle={botUsername ? t("auth.code_sent_telegram", { phone: prettyPhone, bot: botUsername }) : t("auth.code.sent", { phone: prettyPhone })} />
          </div>
          <div className="mt-8">
            <OtpBoxes ref={codeRef} value={code} onChange={onCodeChange} invalid={!!error} label={t("auth.code.boxes_label")} disabled={pending} />
            {error ? (
              <p className="mt-3 text-center text-sm font-medium text-destructive" role="alert">
                {error}
              </p>
            ) : null}
            <p className="mt-4 text-center text-sm text-muted-foreground">{t("auth.code.expires")}</p>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 text-sm">
              {countdown > 0 ? (
                <span className="inline-flex min-h-11 items-center tabular text-muted-foreground" aria-live="polite">
                  {t("auth.resend_in", { seconds: countdown })}
                </span>
              ) : (
                <button type="button" className="inline-flex min-h-11 items-center px-1 font-semibold text-primary" onClick={() => sendCode()} disabled={pending}>
                  {t("auth.resend")}
                </button>
              )}
              {botLink ? (
                <a href={`https://t.me/${botUsername}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1.5 px-1 font-semibold text-foreground">
                  <TelegramIcon className="size-4" /> {t("auth.open_bot")}
                </a>
              ) : null}
            </div>
          </div>
        </EntryScreen>
      </form>
    );
  }

  if (step === "link") {
    return (
      <EntryScreen left={back}>
        <div className="pt-4">
          <EntryIcon>
            <Send />
          </EntryIcon>
          <EntryHeading className="mt-5" title={t("auth.link_title")} subtitle={t("auth.link_desc", { phone: prettyPhone })} />
        </div>
        <ol className="mt-6 list-decimal space-y-2 rounded-2xl border border-border bg-card p-4 pl-9 text-base">
          <li>{t("auth.link_step1")}</li>
          <li>{t("auth.link_step2")}</li>
          <li>{t("auth.link_step3")}</li>
        </ol>
        {error ? (
          <p className="mt-3 text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <div className="mt-6 grid gap-2">
          {botLink ? (
            <Button asChild size="lg" variant="outline" className="h-14 text-base font-bold">
              <a href={botLink} target="_blank" rel="noopener noreferrer">
                <TelegramIcon className="size-5" /> {t("auth.open_bot")}
              </a>
            </Button>
          ) : null}
          <Button size="lg" onClick={() => sendCode()} loading={pending} className="h-14 text-base font-bold">
            {t("auth.retry")}
          </Button>
        </div>
      </EntryScreen>
    );
  }

  return (
    <form onSubmit={sendCode} noValidate>
      <EntryScreen
        left={back}
        footer={
          <>
            <Button type="submit" size="lg" fullWidth loading={pending} className="h-14 text-base font-bold">
              {t("auth.send_code")}
            </Button>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              <AgreeText text={t("auth.agree", { terms: "\u0001", privacy: "\u0002" })} terms={t("auth.terms")} privacy={t("auth.privacy")} />
            </p>
          </>
        }
      >
        <div className="pt-4">
          <EntryIcon>
            <Smartphone />
          </EntryIcon>
          <EntryHeading className="mt-5" title={t("auth.phone.title")} subtitle={t("auth.phone.subtitle")} />
        </div>
        {tgFailed ? <p className="mt-6 rounded-xl bg-warning-soft p-3 text-sm text-warning">{t("auth.telegram_failed")}</p> : null}
        <div className="mt-8">
          <label htmlFor="phone" className="mb-1.5 block text-sm font-semibold">
            {t("auth.phone_label")}
          </label>
          <Input
            ref={phoneRef}
            id="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            onFocus={(e) => caretToEnd(e.currentTarget)}
            leftIcon={<Phone />}
            placeholder={t("auth.phone_placeholder")}
            value={phone}
            invalid={!!error}
            aria-describedby={error ? "phone-error" : undefined}
            onChange={(e) => {
              setPhone(phoneInputChange(e.target.value, phone));
              if (error) setError(null);
            }}
            className="h-14 text-lg font-semibold tabular"
          />
          {error ? (
            <p id="phone-error" className="mt-2 text-sm font-medium text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </EntryScreen>
    </form>
  );
}

/**
 * Kod kataklari: ko'rinishda 6 ta katak, aslida bitta input (avtoto'ldirish "one-time-code", joylash, ekran o'qigichi uchun
 * bitta maydon). Katakni bosish — inputga fokus.
 */
function OtpBoxes({
  ref,
  value,
  onChange,
  invalid,
  label,
  disabled,
}: {
  ref: React.Ref<HTMLInputElement>;
  value: string;
  onChange: (v: string) => void;
  invalid: boolean;
  label: string;
  disabled: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const active = Math.min(value.length, CODE_LENGTH - 1);
  return (
    <div className="relative mx-auto w-full max-w-xs">
      <input
        ref={ref}
        id="code"
        aria-label={label}
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="\d*"
        // maxLength yo'q: "Kod: 123456" kabi joylangan matndan ham raqamlar olinadi (onChange — faqat 6 ta raqam)
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        aria-invalid={invalid || undefined}
        className="absolute inset-0 z-10 size-full cursor-text text-transparent caret-transparent opacity-0"
      />
      <div className="grid grid-cols-6 gap-2" aria-hidden>
        {Array.from({ length: CODE_LENGTH }, (_, i) => (
          <span
            key={i}
            className={cn(
              "flex aspect-[4/5] items-center justify-center rounded-xl border-2 bg-card text-2xl font-extrabold tabular transition-colors",
              invalid ? "border-destructive" : focused && i === active ? "border-primary" : value[i] ? "border-primary/40" : "border-border",
            )}
          >
            {value[i] ?? ""}
          </span>
        ))}
      </div>
    </div>
  );
}

/** "Davom etish orqali siz {terms} va {privacy}ga rozilik bildirasiz" — ikkala hujjat bosiladigan havola */
export function AgreeText({ text, terms, privacy }: { text: string; terms: string; privacy: string }) {
  return (
    <>
      {text.split(/(\u0001|\u0002)/).map((part, i) =>
        part === "\u0001" ? (
          <Link key={i} href="/terms" target="_blank" className="font-medium text-primary underline-offset-2 hover:underline">
            {terms}
          </Link>
        ) : part === "\u0002" ? (
          <Link key={i} href="/privacy" target="_blank" className="font-medium text-primary underline-offset-2 hover:underline">
            {privacy}
          </Link>
        ) : (
          part
        ),
      )}
    </>
  );
}
