"use client";

import { useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowDown, ChevronRight, Plus, Search, Wrench, type LucideIcon } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { AiPromptBox, AiThread, useAiChat } from "@/features/find/components/ai-chat";
import type { AppMode } from "@/features/mode/mode";

/** E'lon berish — alohida ekran (yordamchi): ish beruvchiga vakansiya, ish izlovchiga o'zi haqida e'lon */
export function postHref(mode: AppMode, text = ""): string {
  const q = text.replace(/\s+/g, " ").trim().slice(0, 300);
  if (mode === "employer") return `/post/vacancy?${new URLSearchParams({ ai: "1", ...(q ? { q } : {}) }).toString()}`;
  return q ? `/ai/post?${new URLSearchParams({ q }).toString()}` : "/ai/post";
}

/**
 * Asosiy ekran — chat, ChatGPT kabi sokin (ega, 2026-11-21: "katta kartalar balo battar — 2 ta qator, uzunasiga, kamtarin
 * va chiroyli; tagidagi yozuvlar keraksiz; ranglar yemagan, bolalarcha; yozayotganda ustiga hech narsa chiqmasin"):
 *   salom va savol — oddiy matn (pufakcha va avatar yo'q);
 *   ikkita ixcham qator: Izlash (shu yerda — yozish maydoni fokuslanadi) va E'lon berish (alohida ekran — yordamchi);
 *   pastda — yozish maydoni (ortiqcha izoh yo'q). Natijalar shu suhbatda.
 * Rolga mos: ish izlovchi — "Ish izlash" / "E'lon berish", ish beruvchi — "Ishchi izlash" / "Vakansiya berish".
 */
export function StartChat({ name, mode }: { name: string | null; mode: AppMode }) {
  const { t } = useT();
  const employer = mode === "employer";
  const chat = useAiChat(employer ? "workers" : "jobs");
  const [finding, setFinding] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const k = (key: string) => t(`easy.start_chat.${key}_${employer ? "e" : "w"}`);

  return (
    <div className="container-narrow flex min-h-[calc(100dvh-var(--tabbar-height)-4rem)] flex-col" data-start-chat data-chat-mode={mode} data-chat-step={finding ? "find" : "start"}>
      <div className="flex-1 space-y-5 py-6" aria-live="polite">
        <header className="space-y-1">
          <h1 className="text-2xl font-extrabold leading-tight tracking-tight [overflow-wrap:anywhere]">{name ? t("easy.start_chat.hello_name", { name }) : t("easy.start_chat.hello")}</h1>
          <p className="text-base text-muted-foreground">{t("easy.start_chat.ask_what")}</p>
        </header>

        {/* ikkita ixcham qator — bitta guruhda */}
        <nav aria-label={t("easy.start_chat.ask_what")} className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-sm" data-chat-choices>
          <Row
            icon={Search}
            label={k("find")}
            active={finding}
            track="find"
            onClick={() => {
              setFinding(true);
              // bosilgan zahoti fokus — klaviatura ham ochiladi (iOS faqat foydalanuvchi bosgan paytda ruxsat beradi)
              inputRef.current?.focus();
            }}
          />
          <Row icon={Plus} label={k("post")} href={postHref(mode)} track="post" />
        </nav>

        {finding && !chat.turns.length ? (
          <div className="ai-bubble-in space-y-2">
            <p className="text-base text-muted-foreground" data-point-down>
              {k("ask_find")}
              <ArrowDown className="ml-1.5 inline-block size-4 align-[-0.125em] text-foreground motion-safe:animate-bounce" aria-hidden />
            </p>
            {/* ustalar (santexnik, elektrik…) — ish beruvchiga, kichik havola (katta karta emas) */}
            {employer ? (
              <Link
                href="/ustalar"
                className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-primary-ink hover:underline"
                data-track="chat_choice"
                data-track-to="find_masters"
                data-chat-choice="find_masters"
              >
                <Wrench className="size-4" aria-hidden /> {t("easy.start_chat.find_masters_link")}
              </Link>
            ) : null}
          </div>
        ) : null}

        {chat.turns.length ? <AiThread chat={chat} examples={[]} scrollOnRestore={false} /> : null}
      </div>

      {/* yozish maydoni pastda yopishgan; klaviatura ochilganda pastki menyu yashiriladi va maydon ekran tagiga tushadi
          (oradan matn ko'rinib, ustma-ust chiqmasin — globals.css: .chat-composer) */}
      <div className="chat-composer sticky z-10 -mx-1 bg-background px-1 pb-2 pt-2">
        <AiPromptBox chat={chat} id="start-chat-text" inputRef={inputRef} note={false} />
      </div>
    </div>
  );
}

function Row({
  icon: Icon,
  label,
  track,
  href,
  active = false,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  track: string;
  href?: string;
  active?: boolean;
  onClick?: () => void;
}) {
  const cls = cn(
    "press flex min-h-14 w-full items-center gap-3 px-4 text-left text-base font-semibold transition-colors hover:bg-secondary",
    active && "bg-secondary",
  );
  const inner: ReactNode = (
    <>
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", active ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground")} aria-hidden>
        <Icon className="size-5" strokeWidth={2.25} />
      </span>
      <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{label}</span>
      <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
    </>
  );
  if (href) {
    return (
      <Link href={href} className={cls} data-track="chat_choice" data-track-to={track} data-chat-choice={track}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className={cls} data-track="chat_choice" data-track-to={track} data-chat-choice={track}>
      {inner}
    </button>
  );
}
