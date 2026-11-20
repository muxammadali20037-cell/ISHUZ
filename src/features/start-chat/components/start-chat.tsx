"use client";

import { useRef, useState, useSyncExternalStore, type ReactNode, type RefObject } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Building2, ChevronRight, Megaphone, Search, UserRound, Wrench, type LucideIcon } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { AiAvatar } from "@/components/shared/ai-avatar";
import { AiPromptBox, AiThread, useAiChat } from "@/features/find/components/ai-chat";
import type { AppMode } from "@/features/mode/mode";

type Step = "start" | "find" | "post";

const noop = () => () => {};

/** E'lon berish — yozilgan birinchi gap bilan yordamchi davom etadi (telefon, hudud va h.k. — keyingi qadamlar) */
export function postHref(mode: AppMode, text: string): string {
  const q = text.replace(/\s+/g, " ").trim().slice(0, 300);
  if (mode === "employer") return `/post/vacancy?${new URLSearchParams({ ai: "1", ...(q ? { q } : {}) }).toString()}`;
  return q ? `/ai/post?${new URLSearchParams({ q }).toString()}` : "/ai/post";
}

/**
 * Asosiy ekran — chat. Rejimga qarab (ega, 2026-11-20 kechqurun: "men ishchiman — menga ish qidirish va o'zim haqimda e'lon
 * kerak; «ish yoki ishchi» nimaga kerak"):
 *   ish izlovchi:  "Nima qilmoqchisiz?" → Ish izlash / E'lon berish (o'zim haqimda)
 *   ish beruvchi:  "Nima qilmoqchisiz?" → Ishchi izlash / Vakansiya berish
 * Izlash → "Xohlagan ishni pastga yozing" + pastga ko'rsatuvchi strelka, yozish maydoni yoritiladi; natija shu suhbatda
 * (oyna, keyin bazadagi haqiqiy e'lonlar). Topilmasa — "+ E'lon qoldiring" (AiThread ichida).
 * E'lon berish → "Qanday ish qidiryapsiz? Yozing" → yozilgani bilan yordamchi ochiladi (keyin telefon va boshqa qadamlar).
 * Tanlovsiz ham pastga yozsa bo'ladi — qidiruv.
 */
export function StartChat({ name, mode }: { name: string | null; mode: AppMode }) {
  const { t } = useT();
  const employer = mode === "employer";
  const chat = useAiChat(employer ? "workers" : "jobs");
  const [step, setStep] = useState<Step>("start");
  const findRef = useRef<HTMLTextAreaElement>(null);
  const postRef = useRef<HTMLTextAreaElement>(null);
  const r = employer ? "e" : "w";
  /** rolga mos matn: k("find") → find_w / find_e, k("find", "hint") → find_w_hint */
  const k = (key: string, tail?: string) => t(`easy.start_chat.${key}_${r}${tail ? `_${tail}` : ""}`);

  return (
    <div className="container-narrow flex min-h-[calc(100dvh-var(--tabbar-height)-4rem)] flex-col" data-start-chat data-chat-mode={mode} data-chat-step={step}>
      <div className="flex-1 space-y-4 py-5" aria-live="polite">
        <Assistant>
          <p className="font-bold">{name ? t("easy.start_chat.hello_name", { name }) : t("easy.start_chat.hello")}</p>
          <p>{t("easy.start_chat.ask_what")}</p>
        </Assistant>
        <Choices>
          <Choice icon={Search} title={k("find")} hint={k("find", "hint")} chosen={step === "find"} track="find" onClick={() => setStep("find")} />
          <Choice icon={employer ? Building2 : UserRound} title={k("post")} hint={k("post", "hint")} chosen={step === "post"} track="post" onClick={() => setStep("post")} />
        </Choices>

        {step === "find" ? (
          <>
            <You>{k("find")}</You>
            <Assistant>
              <p className="font-semibold">{k("ask_find")}</p>
              <p className="text-muted-foreground">{k("example_find")}</p>
            </Assistant>
            {employer ? (
              // ustalar (santexnik, elektrik…) — alohida mini-ilova; kichik qator
              <div className="ai-bubble-in pl-9">
                <Link
                  href="/ustalar"
                  data-track="chat_choice"
                  data-track-to="find_masters"
                  data-chat-choice="find_masters"
                  className="press flex min-h-14 items-center gap-3 rounded-2xl border border-border bg-card px-3.5 py-2.5 shadow-sm hover:border-primary/50"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-ink" aria-hidden>
                    <Wrench className="size-5" strokeWidth={2.25} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-base font-bold leading-tight [overflow-wrap:anywhere]">{t("easy.start_chat.find_masters")}</span>
                    <span className="block text-sm leading-snug text-muted-foreground [overflow-wrap:anywhere]">{t("easy.start_chat.find_masters_hint")}</span>
                  </span>
                  <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                </Link>
              </div>
            ) : null}
            {!chat.turns.length ? <PointDown label={t("easy.start_chat.write_below")} /> : null}
          </>
        ) : null}

        {step === "post" ? (
          <>
            <You>{k("post")}</You>
            <Assistant>
              <p className="font-semibold">{k("ask_post")}</p>
              <p className="text-muted-foreground">{k("example_post")}</p>
              <p className="pt-1 text-sm text-muted-foreground">{k("post_next")}</p>
            </Assistant>
            <PointDown label={t("easy.start_chat.write_below")} />
          </>
        ) : null}

        {/* qidiruv suhbati (oyna, javoblar, haqiqiy e'lonlar) */}
        {step !== "post" && chat.turns.length ? <AiThread chat={chat} examples={[]} scrollOnRestore={false} /> : null}
      </div>

      {/* yozish maydoni pastda yopishgan (pastki menyu ustida); tanlangan qadamda yoritiladi */}
      <div className="sticky bottom-[calc(var(--tabbar-height)+var(--safe-bottom))] z-10 -mx-1 bg-background px-1 pb-1.5 pt-2 md:bottom-0">
        {step === "start" && !chat.turns.length ? <p className="px-1 pb-1.5 text-sm text-muted-foreground">{k("type_hint")}</p> : null}
        <div className={cn("rounded-2xl transition-shadow", step !== "start" && "chat-input-glow")}>
          {step === "post" ? <PostBox mode={mode} inputRef={postRef} placeholder={k("post_placeholder")} /> : <AiPromptBox chat={chat} id="start-chat-text" inputRef={findRef} />}
        </div>
      </div>
    </div>
  );
}

