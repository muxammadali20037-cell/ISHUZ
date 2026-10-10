"use client";

import { useEffect, useState, useTransition } from "react";
import { DOCUMENT_COOKIE_ATTRS } from "@/lib/security/cookies";
import { useRouter } from "next/navigation";
import { ArrowRight, Building2, Search } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import type { Locale } from "@/lib/i18n/config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveGreetingName, setLocale } from "@/features/auth/actions";

import { WELCOME_COOKIE } from "./welcome-cookie";
import { BrandMark } from "@/components/shared/brand-mark";

/**
 * Birinchi kirish — suhbat kabi: (til cookie'si yo'q bo'lsa) til → "Assalomu alaykum! Ismingiz nima?" →
 * "Ish qidiryapsizmi yoki xodim?" (ikki katta tugma) → tegishli oddiy savollarga o'tadi.
 * Faqat klientda, mount'dan keyin ko'rinadi — qidiruv tizimlari va SSR kontentiga ta'sir qilmaydi.
 */
export function WelcomeGate({ needLanguage }: { needLanguage: boolean }) {
  const { t } = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"lang" | "hello" | "role">(needLanguage ? "lang" : "hello");
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    // Admin panelda va bot/iframe'siz preview'larda ko'rsatmaymiz
    if (window.location.pathname.startsWith("/admin")) return;
    const id = window.setTimeout(() => setOpen(true), 0);
    return () => window.clearTimeout(id);
  }, []);

  const finish = () => {
    document.cookie = `${WELCOME_COOKIE}=1; max-age=${60 * 60 * 24 * 365}${DOCUMENT_COOKIE_ATTRS}`;
    setOpen(false);
  };

  const pickLanguage = (locale: Locale) =>
    startTransition(async () => {
      await setLocale(locale);
      router.refresh();
      setStep("hello");
    });

  const submitName = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) return;
    startTransition(async () => {
      await saveGreetingName(name);
      setStep("role");
    });
  };

  const choose = (href: string) => {
    finish();
    router.push(href);
  };

  if (!open) return null;

  // 1-ekran: to'liq ekranli til tanlash (boshqa navigatsiyasiz), keyin qisqa tanishtiruv
  if (step === "lang") {
    return (
      <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center overflow-y-auto bg-background px-5 py-10" role="dialog" aria-modal="true" aria-labelledby="welcome-lang-title">
        <div className="w-full max-w-sm animate-fade-in text-center">
          <BrandMark className="mx-auto size-20 rounded-3xl shadow-lg" />
          <h1 id="welcome-lang-title" className="mt-6 text-3xl font-extrabold tracking-tight">
            Tilni tanlang
          </h1>
          <p className="mt-1 text-muted-foreground">Тилни танланг · Выберите язык</p>
          <div className="mt-8 grid gap-3">
            {(
              [
                ["uz", "O'zbekcha", "lotin yozuvi"],
                ["oz", "Ўзбекча", "кирилл ёзуви"],
                ["ru", "Русский", "русский язык"],
              ] as const
            ).map(([code, label, hint]) => (
              <button
                key={code}
                type="button"
                lang={code === "oz" ? "uz-Cyrl" : code}
                disabled={pending}
                onClick={() => pickLanguage(code)}
                className="flex min-h-20 flex-col items-start justify-center rounded-3xl border-2 border-border bg-card px-6 py-3 text-left shadow-sm transition-all hover:border-primary hover:bg-primary-soft active:scale-[0.98] disabled:opacity-60"
              >
                <span className="text-xl font-bold">{label}</span>
                <span className="text-sm text-muted-foreground">{hint}</span>
              </button>
            ))}
          </div>
          <button type="button" lang="en" disabled={pending} onClick={() => pickLanguage("en")} className="mt-5 text-sm font-medium text-primary hover:underline">
            English
          </button>
        </div>
      </div>
    );
  }

  const first = name.trim().split(/\s+/)[0] ?? "";

  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center overflow-y-auto bg-background px-5 py-10" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
      {step === "hello" ? (
        <form key="hello" onSubmit={submitName} className="w-full max-w-sm animate-fade-in text-center">
          <div className="mx-auto flex size-20 origin-bottom-right animate-[wave_1.6s_ease-in-out_2] items-center justify-center text-6xl" aria-hidden>
            👋
          </div>
          <h1 id="welcome-title" className="mt-4 text-3xl font-extrabold tracking-tight">
            {t("welcome.hello.title")}
          </h1>
          <p className="mt-2 text-lg text-muted-foreground">{t("welcome.hello.ask")}</p>
          <Input
            autoFocus
            autoComplete="given-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("welcome.hello.placeholder")}
            maxLength={60}
            className="mt-6 h-14 text-center text-lg"
          />
          <Button type="submit" size="lg" fullWidth className="mt-4 h-14 text-base" disabled={name.trim().length < 2} loading={pending}>
            {t("welcome.next")} <ArrowRight className="size-5" />
          </Button>
          <button type="button" onClick={finish} className="mt-5 text-sm font-medium text-muted-foreground hover:text-foreground">
            {t("welcome.later")}
          </button>
        </form>
      ) : (
        <div key="role" className="w-full max-w-sm animate-fade-in text-center">
          <h1 id="welcome-title" className="text-3xl font-extrabold tracking-tight">
            {t("welcome.role.title", { name: first })}
          </h1>
          <p className="mt-2 text-lg text-muted-foreground">{t("welcome.role.ask")}</p>
          <div className="mt-8 grid gap-4">
            <button
              type="button"
              onClick={() => choose("/onboarding/worker")}
              className="flex items-center gap-4 rounded-3xl bg-primary p-5 text-left text-primary-foreground shadow-lg transition-transform active:scale-[0.98]"
            >
              <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-white/20">
                <Search className="size-7" />
              </span>
              <span>
                <span className="block text-xl font-bold">{t("welcome.role.worker")}</span>
                <span className="block text-sm text-primary-foreground/85">{t("welcome.role.worker_desc")}</span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => choose("/onboarding/employer")}
              className="flex items-center gap-4 rounded-3xl bg-success p-5 text-left text-success-foreground shadow-lg transition-transform active:scale-[0.98]"
            >
              <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-white/20">
                <Building2 className="size-7" />
              </span>
              <span>
                <span className="block text-xl font-bold">{t("welcome.role.employer")}</span>
                <span className="block text-sm text-success-foreground/85">{t("welcome.role.employer_desc")}</span>
              </span>
            </button>
          </div>
          <button type="button" onClick={finish} className="mt-6 text-sm font-medium text-muted-foreground hover:text-foreground">
            {t("welcome.later")}
          </button>
        </div>
      )}
    </div>
  );
}
