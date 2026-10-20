"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, useTransition, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import { ArrowRight, ArrowUp, BriefcaseBusiness, ListFilter, Mic, Plus, RotateCcw, Search, Square, UsersRound } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { callAction } from "@/lib/action-call";
import { Button } from "@/components/ui/button";
import { AiAvatar } from "@/components/shared/ai-avatar";
import { cn } from "@/lib/utils";
import { aiFind, type AiFindResult } from "../ai-find";
import { CHAT_KEEP, REFINE_WORDS, chatStorageKey, parseStoredChat, refineOptions, refineQuery, serializeChat, speechLang, type FinderMode, type RefineKey } from "../ai-chat-model";
import { JobResultCard, WorkerResultCard } from "./result-cards";

/**
 * AI yordamchi — suhbat ko'rinishi (2026-10): foydalanuvchi oddiy so'z bilan yozadi yoki aytadi, yordamchi nimani
 * tushunganini chiplar bilan ko'rsatadi va bazadagi haqiqiy e'lonlarni/ishchilarni shu yerda chiqaradi. Keyin bir bosishda
 * aniqlashtiriladi ("+ Kunlik", "+ Tajribasiz"…) — oxirgi so'rovga so'z qo'shiladi. Suhbat shu tabda 30 daqiqa saqlanadi:
 * e'lon ochilib "Orqaga" bosilsa, natija yo'qolmaydi. Bitta mantiq ikki joyda: oyna (AiFinder) va /ai sahifasi (AiChatPanel).
 */

export interface AiTurn {
  id: number;
  /** serverga yuborilgan matn */
  query: string;
  /** ekranda ko'rinadigan matn (aniqlashtirishda — tugma nomi) */
  display: string;
  refine?: boolean;
  mode: FinderMode;
  status: "pending" | "done" | "error";
  result?: AiFindResult;
  error?: string;
}

const noopSubscribe = () => () => {};

function storageRead(mode: FinderMode): AiTurn[] {
  try {
    return parseStoredChat<AiTurn>(sessionStorage.getItem(chatStorageKey(mode)), Date.now()).filter((t) => t.status !== "pending");
  } catch {
    return [];
  }
}

function storageWrite(mode: FinderMode, turns: AiTurn[]) {
  try {
    const done = turns.filter((t) => t.status !== "pending");
    if (done.length) sessionStorage.setItem(chatStorageKey(mode), serializeChat(done, Date.now()));
    else sessionStorage.removeItem(chatStorageKey(mode));
  } catch {
    // maxfiy rejim yoki to'lgan xotira — suhbat faqat shu ekranda qoladi
  }
}

