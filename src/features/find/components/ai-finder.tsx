"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type MouseEvent } from "react";
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
 *  - "cta"    — mehmon bosh sahifasidagi AI bo'limi uchun asosiy tugma ("AI yordamchini sinab ko'ring");
 *  - "bar"    — bosh ekrandagi "jonli" AI qatori: aylanib turadigan rangli chegara, yaltiroq belgi va o'zi yozilib-o'chib
 *               turadigan misollar (prefers-reduced-motion — harakatsiz, birinchi misol);
 *  - "field"  — 2.0 bosh sahifasining YAGONA qidiruv maydoni: foydalanuvchi o'z so'zi bilan yozadi (har qanday til, xato bilan),
 *               "Topish" — oyna ochiladi va matn darhol AI'ga yuboriladi; natija bosqichlarsiz shu yerda.
 */
export function AiFinder({
  defaultMode,
  locked = false,
  variant = "inline",
  className,
  fieldLabel,
  placeholder,
  submitLabel,
}: {
  defaultMode: "jobs" | "workers";
  locked?: boolean;
  variant?: "inline" | "card" | "cta" | "bar" | "field";
  className?: string;
  /** "field" uchun: maydon nomi (ekran o'qigich), misol matni va tugma yozuvi */
  fieldLabel?: string;
  placeholder?: string;
  submitLabel?: string;
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
  // skriptlar yuklanib bo'lganini bildiradi (sekin telefon: undan oldin bosilsa — forma /ai?q=… ga oddiy yo'l bilan ketadi)
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);

  return (
    <>
      {variant === "field" ? (
        <form
          // skriptlar hali yuklanmagan bo'lsa ham boshi berk yo'q: matn AI sahifasiga boradi va o'sha yerda javob beriladi
          action="/ai"
          method="get"
          role="search"
          aria-label={fieldLabel}
          data-ai-field
          data-hydrated={hydrated ? "" : undefined}
          className={cn("flex items-center gap-1.5 rounded-xl border border-border bg-card p-1.5 shadow-sm focus-within:border-primary focus-within:ring-2 focus-within:ring-ring/30", className)}
          onSubmit={(e) => {
            e.preventDefault();
            // maydon boshqarilmaydi (uncontrolled): skriptlar yuklanishidan oldin yozilgan matn ham yo'qolmaydi
            const form = e.currentTarget;
            const q = String(new FormData(form).get("q") ?? "").replace(/\s+/g, " ").trim();
            form.reset();
            // bo'sh yuborilsa ham — yordamchi misollar bilan ochiladi (nima yozishni bilmaganlar uchun)
            openWith(q.length >= 2 ? q : undefined);
          }}
        >
          {/* tor telefonda (≤ 380px) belgi yashiriladi — yozish maydoniga joy qoladi */}
          <Search className="ml-2 size-5 shrink-0 text-muted-foreground max-[380px]:hidden" aria-hidden />
          <input
            name="q"
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            maxLength={300}
            aria-label={fieldLabel}
            placeholder={placeholder}
            className="h-12 min-w-0 flex-1 bg-transparent px-1 text-base text-foreground outline-none placeholder:text-muted-foreground max-[380px]:pl-2"
          />
          <button
            type="submit"
            data-track="ai_finder_open"
            className="press inline-flex h-12 shrink-0 items-center gap-1.5 rounded-md bg-primary px-3.5 text-base font-semibold text-primary-foreground hover:bg-primary-hover sm:px-5"
          >
            <Sparkles className="size-5" aria-hidden />
            {/* yozuv har doim ko'rinadi (320px da ham): faqat belgi bo'lsa tugma nima qilishi tushunarsiz */}
            {submitLabel}
          </button>
        </form>
      ) : variant === "card" ? (
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
            <ArrowRight className="size-5 shrink-0 text-primary-ink" aria-hidden />
          </button>
          <ul className="mt-3 flex flex-wrap gap-2">
            {examples.map((ex) => (
              <li key={ex} className="flex">
                <button
                  type="button"
                  onClick={() => openWith(ex)}
                  className="press inline-flex min-h-11 items-center rounded-full border border-primary/30 bg-card px-3 text-sm font-semibold text-primary-ink hover:border-primary/60"
                >
                  {ex}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : variant === "bar" ? (
        <button
          type="button"
          onClick={() => openWith()}
          data-track="ai_finder_open"
          aria-label={t("easy.finder.inline_button")}
          // qidiruv kartasi bilan bir xil: oq, tekis, yengil soya; "jonli"ligi — o'zi yozilib turadigan misolda (kamalak chegara yo'q)
          className={cn("press flex min-h-14 w-full items-center gap-3 rounded-2xl bg-card py-1.5 pl-2 pr-1.5 text-left shadow-lg ring-1 ring-black/5", className)}
        >
          <AiAvatar />
          {/* @container: tor joyda (kichik telefon, katta shrift) "YANGI" belgisi yashiriladi — nom to'liq ko'rinsin, ustma-ust tushmasin */}
          <span className="@container min-w-0 flex-1">
            <span className="flex min-w-0 items-center gap-1.5 text-sm font-bold text-foreground">
              <span className="truncate">{t("easy.finder.inline_button")}</span>
              <span className="shrink-0 rounded-full bg-primary-soft px-1.5 text-2xs font-bold uppercase leading-4 text-primary-ink @max-[11rem]:hidden">{t("easy.finder.bar_badge")}</span>
            </span>
            <span className="block truncate text-sm text-muted-foreground" aria-hidden>
              <TypedExamples examples={examples} />
            </span>
          </span>
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground" aria-hidden>
            <ArrowRight className="size-5" />
          </span>
        </button>
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
          className={cn("press inline-flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-full py-1 pl-1 pr-3.5 text-sm font-bold text-primary-ink hover:bg-primary-soft", className)}
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

const noopSubscribe = () => () => {};
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Misollar o'zi yozilib, turib, o'chib turadi (AI "jonli" ko'rinsin); harakat o'chiq bo'lsa — birinchi misol */
function TypedExamples({ examples }: { examples: string[] }) {
  const still = useSyncExternalStore(noopSubscribe, reducedMotion, () => true);
  const [state, setState] = useState({ i: 0, n: 0, del: false });
  const word = examples[state.i % examples.length] ?? "";
  useEffect(() => {
    if (still || !word) return;
    const full = state.n >= word.length;
    const delay = state.del ? 28 : full ? 1700 : 65;
    const id = setTimeout(() => {
      setState((s) => {
        if (s.del) return s.n <= 0 ? { i: s.i + 1, n: 0, del: false } : { ...s, n: s.n - 1 };
        return s.n >= word.length ? { ...s, del: true } : { ...s, n: s.n + 1 };
      });
    }, delay);
    return () => clearTimeout(id);
  }, [state, still, word]);
  if (still) return <>{word}</>;
  return <span className="type-caret">{word.slice(0, state.n)}</span>;
}
