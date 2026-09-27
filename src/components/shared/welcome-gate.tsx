"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Megaphone, MessageCircle, Search, Users } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import type { Locale } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { setLocale } from "@/features/auth/actions";

import { WELCOME_COOKIE } from "./welcome-cookie";

const SLIDES = [
  { key: "jobs", icon: Search, tone: "bg-primary text-primary-foreground" },
  { key: "workers", icon: Users, tone: "bg-success text-success-foreground" },
  { key: "post", icon: Megaphone, tone: "bg-warning text-warning-foreground" },
  { key: "chat", icon: MessageCircle, tone: "bg-[#229ED9] text-white" },
] as const;

/**
 * Birinchi kirish: (til cookie'si yo'q bo'lsa) til tanlash → asosiy tugmalar nima qilishi (4 slayd).
 * Faqat klientda, mount'dan keyin ko'rinadi — qidiruv tizimlari va SSR kontentiga ta'sir qilmaydi.
 */
export function WelcomeGate({ needLanguage }: { needLanguage: boolean }) {
  const { t } = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"lang" | number>(needLanguage ? "lang" : 0);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    // Admin panelda va bot/iframe'siz preview'larda ko'rsatmaymiz
    if (window.location.pathname.startsWith("/admin")) return;
    const id = window.setTimeout(() => setOpen(true), 0);
    return () => window.clearTimeout(id);
  }, []);

  const finish = () => {
    document.cookie = `${WELCOME_COOKIE}=1; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    setOpen(false);
  };

  const pickLanguage = (locale: Locale) =>
    startTransition(async () => {
      await setLocale(locale);
      router.refresh();
      setStep(0);
    });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true">
      <div className="w-full max-w-md animate-fade-in rounded-t-3xl bg-card p-6 pb-safe shadow-xl sm:rounded-3xl">
        {step === "lang" ? (
          <div className="py-2 text-center">
            <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-primary text-3xl font-extrabold text-primary-foreground">W</div>
            <h2 className="mt-4 text-2xl font-bold">Tilni tanlang</h2>
            <p className="text-muted-foreground">Выберите язык</p>
            <div className="mt-6 grid gap-3">
              {(
                [
                  ["uz", "🇺🇿", "O'zbekcha"],
                  ["ru", "🇷🇺", "Русский"],
                ] as const
              ).map(([code, flag, label]) => (
                <button
                  key={code}
                  type="button"
                  disabled={pending}
                  onClick={() => pickLanguage(code)}
                  className="flex h-16 items-center gap-4 rounded-2xl border-2 border-border bg-card px-5 text-lg font-semibold transition-colors hover:border-primary hover:bg-primary-soft disabled:opacity-60"
                >
                  <span className="text-3xl">{flag}</span>
                  {label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <Slide index={step} onNext={() => (step < SLIDES.length - 1 ? setStep(step + 1) : finish())} onSkip={finish} t={t} />
        )}
      </div>
    </div>
  );
}

function Slide({ index, onNext, onSkip, t }: { index: number; onNext: () => void; onSkip: () => void; t: (k: string) => string }) {
  const s = SLIDES[index]!;
  const last = index === SLIDES.length - 1;
  return (
    <div key={s.key} className="animate-fade-in text-center">
      <div className="flex justify-end">
        <button type="button" onClick={onSkip} className="text-sm font-medium text-muted-foreground hover:text-foreground">
          {t("welcome.skip")}
        </button>
      </div>
      <span className={cn("mx-auto mt-2 flex size-20 items-center justify-center rounded-3xl shadow-md", s.tone)}>
        <s.icon className="size-10" />
      </span>
      <h2 className="mt-5 text-2xl font-bold">{t(`welcome.slides.${s.key}.title`)}</h2>
      <p className="mx-auto mt-2 max-w-xs text-[15px] leading-relaxed text-muted-foreground">{t(`welcome.slides.${s.key}.text`)}</p>
      <div className="mt-6 flex justify-center gap-1.5" aria-hidden>
        {SLIDES.map((x, i) => (
          <span key={x.key} className={cn("h-2 rounded-full transition-all", i === index ? "w-6 bg-primary" : "w-2 bg-border")} />
        ))}
      </div>
      <Button size="lg" fullWidth className="mt-6" onClick={onNext}>
        {t(last ? "welcome.start" : "welcome.next")}
      </Button>
    </div>
  );
}