/** Suhbat holati: rejim, xabarlar, so'rov yuborish, aniqlashtirish, tozalash (oyna va sahifa uchun umumiy) */
export function useAiChat(defaultMode: FinderMode) {
  const { t } = useT();
  const [mode, setModeState] = useState<FinderMode>(defaultMode);
  const [turns, setTurns] = useState<AiTurn[]>([]);
  const [ready, setReady] = useState(false);
  /** qurilmadan tiklangan oxirgi xabar — sahifada u uchun ekran avtomatik surilmaydi */
  const [restoredId, setRestoredId] = useState<number | null>(null);
  const [pending, start] = useTransition();
  const seq = useRef(0);

  // qurilmada saqlangan suhbat — faqat brauzerda, birinchi chizishdan keyin (SSR bilan mos)
  useEffect(() => {
    const stored = storageRead(defaultMode);
    seq.current = Math.max(Date.now(), ...stored.map((s) => s.id));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- tashqi xotiradan bir martalik tiklash
    setTurns((cur) => (cur.length ? cur : stored));
    setRestoredId(stored.at(-1)?.id ?? null);
    setReady(true);
  }, [defaultMode]);

  useEffect(() => {
    if (ready) storageWrite(mode, turns);
  }, [ready, mode, turns]);

  const errorText = useCallback(
    (code: string) => {
      for (const key of [`easy.finder.errors.${code}`, `common.errors.${code}`]) {
        const v = t(key);
        if (v !== key) return v;
      }
      return t("common.errors.generic");
    },
    [t],
  );

  const ask = (text: string, opts?: { display?: string; refine?: boolean }) => {
    const q = text.replace(/\s+/g, " ").trim().slice(0, 300);
    if (q.length < 2 || pending) return false;
    const id = ++seq.current;
    const m = mode;
    setTurns((cur) => [...cur, { id, query: q, display: opts?.display ?? q, refine: opts?.refine, mode: m, status: "pending" as const }].slice(-CHAT_KEEP));
    start(async () => {
      const res = await callAction(() => aiFind({ text: q, mode: m }));
      setTurns((cur) =>
        cur.map((turn) =>
          turn.id !== id ? turn : res.ok && res.data ? { ...turn, status: "done", result: res.data } : { ...turn, status: "error", error: errorText(res.ok ? "generic" : res.error) },
        ),
      );
    });
    return true;
  };

  const refine = (base: AiTurn, key: RefineKey) => ask(refineQuery(base.query, REFINE_WORDS[key]), { display: `+ ${t(`easy.finder.refine.${key}`)}`, refine: true });

  const setMode = (m: FinderMode) => {
    if (m === mode || pending) return;
    setModeState(m);
    setTurns(storageRead(m));
  };

  const clear = () => {
    if (!pending) setTurns([]);
  };

  /** Shu sahifadagi boshqa AI oynasi suhbatni davom ettirgan bo'lishi mumkin — ochilganda qurilmadagisi olinadi */
  const reload = () => {
    if (pending) return;
    const stored = storageRead(mode);
    setTurns(stored);
    setRestoredId(stored.at(-1)?.id ?? null);
  };

  return { mode, setMode, turns, pending, ask, refine, clear, reload, restoredId };
}

export type AiChatState = ReturnType<typeof useAiChat>;

/** Rejim tanlovi (ish yoki xodim) yoki — rejim qulflangan bo'lsa — qayerda qidirilishi */
export function AiModeSwitch({ chat, locked }: { chat: AiChatState; locked: boolean }) {
  const { t } = useT();
  if (locked) {
    return (
      <p className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-3 py-1.5 text-sm font-semibold text-primary">
        {chat.mode === "workers" ? <UsersRound className="size-4" aria-hidden /> : <BriefcaseBusiness className="size-4" aria-hidden />}
        {chat.mode === "workers" ? t("easy.mode.finder_in_workers") : t("easy.mode.finder_in_jobs")}
      </p>
    );
  }
  return (
    <div role="radiogroup" aria-label={t("easy.finder.mode_label")} className="grid grid-cols-2 gap-1 rounded-xl bg-secondary p-1">
      {(
        [
          ["jobs", BriefcaseBusiness, t("easy.finder.mode_jobs")],
          ["workers", UsersRound, t("easy.finder.mode_workers")],
        ] as const
      ).map(([m, Icon, label]) => (
        <button
          key={m}
          type="button"
          role="radio"
          aria-checked={chat.mode === m}
          onClick={() => chat.setMode(m)}
          className={cn(
            "press flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 text-base font-semibold",
            chat.mode === m ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Icon className={cn("size-5 shrink-0", chat.mode === m && "text-primary")} aria-hidden /> {label}
        </button>
      ))}
    </div>
  );
}

function AssistantHead({ busy, note }: { busy?: boolean; note?: string | null }) {
  const { t } = useT();
  return (
    <div className="flex items-center gap-2">
      <AiAvatar busy={busy} size="sm" />
      <span className="text-sm font-bold">{t("easy.finder.assistant_title")}</span>
      {note ? <span className="min-w-0 truncate text-sm text-muted-foreground">· {note}</span> : null}
    </div>
  );
}

function Bubble({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("rounded-2xl rounded-tl-md bg-secondary px-4 py-3 text-base leading-relaxed", className)}>{children}</div>;
}

/** O'ylayotgan holat: uch nuqta va almashinib turadigan qisqa izoh */
function Thinking({ mode }: { mode: FinderMode }) {
  const { t } = useT();
  const steps = [t("easy.finder.thinking_understand"), mode === "workers" ? t("easy.finder.thinking_workers") : t("easy.finder.thinking_jobs")];
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((n) => Math.min(n + 1, steps.length - 1)), 1400);
    return () => clearInterval(id);
  }, [steps.length]);
  return (
    <div className="ai-bubble-in space-y-2" role="status">
      <AssistantHead busy />
      <Bubble className="inline-flex items-center gap-3 text-muted-foreground">
        <span className="ai-dots text-primary" aria-hidden>
          <span />
          <span />
          <span />
        </span>
        <span className="text-sm font-semibold">{steps[i]}</span>
      </Bubble>
    </div>
  );
}

