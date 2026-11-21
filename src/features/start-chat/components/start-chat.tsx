"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, BriefcaseBusiness, ChevronDown, Info, MapPin, Plus, RotateCcw, UsersRound, Wrench } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AiAvatar } from "@/components/shared/ai-avatar";
import { AiPromptBox } from "@/features/find/components/ai-chat";
import { AiJobCard, AiWorkerCard } from "@/features/find/components/ai-cards";
import type { QuickList } from "@/features/find/quick-types";
import type { AppMode } from "@/features/mode/mode";
import { useGuidedChat, type AiPart, type GuidedChat, type Msg } from "../guided";

/** E'lon berish — alohida ekran (yordamchi): ish beruvchiga vakansiya, ish izlovchiga o'zi haqida e'lon */
export function postHref(who: "worker" | "employer", text = ""): string {
  const q = text.replace(/\s+/g, " ").trim().slice(0, 300);
  if (who === "employer") return `/post/vacancy?${new URLSearchParams({ ai: "1", ...(q ? { q } : {}) }).toString()}`;
  return q ? `/ai/post?${new URLSearchParams({ q }).toString()}` : "/ai/post";
}

/** Chatda birinchi ko'rinadigan kartalar soni (qolgani "Yana N tasini ko'rsatish" bilan) */
const FIRST = 3;

/**
 * Asosiy ekran — chat (ega, 2026-11-21, master prompt + tanlovlar): tepada oddiy, jaydari savol ("Sizga qanday ishchi
 * kerak? Yozing — topib beramiz."), ostida bosiladigan misollar (yozish maydoniga tushadi, o'zi yuborilmaydi), pastda yozish
 * maydoni. Yozilgach — AI maqsadni o'zi aniqlaydi, yetishmaganini bittadan muloyim so'raydi (hudud — tugmalar), natijalar
 * shu chatda kartalar bilan. Mehmon ("Ish kerakmi yoki ishchi?") ham, kirgan foydalanuvchi ham — bir xil ekran.
 */
export function StartChat({
  mode,
  owner,
  initialQuery = "",
  top,
}: {
  mode: AppMode | null;
  /** foydalanuvchi id yoki "guest" — suhbat shu odamniki */
  owner: string;
  /** ?q=… — sekin telefonda skriptlar yuklanmasdan yuborilgan matn: yuklangach o'zi yuboriladi */
  initialQuery?: string;
  /** sarlavha ustida (server qismi): admin joylagan hikoyalar — faol hikoya bo'lmasa hech narsa chizilmaydi */
  top?: ReactNode;
}) {
  const { t } = useT();
  const chat = useGuidedChat(mode, owner);
  const sent = useRef(false);
  useEffect(() => {
    if (!chat.ready || sent.current || !initialQuery) return;
    sent.current = true;
    // manzildan q olib tashlanadi — sahifa yangilansa savol qayta yuborilmaydi
    window.history.replaceState(null, "", window.location.pathname);
    chat.ask(initialQuery);
  }, [chat, initialQuery]);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [fill, setFill] = useState<{ text: string; n: number } | null>(null);
  const who = mode === "employer" ? "employer" : mode === "worker" ? "worker" : "guest";
  const examples = who === "guest" ? [1, 2] : [1, 2, 3];
  const placeholder = chat.awaiting === "profession" ? t("easy.guided.placeholder_profession") : t(`easy.guided.placeholder_${who}`);
  // skriptlarsiz yuborilgan matn shu sahifaning o'ziga qaytadi (mehmon — "/", kirgan — "/chat")
  const action = owner === "guest" ? "/" : "/chat";

  return (
    <div className="container-narrow flex min-h-[calc(100dvh-var(--tabbar-height)-4rem)] flex-col" data-start-chat data-chat-mode={mode ?? "guest"}>
      <div className="flex-1 space-y-5 py-6">
        {top}
        <header className="space-y-1">
          {/* 320 px telefonda ham bitta qatorda ("Sizga qanday ishchi kerak?") — tor ekranda bir pog'ona kichikroq */}
          <h1 className="text-2xl font-extrabold leading-tight tracking-tight [overflow-wrap:anywhere] max-[359px]:text-xl">{t(`easy.guided.hello_${who}`)}</h1>
          <p className="text-base text-muted-foreground">{t("easy.guided.hello_sub")}</p>
        </header>

        {!chat.msgs.length ? (
          <div className="space-y-3" data-guided-examples>
            <p className="text-sm font-semibold text-muted-foreground">{t("easy.guided.examples_label")}</p>
            <ul className="flex flex-wrap gap-2">
              {examples.map((n) => {
                const text = t(`easy.guided.ex_${who}_${n}`);
                return (
                  <li key={n} className="flex">
                    <button
                      type="button"
                      onClick={() => setFill((f) => ({ text, n: (f?.n ?? 0) + 1 }))}
                      className="press inline-flex min-h-11 items-center rounded-full border border-border bg-card px-4 text-left text-base font-medium text-foreground hover:bg-secondary"
                      data-guided-example
                    >
                      {text}
                    </button>
                  </li>
                );
              })}
            </ul>
            {who !== "worker" ? (
              <Link href="/ustalar" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-primary-ink hover:underline" data-chat-choice="find_masters">
                <Wrench className="size-4" aria-hidden /> {t("easy.guided.masters_link")}
              </Link>
            ) : null}
          </div>
        ) : (
          <Thread chat={chat} />
        )}
      </div>

      {/* yozish maydoni pastda yopishgan; klaviatura ochilganda pastki menyu yashiriladi (globals.css: .chat-composer) */}
      <div className="chat-composer sticky z-10 -mx-1 bg-background px-1 pb-2 pt-2">
        <AiPromptBox chat={chat} id="start-chat-text" inputRef={inputRef} note={false} placeholder={placeholder} fill={fill} action={action} />
      </div>
    </div>
  );
}