/** "E'lon berish": birinchi gap (kasb, joy…) → yordamchi shu gap bilan ochiladi */
function PostBox({ mode, inputRef, placeholder }: { mode: AppMode; inputRef: RefObject<HTMLTextAreaElement | null>; placeholder: string }) {
  const { t } = useT();
  const router = useRouter();
  const [text, setText] = useState("");
  const [going, setGoing] = useState(false);
  const hydrated = useSyncExternalStore(noop, () => true, () => false);
  const send = () => {
    if (going) return;
    if (text.trim().length < 2) {
      inputRef.current?.focus();
      return;
    }
    setGoing(true);
    router.push(postHref(mode, text));
  };
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
      className="space-y-1.5"
      data-post-box
      data-hydrated={hydrated ? "" : undefined}
    >
      <div className="flex items-end gap-1.5 rounded-2xl border border-input bg-card p-1.5 transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-ring/25">
        <label htmlFor="start-chat-post" className="sr-only">
          {placeholder}
        </label>
        <textarea
          ref={inputRef}
          id="start-chat-post"
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 300))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send();
            }
          }}
          maxLength={300}
          enterKeyHint="send"
          placeholder={placeholder}
          className="min-h-12 min-w-0 flex-1 resize-none overflow-hidden bg-transparent px-2.5 py-3 text-base leading-6 text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
        />
        <button
          type="submit"
          disabled={going}
          aria-label={t("easy.start_chat.post_send")}
          data-track="chat_choice"
          data-track-to={mode === "employer" ? "post_vacancy" : "post_worker"}
          className="press relative flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
        >
          <ArrowUp className={cn("size-5", going && "animate-pulse")} aria-hidden />
        </button>
      </div>
      <p className="flex min-h-5 items-center gap-1.5 px-1 text-xs text-muted-foreground">
        <Megaphone className="size-3.5 shrink-0" aria-hidden /> {t("easy.start_chat.post_note")}
      </p>
    </form>
  );
}

/** Pastga ko'rsatuvchi strelka — yozish maydoni qayerdaligi darhol ko'rinadi (harakat kamaytirilsa — qimirlamaydi) */
function PointDown({ label }: { label: string }) {
  return (
    <div className="ai-bubble-in flex flex-col items-center gap-1 pt-2 text-primary-ink" data-point-down>
      <span className="text-sm font-semibold">{label}</span>
      <ArrowDown className="size-7 motion-safe:animate-bounce" strokeWidth={2.5} aria-hidden />
    </div>
  );
}

function Assistant({ children }: { children: ReactNode }) {
  return (
    <div className="ai-bubble-in flex items-start gap-2.5">
      <AiAvatar size="sm" className="mt-1" />
      <div className="max-w-[88%] space-y-0.5 rounded-2xl rounded-tl-md bg-secondary px-4 py-3 text-base leading-relaxed">{children}</div>
    </div>
  );
}

function You({ children }: { children: ReactNode }) {
  const { t } = useT();
  return (
    <div className="ai-bubble-in flex justify-end">
      <p className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-base text-primary-foreground">
        <span className="sr-only">{t("easy.finder.you")}: </span>
        {children}
      </p>
    </div>
  );
}

function Choices({ children }: { children: ReactNode }) {
  return <div className="ai-bubble-in grid grid-cols-2 gap-2.5 pl-9">{children}</div>;
}

function Choice({
  icon: Icon,
  title,
  hint,
  chosen,
  track,
  onClick,
}: {
  icon: LucideIcon;
  title: string;
  hint: string;
  chosen: boolean;
  track: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={chosen}
      data-track="chat_choice"
      data-track-to={track}
      data-chat-choice={track}
      className={cn(
        // min-w-0 + so'z bo'linishi: ruscha uzun so'zlar va katta shriftda (150%) karta ekrandan chiqmaydi
        "press flex min-h-28 min-w-0 flex-col items-start gap-2 rounded-2xl border bg-card p-3.5 text-left shadow-sm transition-colors",
        chosen ? "border-primary ring-2 ring-primary/25" : "border-border hover:border-primary/50",
      )}
    >
      <span className={cn("flex size-10 items-center justify-center rounded-xl", chosen ? "bg-primary text-primary-foreground" : "bg-primary-soft text-primary-ink")} aria-hidden>
        <Icon className="size-5" strokeWidth={2.25} />
      </span>
      <span className="max-w-full text-lg font-bold leading-tight hyphens-auto [overflow-wrap:anywhere]">{title}</span>
      <span className="max-w-full text-sm leading-snug text-muted-foreground hyphens-auto [overflow-wrap:anywhere]">{hint}</span>
    </button>
  );
}

