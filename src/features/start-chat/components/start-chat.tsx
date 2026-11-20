"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Building2, BriefcaseBusiness, Plus, Search, UserRound, UsersRound, type LucideIcon } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { callAction } from "@/lib/action-call";
import { toast } from "@/components/ui/toast";
import { AiAvatar } from "@/components/shared/ai-avatar";
import { AiPromptBox, AiThread, useAiChat } from "@/features/find/components/ai-chat";
import type { FinderMode } from "@/features/find/ai-chat-model";
import { chooseMode } from "@/features/mode/actions";
import type { AppMode } from "@/features/mode/mode";

type Step = "start" | "find" | "post";

/**
 * Asosiy ekran — chat (ega, 2026-11-20: "kirgandan keyin chatga kirsin, chatda tanlansin: ish qidirish yoki e'lon berish;
 * sodda, ortiqcha narsa kerak emas"). Ikki savol, katta tugmalar:
 *   "Nima qilmoqchisiz?" → Izlash / E'lon berish
 *   Izlash      → "Nimani izlaysiz?"        → Ish / Ishchi   (qidiruv shu suhbatning o'zida: oyna, keyin haqiqiy e'lonlar)
 *   E'lon berish → "Qanday e'lon beramiz?" → Men ish izlayapman (o'zim haqimda) / Menga ishchi kerak (vakansiya)
 * Pastda yozish maydoni: kasb yoki savolni darhol yozish mumkin (tanlovsiz ham). Natijalar faqat bazadagi haqiqiy e'lonlar.
 */
export function StartChat({ name, defaultFind }: { name: string | null; defaultFind: FinderMode }) {
  const { t } = useT();
  const router = useRouter();
  const jobs = useAiChat("jobs");
  const workers = useAiChat("workers");
  const [find, setFind] = useState<FinderMode>(defaultFind);
  const [step, setStep] = useState<Step>("start");
  const [going, setGoing] = useState<"worker" | "employer" | null>(null);
  const [, start] = useTransition();
  const chat = find === "workers" ? workers : jobs;

  const pickFind = (m: FinderMode) => {
    const c = m === "workers" ? workers : jobs;
    if (c.pending) return;
    setFind(m);
    // "Ish qidiryapman" — oyna bo'sh ("Qanday ish?") ochiladi: tugma nomi kasb deb tushunilmaydi
    c.ask(t(m === "workers" ? "easy.start_chat.said_find_workers" : "easy.start_chat.said_find_jobs"), { blank: true });
  };

  const pickPost = (mode: AppMode) => {
    if (going) return;
    setGoing(mode);
    start(async () => {
      // e'lon turi = rejim (ish izlovchi yoki ish beruvchi): forma "Siz kimsiz?" deb qayta so'ramaydi
      const res = await callAction(() => chooseMode(mode));
      if (!res.ok) {
        setGoing(null);
        toast.error(t("common.errors.generic"));
        return;
      }
      router.push(mode === "employer" ? "/post/vacancy" : "/ai/post");
    });
  };

  return (
    <div className="container-narrow flex min-h-[calc(100dvh-var(--tabbar-height)-4rem)] flex-col" data-start-chat>
      <div className="flex-1 space-y-4 py-5" aria-live="polite">
        <Assistant>
          <p className="font-bold">{name ? t("easy.start_chat.hello_name", { name }) : t("easy.start_chat.hello")}</p>
          <p>{t("easy.start_chat.ask_what")}</p>
        </Assistant>
        <Choices>
          <Choice icon={Search} title={t("easy.start_chat.find")} hint={t("easy.start_chat.find_hint")} chosen={step === "find"} track="find" onClick={() => setStep("find")} />
          <Choice icon={Plus} title={t("easy.start_chat.post")} hint={t("easy.start_chat.post_hint")} chosen={step === "post"} track="post" onClick={() => setStep("post")} />
        </Choices>

        {step === "find" ? (
          <>
            <You>{t("easy.start_chat.find")}</You>
            <Assistant>
              <p>{t("easy.start_chat.ask_find")}</p>
            </Assistant>
            <Choices>
              <Choice icon={BriefcaseBusiness} title={t("easy.start_chat.find_jobs")} hint={t("easy.start_chat.find_jobs_hint")} chosen={find === "jobs" && jobs.turns.length > 0} track="find_jobs" disabled={jobs.pending} onClick={() => pickFind("jobs")} />
              <Choice icon={UsersRound} title={t("easy.start_chat.find_workers")} hint={t("easy.start_chat.find_workers_hint")} chosen={find === "workers" && workers.turns.length > 0} track="find_workers" disabled={workers.pending} onClick={() => pickFind("workers")} />
            </Choices>
          </>
        ) : null}

        {step === "post" ? (
          <>
            <You>{t("easy.start_chat.post")}</You>
            <Assistant>
              <p>{t("easy.start_chat.ask_post")}</p>
            </Assistant>
            <Choices>
              <Choice icon={UserRound} title={t("easy.start_chat.post_worker")} hint={t("easy.start_chat.post_worker_hint")} chosen={going === "worker"} busy={going === "worker"} disabled={!!going} track="post_worker" onClick={() => pickPost("worker")} />
              <Choice icon={Building2} title={t("easy.start_chat.post_vacancy")} hint={t("easy.start_chat.post_vacancy_hint")} chosen={going === "employer"} busy={going === "employer"} disabled={!!going} track="post_vacancy" onClick={() => pickPost("employer")} />
            </Choices>
          </>
        ) : null}

        {/* qidiruv suhbati (oyna, javoblar, haqiqiy e'lonlar) — "Yangi suhbat" bilan tozalanadi */}
        {chat.turns.length ? <AiThread chat={chat} examples={[]} scrollOnRestore={false} /> : null}
      </div>

      {/* yozish maydoni pastda yopishgan (pastki menyu ustida) */}
      <div className="sticky bottom-[calc(var(--tabbar-height)+var(--safe-bottom))] z-10 -mx-1 bg-background px-1 pb-1.5 pt-2 md:bottom-0">
        {step === "start" && !chat.turns.length ? <p className="px-1 pb-1.5 text-sm text-muted-foreground">{t("easy.start_chat.type_hint")}</p> : null}
        <AiPromptBox chat={chat} id="start-chat-text" />
      </div>
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
  busy = false,
  disabled = false,
  track,
  onClick,
}: {
  icon: LucideIcon;
  title: string;
  hint: string;
  chosen: boolean;
  busy?: boolean;
  disabled?: boolean;
  track: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={chosen}
      aria-busy={busy || undefined}
      data-track="chat_choice"
      data-track-to={track}
      data-chat-choice={track}
      className={cn(
        "press flex min-h-28 flex-col items-start gap-2 rounded-2xl border bg-card p-3.5 text-left shadow-sm transition-colors disabled:opacity-60",
        chosen ? "border-primary ring-2 ring-primary/25" : "border-border hover:border-primary/50",
      )}
    >
      <span className={cn("flex size-10 items-center justify-center rounded-xl", chosen ? "bg-primary text-primary-foreground" : "bg-primary-soft text-primary-ink")} aria-hidden>
        <Icon className={cn("size-5", busy && "animate-pulse")} strokeWidth={2.25} />
      </span>
      <span className="text-lg font-bold leading-tight">{title}</span>
      <span className="text-sm leading-snug text-muted-foreground">{hint}</span>
    </button>
  );
}
