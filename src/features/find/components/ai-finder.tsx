"use client";

import { useRef, useState, type MouseEvent } from "react";
import { ArrowRight, Search, Sparkles } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { Dialog, Sheet } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { AiAvatar } from "@/components/shared/ai-avatar";
import { AiModeSwitch, AiPromptBox, AiThread, useAiChat } from "./ai-chat";

/**
 * "AI bilan qidirish" — AI yordamchi oynasi (suhbat ko'rinishi, ./ai-chat): foydalanuvchi oddiy so'z bilan yozadi yoki aytadi,
 * yordamchi tushunganini ko'rsatadi va bazadagi mos e'lonlarni shu oynada chiqaradi; bir bosishda aniqlashtiriladi.
 * Telefonda — deyarli to'liq ekranli pastki oyna (yozish maydoni pastda, barmoq yetadigan joyda), kompyuterda — kengroq oyna.
 * Tugma qidiruv blokida turadi (suzuvchi tugma yo'q). `locked` — rejim tanlangan: faqat shu rejim ichida qidiradi.
 *
 * Ko'rinishlar:
 *  - "inline" — qidiruv qatori yonidagi ixcham tugma (belgi + "AI bilan qidirish");
 *  - "card"   — kompyuterdagi bosh sahifa uchun taklif kartasi: yozish maydoniga o'xshash tugma va misollar
 *               (misol bosilsa — oyna ochiladi va shu so'rov darhol yuboriladi);
 *  - "cta"    — mehmon bosh sahifasidagi AI bo'limi uchun asosiy tugma ("AI yordamchini sinab ko'ring").
 */
export function AiFinder({
  defaultMode,
  locked = false,
  variant = "inline",
  className,
}: {
  defaultMode: "jobs" | "workers";
  locked?: boolean;
  variant?: "inline" | "card" | "cta";
  className?: string;
}) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const chat = useAiChat(defaultMode);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // natijadagi havola bosilsa — oyna yopiladi (sahifa ochiladi; suhbat saqlanadi)
  const closeOnLink = (e: MouseEvent) => {
    if (e.target instanceof Element && e.target.closest("a[href^='/']")) setOpen(false);
  };

  const examples = chat.mode === "workers" ? [t("easy.finder.example_w1"), t("easy.finder.example_w2"), t("easy.finder.example_w3")] : [t("easy.finder.example_j1"), t("easy.finder.example_j2"), t("easy.finder.example_j3")];

  const openWith = (example?: string) => {
    chat.reload();
    setOpen(true);
    if (example) chat.ask(example);
  };

  return (
    <>
      {variant === "card" ? (
        <section aria-labelledby="ai-card-title" className={cn("rounded-2xl border border-primary/25 bg-primary-soft p-4", className)}>
          <div className="flex items-center gap-3">
            <AiAvatar />
            <div className="min-w-0">
              <h2 id="ai-card-title" className="text-base font-bold leading-tight">
                {t("easy.finder.card_title")}
              </h2>
              <p className="mt-0.5 text-sm leading-snug text-muted-foreground">{defaultMode === "workers" ? t("easy.finder.card_desc_workers") : t("easy.finder.card_desc_jobs")}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => openWith()}
            data-track="ai_finder_open"
            className="press mt-3 flex min-h-12 w-full items-center gap-2 rounded-xl border border-input bg-card px-3 text-left text-base text-muted-foreground hover:border-primary/50"
          >
            <Search className="size-5 shrink-0" aria-hidden />
            <span className="min-w-0 flex-1 truncate">{defaultMode === "workers" ? t("easy.finder.placeholder_workers") : t("easy.finder.placeholder_jobs")}</span>
            <span className="sr-only">{t("easy.finder.card_open")}</span>
            <ArrowRight className="size-5 shrink-0 text-primary" aria-hidden />
          </button>
          <ul className="mt-3 flex flex-wrap gap-2">
            {examples.map((ex) => (
              <li key={ex} className="flex">
                <button
                  type="button"
                  onClick={() => openWith(ex)}
                  className="press inline-flex min-h-11 items-center rounded-full border border-primary/30 bg-card px-3 text-sm font-semibold text-primary hover:border-primary/60"
                >
                  {ex}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : variant === "cta" ? (
        <button
          type="button"
          onClick={() => openWith()}
          data-track="ai_finder_open"
          className={cn("press lift-sm inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-base font-bold text-primary-foreground shadow-sm hover:bg-primary-hover", className)}
        >
          <Sparkles className="size-5" aria-hidden />
          {t("easy.finder.cta_button")}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => openWith()}
          data-track="ai_finder_open"
          className={cn("press inline-flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-full py-1 pl-1 pr-3.5 text-sm font-bold text-primary hover:bg-primary-soft", className)}
        >
          <AiAvatar size="sm" className="rounded-full" />
          {t("easy.finder.inline_button")}
        </button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <Sheet
          title={t("easy.finder.assistant_title")}
          description={chat.mode === "workers" ? t("easy.finder.assistant_desc_workers") : t("easy.finder.assistant_desc_jobs")}
          icon={<AiAvatar busy={chat.pending} />}
          className="h-[92dvh] sm:h-[min(46rem,88dvh)] sm:max-w-2xl"
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            // telefonda klaviatura darhol chiqib, natijani yopmasin: misol bilan ochilganda fokus berilmaydi
            if (!chat.pending) inputRef.current?.focus();
          }}
          footer={<AiPromptBox chat={chat} inputRef={inputRef} />}
        >
          <div className="space-y-4 pt-1" onClick={closeOnLink}>
            <AiModeSwitch chat={chat} locked={locked} />
            <AiThread chat={chat} examples={examples} />
          </div>
        </Sheet>
      </Dialog>
    </>
  );
}