function Understood({ result }: { result: AiFindResult }) {
  const { t } = useT();
  return (
    <p className="flex flex-wrap items-center gap-1.5 text-base font-semibold">
      {t("easy.finder.understood")}
      {result.understood.map((u) => (
        <span key={u} className="inline-flex min-h-7 items-center rounded-full border border-primary/25 bg-card px-2.5 text-sm font-semibold text-primary">
          {u}
        </span>
      ))}
    </p>
  );
}

/** Yordamchining javobi: tushunilgani, topilgan soni, kartalar (faqat oxirgi javobda), aniqlashtirish */
function Answer({ turn, latest, chat }: { turn: AiTurn & { result: AiFindResult }; latest: boolean; chat: AiChatState }) {
  const { t } = useT();
  const r = turn.result;
  const count = r.jobs.length + r.workers.length;
  const note = r.source === "ai" ? t("easy.finder.by_ai") : t("easy.finder.by_rules");
  const options = count && latest ? refineOptions(r.mode, r.applied) : [];

  if (r.needProfession) {
    return (
      <div className="ai-bubble-in space-y-2">
        <AssistantHead note={note} />
        <Bubble className="space-y-2">
          <p className="text-lg font-bold">{t("easy.finder.need_profession")}</p>
          <p className="text-muted-foreground">{t("easy.finder.need_profession_desc")}</p>
          <Button asChild variant="outline" className="h-11 bg-card text-base">
            <Link href={r.href}>
              <ListFilter className="size-5" aria-hidden /> {t("easy.finder.pick_from_list")}
            </Link>
          </Button>
        </Bubble>
      </div>
    );
  }

  return (
    <div className="ai-bubble-in space-y-3">
      <AssistantHead note={note} />
      <Bubble className="space-y-2">
        <Understood result={r} />
        {count ? (
          <p className="font-bold">{r.mode === "workers" ? t("easy.finder.found_workers_chat", { count: r.total }) : t("easy.finder.found_jobs_chat", { count: r.total })}</p>
        ) : (
          <>
            <p className="text-lg font-bold">{r.mode === "workers" ? t("easy.finder.empty_workers") : t("easy.finder.empty_jobs")}</p>
            <p className="text-muted-foreground">{t("easy.finder.empty_desc")}</p>
          </>
        )}
        {!latest || !count ? (
          <Link href={r.href} className="inline-flex min-h-11 items-center gap-1 font-semibold text-primary hover:underline">
            {t("easy.finder.open_results")} <ArrowRight className="size-4" aria-hidden />
          </Link>
        ) : null}
      </Bubble>

      {latest && count ? (
        <>
          <ul className="grid grid-cols-1 gap-3">
            {r.jobs.map((job) => (
              <li key={job.id} className="flex [&>article]:w-full">
                <JobResultCard job={job} imageUrl={job.profession_node_id ? r.images[job.profession_node_id] : null} photoPath={r.photos[job.id] ?? null} saved={r.saved.includes(job.id)} />
              </li>
            ))}
            {r.workers.map((w) => (
              <li key={w.id} className="flex [&>article]:w-full">
                <WorkerResultCard worker={w} imageUrl={w.profession_node_id ? r.images[w.profession_node_id] : null} saved={r.saved.includes(w.id)} />
              </li>
            ))}
          </ul>
          {r.total > count ? (
            <Button asChild variant="outline" size="lg" fullWidth className="text-base">
              <Link href={r.href}>
                {t("easy.finder.show_all", { count: r.total })} <ArrowRight className="size-5" aria-hidden />
              </Link>
            </Button>
          ) : null}
        </>
      ) : null}

      {options.length ? (
        <div className="space-y-2" role="group" aria-label={t("easy.finder.refine_label")}>
          <p className="text-sm font-semibold text-muted-foreground">{t("easy.finder.refine_label")}</p>
          <div className="flex flex-wrap gap-2">
            {options.map((key) => {
              const label = t(`easy.finder.refine.${key}`);
              return (
                <button
                  key={key}
                  type="button"
                  disabled={chat.pending}
                  onClick={() => chat.refine(turn, key)}
                  aria-label={t("easy.finder.refine_add", { label })}
                  className="press inline-flex min-h-11 items-center gap-1.5 rounded-full border border-primary/30 bg-card px-3.5 text-sm font-semibold text-primary hover:bg-primary-soft disabled:opacity-50"
                >
                  <Plus className="size-4" aria-hidden /> {label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Suhbat oqimi: salomlashuv va misollar (bo'sh bo'lsa) yoki xabarlar; yangi xabar ko'rinadigan joyga suriladi */
export function AiThread({ chat, examples, scrollOnRestore = true }: { chat: AiChatState; examples: string[]; scrollOnRestore?: boolean }) {
  const { t } = useT();
  const lastRef = useRef<HTMLLIElement>(null);
  const last = chat.turns.at(-1);
  const lastKey = last ? `${last.id}:${last.status}` : "";
  // sahifada (/ai) qurilmadan tiklangan suhbat uchun ekran o'zi surilmaydi — sarlavha ko'rinib tursin
  const skip = !scrollOnRestore && !!last && last.id === chat.restoredId;

  useEffect(() => {
    if (lastKey && !skip) lastRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [lastKey, skip]);

  if (!chat.turns.length) {
    return (
      <div className="ai-bubble-in space-y-3">
        <AssistantHead />
        <Bubble>{chat.mode === "workers" ? t("easy.finder.greeting_workers") : t("easy.finder.greeting_jobs")}</Bubble>
        <p className="pt-1 text-sm font-semibold text-muted-foreground">{t("easy.finder.try_label")}</p>
        <ul className="flex flex-wrap gap-2">
          {examples.map((ex) => (
            <li key={ex} className="flex">
              <button
                type="button"
                disabled={chat.pending}
                onClick={() => chat.ask(ex)}
                className="press inline-flex min-h-11 items-center gap-2 rounded-full border border-primary/30 bg-primary-soft px-3.5 text-base font-semibold text-primary hover:border-primary/60"
              >
                <Search className="size-4 shrink-0" aria-hidden />
                {ex}
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const lastDone = [...chat.turns].reverse().find((x) => x.status === "done")?.id;
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={chat.clear}
          disabled={chat.pending}
          className="press -my-2 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          <RotateCcw className="size-4" aria-hidden /> {t("easy.finder.new_chat")}
        </button>
      </div>
      <ol className="space-y-5" aria-live="polite">
        {chat.turns.map((turn) => (
          <li key={turn.id} ref={turn.id === last?.id ? lastRef : undefined} className="scroll-mt-16 space-y-4">
            <div className="ai-bubble-in flex justify-end">
              <p className={cn("max-w-[85%] rounded-2xl rounded-br-md px-4 py-2.5 text-base [overflow-wrap:anywhere]", turn.refine ? "border border-primary/30 bg-primary-soft font-semibold text-primary" : "bg-primary text-primary-foreground")}>
                <span className="sr-only">{t("easy.finder.you")}: </span>
                {turn.display}
              </p>
            </div>
            {turn.status === "pending" ? (
              <Thinking mode={turn.mode} />
            ) : turn.status === "error" ? (
              <div className="ai-bubble-in space-y-2">
                <AssistantHead />
                <Bubble className="space-y-2 bg-destructive-soft text-destructive">
                  <p role="alert">{turn.error}</p>
                  <Button type="button" variant="outline" className="h-11 bg-card text-base" disabled={chat.pending} onClick={() => chat.ask(turn.query, { display: turn.display, refine: turn.refine })}>
                    <RotateCcw className="size-4" aria-hidden /> {t("easy.search.retry")}
                  </Button>
                </Bubble>
              </div>
            ) : turn.result ? (
              <Answer turn={turn as AiTurn & { result: AiFindResult }} latest={turn.id === lastDone && turn.id === last?.id} chat={chat} />
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ovozli kiritish (Web Speech API): brauzer qo'llasa — mikrofon tugmasi; aytilgan gap maydonga yoziladi va yuboriladi.
// Qo'llamasa (masalan, Android WebView) — tugma ko'rinmaydi. Ovoz serverga yuborilmaydi — matnga brauzer aylantiradi.
// ---------------------------------------------------------------------------

interface SpeechResultList {
  length: number;
  [i: number]: { isFinal: boolean; 0: { transcript: string } };
}
interface SpeechRec {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { resultIndex: number; results: SpeechResultList }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type SpeechCtor = new () => SpeechRec;

function speechCtor(): SpeechCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SpeechCtor; webkitSpeechRecognition?: SpeechCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useVoice(onInterim: (text: string) => void, onFinal: (text: string) => void, opts?: { continuous?: boolean }) {
  const { locale } = useT();
  const supported = useSyncExternalStore(noopSubscribe, () => !!speechCtor(), () => false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<"denied" | "failed" | null>(null);
  const rec = useRef<SpeechRec | null>(null);
  const finalText = useRef("");

  useEffect(() => () => rec.current?.abort(), []);

  const stop = () => rec.current?.stop();
  const start = () => {
    const Ctor = speechCtor();
    if (!Ctor || listening) return;
    setError(null);
    finalText.current = "";
    const r = new Ctor();
    r.lang = speechLang(locale);
    r.interimResults = true;
    // uzun matn (rezyume, vakansiya) — to'xtatilguncha tinglaydi; qidiruv — bitta gap
    r.continuous = !!opts?.continuous;
    r.maxAlternatives = 1;
    r.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i]!;
        if (res.isFinal) finalText.current += res[0].transcript;
        else interim += res[0].transcript;
      }
      onInterim((finalText.current + interim).trim());
    };
    r.onerror = (e) => setError(e.error === "not-allowed" || e.error === "service-not-allowed" ? "denied" : e.error === "aborted" || e.error === "no-speech" ? null : "failed");
    r.onend = () => {
      setListening(false);
      rec.current = null;
      const text = finalText.current.trim();
      if (text) onFinal(text);
    };
    rec.current = r;
    try {
      r.start();
      setListening(true);
    } catch {
      setError("failed");
    }
  };
  return { supported, listening, error, start, stop };
}

/** Yozish maydoni: matn (Enter — yuborish), mikrofon (qo'llansa) va yuborish tugmasi */
export function AiPromptBox({ chat, id = "ai-finder-text", autoFocus = false, inputRef }: { chat: AiChatState; id?: string; autoFocus?: boolean; inputRef?: RefObject<HTMLTextAreaElement | null> }) {
  const { t } = useT();
  const [text, setText] = useState("");
  const ownRef = useRef<HTMLTextAreaElement>(null);
  const ref = inputRef ?? ownRef;

  // maydon matn bilan birga 4 qatorgacha o'sadi
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }, [text, ref]);

  const send = (value = text) => {
    if (chat.ask(value)) setText("");
    else if (value.trim().length < 2) ref.current?.focus();
  };
  const voice = useVoice(setText, (spoken) => send(spoken));

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    }
  };

  const status = voice.listening ? t("easy.finder.voice_listening") : voice.error === "denied" ? t("easy.finder.voice_denied") : voice.error ? t("easy.finder.voice_error") : null;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
      className="space-y-1.5"
    >
      <div className="flex items-end gap-1.5 rounded-2xl border border-input bg-card p-1.5 transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-ring/25">
        <label htmlFor={id} className="sr-only">
          {t("easy.finder.label")}
        </label>
        <textarea
          ref={ref}
          id={id}
          rows={1}
          value={text}
          autoFocus={autoFocus}
          onChange={(e) => setText(e.target.value.slice(0, 300))}
          onKeyDown={onKeyDown}
          maxLength={300}
          enterKeyHint="search"
          placeholder={chat.mode === "workers" ? t("easy.finder.composer_placeholder_workers") : t("easy.finder.composer_placeholder_jobs")}
          // fokus halqasi butun yozish qutisida (focus-within) — ichidagi maydonda ikkinchi halqa chizilmaydi
          className="min-h-11 min-w-0 flex-1 resize-none overflow-hidden bg-transparent px-2.5 py-2.5 text-base leading-6 text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
        />
        {voice.supported ? (
          <button
            type="button"
            onClick={voice.listening ? voice.stop : voice.start}
            aria-pressed={voice.listening}
            aria-label={voice.listening ? t("easy.finder.voice_stop") : t("easy.finder.voice_start")}
            className={cn(
              "ai-mic press relative flex size-11 shrink-0 items-center justify-center rounded-xl",
              voice.listening ? "bg-destructive-soft text-destructive" : "text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}
          >
            {voice.listening ? <Square className="size-4 fill-current" aria-hidden /> : <Mic className="size-5" aria-hidden />}
          </button>
        ) : null}
        <Button type="submit" size="icon" aria-label={t("easy.finder.submit")} loading={chat.pending} className="shrink-0 rounded-xl">
          {chat.pending ? null : <ArrowUp className="size-5" aria-hidden />}
        </Button>
      </div>
      <p className={cn("min-h-5 px-1 text-xs", status && voice.error ? "text-destructive" : "text-muted-foreground")} aria-live="polite">
        {status ?? t("easy.finder.disclaimer")}
      </p>
    </form>
  );
}

/** /ai sahifasi uchun: suhbat sahifaning o'zida (oyna emas), yozish maydoni pastda yopishgan */
export function AiChatPanel({ defaultMode, locked, examples }: { defaultMode: FinderMode; locked: boolean; examples: { jobs: string[]; workers: string[] } }) {
  const chat = useAiChat(defaultMode);
  return (
    <section className="rounded-2xl border border-border bg-card shadow-sm">
      <div className="space-y-4 p-4 sm:p-5">
        <AiModeSwitch chat={chat} locked={locked} />
        <AiThread chat={chat} examples={chat.mode === "workers" ? examples.workers : examples.jobs} scrollOnRestore={false} />
      </div>
      <div className="sticky bottom-[calc(var(--tabbar-height)+var(--safe-bottom))] z-10 rounded-b-2xl border-t border-border bg-card px-3 pb-1.5 pt-3 sm:px-4 md:bottom-0">
        <AiPromptBox chat={chat} id="ai-page-text" />
      </div>
    </section>
  );
}
