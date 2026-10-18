"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Eye, EyeOff, KeyRound, Lock, Mail, MailCheck, ShieldAlert } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EntryBack, EntryHeading, EntryIcon, EntryScreen } from "@/features/entry/components/entry-screen";
import { ADMIN_ACCOUNT_PATH, normalizeEmail, parseLinkHash } from "../admin-login";
import { postJson } from "./auth-form";

const KNOWN_ERRORS = new Set([
  "invalid_credentials",
  "invalid_email",
  "password_login_disabled",
  "rate_limited",
  "temporarily_restricted",
  "temporarily_unavailable",
  "cross_site",
  "offline",
  "network",
  "auth_failed",
]);

function useErrorText() {
  const { t } = useT();
  return (c: string | undefined) => t(`auth.errors.${c && KNOWN_ERRORS.has(c) ? c : "auth_failed"}`);
}

/**
 * Admin zaxira kirishi: email + parol. Muvaffaqiyatdan keyin — panel; u autentifikator kodini so'raydi (/admin/mfa),
 * parolning o'zi panelni ochmaydi. Telegram/telefon kirishi o'zgarmaydi.
 */
export function AdminPasswordLogin({ next, recoverHref, methodsHref }: { next: string; recoverHref: string; methodsHref: string }) {
  const { t } = useT();
  const errorText = useErrorText();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return;
    if (!normalizeEmail(email)) return setError(errorText("invalid_email"));
    if (!password) return setError(errorText("invalid_credentials"));
    setError(null);
    start(async () => {
      const res = await postJson("/api/auth/admin/password", { email, password });
      if (!res.ok) {
        setError(errorText(res.error));
        return;
      }
      // to'liq o'tish: server yangi sessiya cookie'sini ko'radi va kerak bo'lsa kod sahifasiga yuboradi
      window.location.assign(next);
    });
  };

  return (
    <form onSubmit={submit} noValidate>
      <EntryScreen
        left={<EntryBack href={methodsHref} label={t("common.actions.back")} />}
        footer={
          <Button type="submit" size="lg" fullWidth loading={pending} className="h-14 text-base font-bold">
            {t("auth.admin.submit")}
          </Button>
        }
      >
        <div className="pt-4">
          <EntryIcon>
            <KeyRound />
          </EntryIcon>
          <EntryHeading className="mt-5" title={t("auth.admin.title")} subtitle={t("auth.admin.subtitle")} />
        </div>
        <div className="mt-8 space-y-4">
          <div>
            <label htmlFor="admin-email" className="mb-1.5 block text-sm font-semibold">
              {t("auth.admin.email_label")}
            </label>
            <Input
              id="admin-email"
              type="email"
              inputMode="email"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              leftIcon={<Mail />}
              placeholder={t("auth.admin.email_placeholder")}
              value={email}
              invalid={!!error}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError(null);
              }}
              className="h-14 text-base"
            />
          </div>
          <div>
            <label htmlFor="admin-password" className="mb-1.5 block text-sm font-semibold">
              {t("auth.admin.password_label")}
            </label>
            <Input
              id="admin-password"
              type={show ? "text" : "password"}
              autoComplete="current-password"
              leftIcon={<Lock />}
              value={password}
              invalid={!!error}
              aria-describedby={error ? "admin-login-error" : undefined}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError(null);
              }}
              rightSlot={
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  aria-label={show ? t("auth.admin.hide_password") : t("auth.admin.show_password")}
                  aria-pressed={show}
                  className="-mr-2 inline-flex size-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary"
                >
                  {show ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
                </button>
              }
              className="h-14 text-base"
            />
          </div>
          {error ? (
            <p id="admin-login-error" className="text-sm font-medium text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <Link href={recoverHref} className="inline-flex min-h-11 items-center text-base font-semibold text-primary hover:underline">
            {t("auth.admin.forgot")}
          </Link>
        </div>
        <p className="mt-4 rounded-xl bg-secondary p-3 text-sm text-muted-foreground">{t("auth.admin.totp_note")}</p>
      </EntryScreen>
    </form>
  );
}

/** Parol o'rnatish / tiklash: emailga bir martalik kirish havolasi. Javob doim bir xil (email kimniki ekani bildirilmaydi). */
export function AdminRecover({ loginHref }: { loginHref: string }) {
  const { t } = useT();
  const errorText = useErrorText();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return;
    if (!normalizeEmail(email)) return setError(errorText("invalid_email"));
    setError(null);
    start(async () => {
      const res = await postJson("/api/auth/admin/recover", { email });
      if (!res.ok) {
        setError(errorText(res.error));
        return;
      }
      setSent(true);
    });
  };

  if (sent) {
    return (
      <EntryScreen
        left={<EntryBack href={loginHref} label={t("common.actions.back")} />}
        footer={
          <Button asChild size="lg" fullWidth variant="outline" className="h-14 text-base font-bold">
            <Link href={loginHref}>{t("auth.admin.back_to_login")}</Link>
          </Button>
        }
      >
        <div className="pt-4" role="status">
          <EntryIcon>
            <MailCheck />
          </EntryIcon>
          <EntryHeading className="mt-5" title={t("auth.admin.recover_sent_title")} subtitle={t("auth.admin.recover_sent")} />
        </div>
        <p className="mt-6 rounded-xl bg-secondary p-3 text-sm text-muted-foreground">{t("auth.admin.recover_spam")}</p>
      </EntryScreen>
    );
  }

  return (
    <form onSubmit={submit} noValidate>
      <EntryScreen
        left={<EntryBack href={loginHref} label={t("common.actions.back")} />}
        footer={
          <Button type="submit" size="lg" fullWidth loading={pending} className="h-14 text-base font-bold">
            {t("auth.admin.recover_submit")}
          </Button>
        }
      >
        <div className="pt-4">
          <EntryIcon>
            <Mail />
          </EntryIcon>
          <EntryHeading className="mt-5" title={t("auth.admin.recover_title")} subtitle={t("auth.admin.recover_subtitle")} />
        </div>
        <div className="mt-8">
          <label htmlFor="recover-email" className="mb-1.5 block text-sm font-semibold">
            {t("auth.admin.email_label")}
          </label>
          <Input
            id="recover-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            leftIcon={<Mail />}
            placeholder={t("auth.admin.email_placeholder")}
            value={email}
            invalid={!!error}
            aria-describedby={error ? "recover-error" : undefined}
            onChange={(e) => {
              setEmail(e.target.value);
              if (error) setError(null);
            }}
            className="h-14 text-base"
          />
          {error ? (
            <p id="recover-error" className="mt-2 text-sm font-medium text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </EntryScreen>
    </form>
  );
}

/**
 * Emaildagi havola shu sahifaga qaytadi: "#access_token=…" dan sessiya ochiladi (tokenlar manzil satridan darhol
 * o'chiriladi), so'ng autentifikator kodi va panelda parol o'rnatish. Havola eskirgan bo'lsa — yangisini so'rash.
 */
export function AdminLinkLanding({ recoverHref }: { recoverHref: string }) {
  const { t } = useT();
  const [invalid, setInvalid] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const parsed = parseLinkHash(window.location.hash);
    // tokenlar tarix va skrinshotlarda qolmasin
    if (window.location.hash) window.history.replaceState(window.history.state, "", window.location.pathname);
    void (async () => {
      if (parsed?.kind !== "session") return setInvalid(true);
      const { error } = await createClient().auth.setSession({ access_token: parsed.accessToken, refresh_token: parsed.refreshToken });
      if (error) return setInvalid(true);
      window.location.replace(`/admin/mfa?next=${encodeURIComponent(`${ADMIN_ACCOUNT_PATH}?setup=1`)}`);
    })();
  }, []);

  return (
    <EntryScreen
      footer={
        invalid ? (
          <Button asChild size="lg" fullWidth className="h-14 text-base font-bold">
            <Link href={recoverHref}>{t("auth.admin.link_retry")}</Link>
          </Button>
        ) : null
      }
    >
      <div className="pt-10" role="status" aria-live="polite">
        <EntryIcon>{invalid ? <ShieldAlert /> : <KeyRound />}</EntryIcon>
        <EntryHeading className="mt-5" title={t("auth.admin.link_title")} subtitle={invalid ? t("auth.admin.link_invalid") : t("auth.admin.link_checking")} />
      </div>
    </EntryScreen>
  );
}