function Thread({ chat }: { chat: GuidedChat }) {
  const { t } = useT();
  const lastRef = useRef<HTMLLIElement>(null);
  const last = chat.msgs.at(-1);
  const lastKey = last ? `${last.id}:${last.ai?.kind ?? "you"}` : "";
  useEffect(() => {
    if (lastKey) lastRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [lastKey]);

  return (
    <div className="space-y-4" data-guided-thread>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={chat.clear}
          disabled={chat.pending}
          className="press -my-2 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-muted-foreground hover:text-foreground disabled:opacity-50"
          data-guided-new
        >
          <RotateCcw className="size-4" aria-hidden /> {t("easy.finder.new_chat")}
        </button>
      </div>
      <ol className="space-y-4" aria-live="polite" aria-busy={chat.pending}>
        {chat.msgs.map((m) => (
          <li key={m.id} ref={m.id === last?.id ? lastRef : undefined} className="scroll-mt-16">
            {m.you !== undefined ? (
              <div className="ai-bubble-in flex justify-end">
                <p data-ai-you className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-base text-primary-foreground [overflow-wrap:anywhere]">
                  <span className="sr-only">{t("easy.finder.you")}: </span>
                  {m.you}
                </p>
              </div>
            ) : m.ai ? (
              <Answer msg={m} part={m.ai} chat={chat} latest={m.id === last?.id} />
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}

function Ai({ children, busy = false, kind }: { children: ReactNode; busy?: boolean; kind: string }) {
  const { t } = useT();
  return (
    <div className="ai-bubble-in flex items-start gap-2.5" data-guided-ai={kind}>
      <AiAvatar busy={busy} size="sm" className="mt-1 shrink-0" />
      <div className="min-w-0 flex-1 space-y-3">
        <span className="sr-only">{t("easy.finder.assistant_title")}: </span>
        {children}
      </div>
    </div>
  );
}

function Say({ children }: { children: ReactNode }) {
  return <p className="rounded-2xl rounded-tl-md bg-secondary px-4 py-3 text-base leading-relaxed [overflow-wrap:anywhere]">{children}</p>;
}

function Answer({ msg, part, chat, latest }: { msg: Msg; part: AiPart; chat: GuidedChat; latest: boolean }) {
  const { t } = useT();
  const open = !msg.answered && latest && !chat.pending;

  switch (part.kind) {
    case "thinking":
    case "searching":
      return (
        <Ai kind={part.kind} busy>
          <p className="inline-flex items-center gap-3 px-1 py-2 text-muted-foreground" role="status">
            <span className="ai-dots text-primary-ink" aria-hidden>
              <span />
              <span />
              <span />
            </span>
            <span className="text-sm font-semibold">{part.kind === "thinking" ? t("easy.guided.thinking") : t(`easy.guided.searching_${part.mode}`)}</span>
          </p>
        </Ai>
      );

    case "reply":
      return (
        <Ai kind="reply">
          <Say>{part.text}</Say>
        </Ai>
      );

    case "error":
      return (
        <Ai kind="error">
          <p role="alert" className="rounded-2xl rounded-tl-md bg-destructive-soft px-4 py-3 text-base text-destructive">
            {part.message}
          </p>
        </Ai>
      );

    case "post": {
      const text = part.who === "employer" ? t("easy.guided.post_employer") : part.who === "worker" ? t("easy.guided.post_worker") : t("easy.guided.post_ask");
      return (
        <Ai kind="post">
          <Say>{text}</Say>
          <div className="flex flex-wrap gap-2" data-guided-post>
            {part.who !== "employer" ? (
              <Button asChild className="h-auto min-h-11 whitespace-normal py-2 text-base" data-guided-post-to="worker">
                <Link href={postHref("worker", part.query)}>
                  <Plus className="size-5" aria-hidden /> {part.who ? t("easy.guided.post_worker_btn") : t("easy.guided.post_who_worker")}
                </Link>
              </Button>
            ) : null}
            {part.who !== "worker" ? (
              <Button asChild variant={part.who ? "default" : "outline"} className="h-auto min-h-11 whitespace-normal py-2 text-base" data-guided-post-to="employer">
                <Link href={postHref("employer", part.query)}>
                  <Plus className="size-5" aria-hidden /> {part.who ? t("easy.guided.post_employer_btn") : t("easy.guided.post_who_employer")}
                </Link>
              </Button>
            ) : null}
          </div>
        </Ai>
      );
    }

    case "ask": {
      if (part.ask === "role") {
        return (
          <Ai kind="ask-role">
            <Say>{part.profession ? t("easy.guided.ask_role_p", { p: part.profession }) : t("easy.guided.ask_role")}</Say>
            {open ? (
              <div className="grid gap-2 sm:grid-cols-2" data-guided-roles>
                <ChoiceButton icon={<BriefcaseBusiness />} onClick={() => chat.pickRole("jobs", t("easy.guided.role_jobs"))} tag="jobs">
                  {t("easy.guided.role_jobs")}
                </ChoiceButton>
                <ChoiceButton icon={<UsersRound />} onClick={() => chat.pickRole("workers", t("easy.guided.role_workers"))} tag="workers">
                  {t("easy.guided.role_workers")}
                </ChoiceButton>
              </div>
            ) : null}
          </Ai>
        );
      }
      if (part.ask === "profession") {
        const mode = part.mode ?? "jobs";
        return (
          <Ai kind="ask-profession">
            <Say>{part.word ? t("easy.guided.ask_prof_unknown", { word: part.word }) : t(`easy.guided.ask_prof_${mode}`)}</Say>
          </Ai>
        );
      }
      const mode = part.mode ?? "jobs";
      return (
        <Ai kind="ask-place">
          <Say>{t(`easy.guided.ask_place_${mode}`)}</Say>
          {open && part.options?.length ? (
            <ul className="grid grid-cols-2 gap-2" data-guided-places>
              {part.options.map((o) => (
                <li key={o.value} className="flex">
                  <button
                    type="button"
                    onClick={() => chat.pickPlace(o)}
                    className="press flex min-h-11 w-full items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-left text-sm font-semibold text-foreground hover:bg-secondary"
                    data-guided-place={o.value}
                  >
                    <MapPin className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="min-w-0 [overflow-wrap:anywhere]">{o.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </Ai>
      );
    }

    case "results":
      return <Results part={part} chat={chat} latest={latest} />;
  }
}

function ChoiceButton({ icon, onClick, tag, children }: { icon: ReactNode; onClick: () => void; tag: string; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="press flex min-h-12 w-full items-center gap-2.5 rounded-xl border border-border bg-card px-4 py-2 text-left text-base font-semibold text-foreground hover:bg-secondary [&_svg]:size-5 [&_svg]:shrink-0 [&_svg]:text-primary-ink"
      data-guided-role={tag}
    >
      {icon}
      <span className="min-w-0">{children}</span>
    </button>
  );
}

function CardList({ list, saved, limit }: { list: QuickList; saved: string[]; limit: number }) {
  return (
    <ul className="grid grid-cols-1 gap-3" data-guided-cards>
      {list.jobs.slice(0, limit).map((job) => (
        <li key={job.id}>
          <AiJobCard job={job} saved={saved.includes(job.id)} />
        </li>
      ))}
      {list.workers.slice(0, limit).map((w) => (
        <li key={w.id}>
          <AiWorkerCard worker={w} saved={saved.includes(w.id)} />
        </li>
      ))}
    </ul>
  );
}

function Results({ part, chat, latest }: { part: Extract<AiPart, { kind: "results" }>; chat: GuidedChat; latest: boolean }) {
  const { t } = useT();
  const [expanded, setExpanded] = useState(false);
  const r = part.result;
  const jobs = part.mode === "jobs";
  const loaded = r.jobs.length + r.workers.length;
  const shown = expanded ? loaded : Math.min(loaded, FIRST);

  const summary = (
    <div className="flex flex-wrap items-center gap-1.5" data-guided-summary>
      {r.summary.map((s) => (
        <span key={s} className="inline-flex min-h-8 items-center rounded-full bg-secondary px-3 text-sm font-semibold text-foreground">
          {s}
        </span>
      ))}
    </div>
  );

  if (r.total > 0) {
    return (
      <Ai kind="results">
        <Say>{jobs ? t("easy.guided.found_jobs", { count: r.total }) : t("easy.guided.found_workers", { count: r.total })}</Say>
        {summary}
        <CardList list={r} saved={r.saved} limit={shown} />
        {loaded > shown ? (
          <Button type="button" variant="outline" size="lg" fullWidth className="text-base" onClick={() => setExpanded(true)} data-guided-more>
            <ChevronDown className="size-5" aria-hidden /> {t("easy.guided.more", { count: loaded - shown })}
          </Button>
        ) : r.total > loaded ? (
          <Button asChild variant="outline" size="lg" fullWidth className="text-base" data-guided-all>
            <Link href={r.href}>
              {t("easy.guided.all", { count: r.total })} <ArrowRight className="size-5" aria-hidden />
            </Link>
          </Button>
        ) : null}
      </Ai>
    );
  }

  return (
    <Ai kind="none">
      <Say>{jobs ? t("easy.guided.none_jobs") : t("easy.guided.none_workers")}</Say>
      {summary}
      {r.save === "saved" || r.save === "exists" ? (
        <p className="flex gap-2 text-sm text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden /> {t("easy.quick.saved")}
        </p>
      ) : null}
      {latest ? (
        <div className={cn("space-y-2 rounded-2xl border border-border bg-card p-3")} data-guided-none>
          <p className="text-base">{jobs ? t("easy.guided.none_post_worker") : t("easy.guided.none_post_employer")}</p>
          <Button asChild className="h-auto min-h-11 w-full whitespace-normal py-2 text-base" data-quick-post={jobs ? "worker" : "vacancy"}>
            <Link href={postHref(jobs ? "worker" : "employer", part.query)}>
              <Plus className="size-5" aria-hidden /> {jobs ? t("easy.finder.empty_post_worker") : t("easy.finder.empty_post_vacancy")}
            </Link>
          </Button>
          {part.draft.place !== "all" ? (
            <Button type="button" variant="outline" className="h-auto min-h-11 w-full whitespace-normal py-2 text-base" disabled={chat.pending} onClick={() => chat.otherPlace(part.draft, part.mode)} data-guided-other-place>
              <MapPin className="size-5" aria-hidden /> {t("easy.guided.other_place")}
            </Button>
          ) : null}
        </div>
      ) : null}
      {latest && r.similar ? (
        <section className="space-y-2" data-guided-similar={r.similar.kind}>
          <h3 className="text-base font-bold">{jobs ? t("easy.quick.similar_near_jobs") : t("easy.quick.similar_near_workers")}</h3>
          <CardList list={r.similar} saved={r.similar.saved} limit={FIRST} />
        </section>
      ) : null}
    </Ai>
  );
}
