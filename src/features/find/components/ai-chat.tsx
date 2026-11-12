"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import { ArrowRight, ArrowUp, BellRing, BriefcaseBusiness, Check, ChevronRight, Copy, Info, ListFilter, MessageCircle, Mic, Plus, RotateCcw, Search, Square, UsersRound, Volume2, VolumeX } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { AiAvatar } from "@/components/shared/ai-avatar";
import { cn } from "@/lib/utils";
import { readEvents } from "@/features/assistant/stream";
import { MESSAGE_MAX_CHARS, type AssistantLang, type ChatMessage } from "@/features/assistant/types";
import type { AiFindResult } from "../ai-find-types";
import {
  CHAT_KEEP,
  REFINE_WORDS,
  chatStorageKey,
  conversationTitle,
  conversationsStorageKey,
  parseStoredChat,
  parseStoredConversations,
  refineOptions,
  refineQuery,
  serializeChat,
  serializeConversations,
  upsertConversation,
  type FinderMode,
  type RefineKey,
  type StoredConversation,
} from "../ai-chat-model";
import { JobResultCard, WorkerResultCard } from "./result-cards";
import { useSpeaker, useVoice } from "./ai-voice";

/**
 * AI yordamchi — suhbat oynasi (2026-11: HR yordamchi). Foydalanuvchi oddiy so'z bilan yozadi yoki aytadi; yordamchi suhbat
 * kontekstini hisobga olib tabiiy javob beradi (matn oqim bilan chiqadi), kerak bo'lsa bazadan qidiradi — topilgan HAQIQIY
 * e'lonlar kartalar bo'lib shu yerda ko'rinadi (kartalar model matnidan emas, bazadan). Keyin bir bosishda aniqlashtiriladi
 * ("+ Kunlik" …) yoki tavsiya savoli bosiladi. Javob istalgan payt to'xtatiladi; xohlasa — ovoz bilan o'qib beriladi.
 * Server: POST /api/assistant (src/features/assistant). AI ishlamasa ham javob keladi (lug'at va shablon).
 * Suhbat faqat shu qurilmada, shu tabda, 30 daqiqa saqlanadi (serverda saqlanmaydi): e'lon ochilib "Orqaga" bosilsa yo'qolmaydi.
 * Bitta mantiq ikki joyda: oyna (AiFinder) va /ai sahifasi (AiChatPanel).
 */

export interface AiTurn {
  id: number;
  /** serverga yuborilgan matn (foydalanuvchi xabari) */
  query: string;
  /** ekranda ko'rinadigan matn (aniqlashtirishda — tugma nomi) */
  display: string;
  refine?: boolean;
  mode: FinderMode;
  status: "pending" | "done" | "error";
  /** javob kutilayotganda: yordamchi nima qilyapti */
  stage?: "thinking" | "searching";
  /** yordamchining javob matni (oqim bilan to'ladi) */
  reply?: string;
  /** bazadan topilganlar (qidiruv bo'lgan bo'lsa) */
  result?: AiFindResult;
  /** bosiladigan keyingi savollar */
  suggestions?: string[];
  /** "ai" — sun'iy intellekt javobi; "rules" — lug'at va shablon (AI ulanmagan yoki ishlamadi) */
  source?: "ai" | "rules";
  lang?: AssistantLang;
  /** foydalanuvchi javobni to'xtatdi */
  stopped?: boolean;
  /** javob boshlangach yuz bergan xato (yarim javob saqlanadi) */
  note?: string;
  error?: string;
}

/** Kontekst uchun serverga yuboriladigan oldingi savol-javoblar soni */
const HISTORY_TURNS = 6;

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

// So'nggi suhbatlar ro'yxati (localStorage, 7 kun, 10 ta) — /ai chap paneli. Joriy suhbat raqami — shu tabda (sessionStorage).
export type AiConversation = StoredConversation<AiTurn>;
const convIdKey = (mode: FinderMode) => `ib_ai_conv_id:${mode}`;

function conversationsRead(mode: FinderMode): AiConversation[] {
  try {
    return parseStoredConversations<AiTurn>(localStorage.getItem(conversationsStorageKey(mode)), Date.now());
  } catch {
    return [];
  }
}

function conversationsWrite(mode: FinderMode, list: AiConversation[]) {
  try {
    if (list.length) localStorage.setItem(conversationsStorageKey(mode), serializeConversations(list));
    else localStorage.removeItem(conversationsStorageKey(mode));
  } catch {
    // ro'yxat shunchaki saqlanmaydi
  }
}

function convIdRead(mode: FinderMode): number | null {
  try {
    const n = Number(sessionStorage.getItem(convIdKey(mode)));
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

function convIdWrite(mode: FinderMode, id: number | null) {
  try {
    if (id) sessionStorage.setItem(convIdKey(mode), String(id));
    else sessionStorage.removeItem(convIdKey(mode));
  } catch {
    // jim
  }
}

export function useAiChat(defaultMode: FinderMode) {
  const { t } = useT();
  const [mode, setModeState] = useState<FinderMode>(defaultMode);
  const [turns, setTurns] = useState<AiTurn[]>([]);
  const [ready, setReady] = useState(false);
  /** qurilmadan tiklangan oxirgi xabar — sahifada u uchun ekran avtomatik surilmaydi */
  const [restoredId, setRestoredId] = useState<number | null>(null);
  /** qurilmada saqlangan so'nggi suhbatlar va joriy suhbat raqami */
  const [storedConvs, setStoredConvs] = useState<AiConversation[]>([]);
  const [convId, setConvIdState] = useState<number | null>(null);
  const seq = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const speaker = useSpeaker();
  const pending = turns.some((x) => x.status === "pending");

  // qurilmada saqlangan suhbat — faqat brauzerda, birinchi chizishdan keyin (SSR bilan mos)
  useEffect(() => {
    const stored = storageRead(defaultMode);
    seq.current = Math.max(Date.now(), ...stored.map((s) => s.id));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- tashqi xotiradan bir martalik tiklash
    setTurns((cur) => (cur.length ? cur : stored));
    setRestoredId(stored.at(-1)?.id ?? null);
    setStoredConvs(conversationsRead(defaultMode));
    // joriy suhbat raqami: saqlangan yoki birinchi savolning raqami (eski yozuvlar uchun)
    setConvIdState(stored.length ? (convIdRead(defaultMode) ?? stored[0]!.id) : null);
    setReady(true);
  }, [defaultMode]);

  // So'nggi suhbatlar ro'yxati: saqlanganlar + joriy suhbat (tugagan savol-javoblari bilan). Savol raqamlari vaqt tamg'asi —
  // "at" shundan olinadi (chizish paytida Date.now() chaqirilmaydi).
  const conversations = useMemo(() => {
    const done = turns.filter((x) => x.status !== "pending");
    if (!convId || !done.length) return storedConvs;
    return upsertConversation(storedConvs, { id: convId, title: conversationTitle(done[0]!.query), at: done.at(-1)!.id, turns: done });
  }, [storedConvs, turns, convId]);

  // javob oqib kelayotganda har bo'lakda xotiraga yozilmaydi — faqat tugagach: joriy suhbat (tab) va so'nggi suhbatlar ro'yxati (qurilma)
  useEffect(() => {
    if (!ready || pending) return;
    storageWrite(mode, turns);
    conversationsWrite(mode, conversations);
  }, [ready, pending, mode, turns, conversations]);

  const setConvId = (id: number | null) => {
    setConvIdState(id);
    convIdWrite(mode, id);
  };

  // oyna yopilsa — kutilayotgan javob bekor qilinadi
  useEffect(() => () => abortRef.current?.abort(), []);

  const errorText = (code: string) => {
    for (const key of [`easy.finder.errors.${code}`, `common.errors.${code}`]) {
      const v = t(key);
      if (v !== key) return v;
    }
    return t("common.errors.generic");
  };

  const patch = (id: number, fn: (turn: AiTurn) => AiTurn) => setTurns((cur) => cur.map((turn) => (turn.id === id ? fn(turn) : turn)));

  const ask = (text: string, opts?: { display?: string; refine?: boolean }) => {
    const q = text.replace(/\s+/g, " ").trim().slice(0, MESSAGE_MAX_CHARS);
    if (q.length < 1 || pending) return false;
    speaker.stop();
    const id = ++seq.current;
    const m = mode;
    // kontekst: shu rejimdagi oxirgi savol-javoblar (yordamchi "Chilonzorda" kabi qisqa davomni tushunishi uchun)
    const history: ChatMessage[] = turns
      .filter((x) => x.mode === m && x.status === "done")
      .slice(-HISTORY_TURNS)
      .flatMap((x) => [
        { role: "user" as const, text: x.query },
        { role: "assistant" as const, text: x.reply?.trim() || "—" },
      ]);
    setTurns((cur) => [...cur, { id, query: q, display: opts?.display ?? q, refine: opts?.refine, mode: m, status: "pending" as const, stage: "thinking" as const }].slice(-CHAT_KEEP));
    if (!convId) setConvId(id);

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    void (async () => {
      // matn bo'laklari kadrga bir marta chiziladi (har harfda butun ro'yxat qayta chizilmasin)
      let buf = "";
      let full = "";
      let frame = 0;
      let finished = false;
      const flush = () => {
        if (frame) cancelAnimationFrame(frame);
        frame = 0;
        if (!buf) return;
        const add = buf;
        buf = "";
        patch(id, (x) => ({ ...x, reply: (x.reply ?? "") + add }));
      };
      const fail = (code: string) => {
        finished = true;
        flush();
        // javob boshlangan bo'lsa — yarim javob qoladi va xato ostida aytiladi; boshlanmagan bo'lsa — "Qayta urinish"
        patch(id, (x) => (x.reply || x.result ? { ...x, status: "done", note: errorText(code) } : { ...x, status: "error", error: errorText(code) }));
      };
      try {
        const res = await fetch("/api/assistant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: [...history, { role: "user", text: q }], role: m === "workers" ? "employer" : "seeker" }),
          signal: ctrl.signal,
        });
        if (!res.ok || !res.body) return fail(res.status === 429 ? "rate_limited" : res.status === 403 ? "forbidden" : "unavailable");
        await readEvents(res.body, (e) => {
          if (finished) return;
          switch (e.type) {
            case "status":
              patch(id, (x) => ({ ...x, stage: e.stage }));
              break;
            case "text":
              buf += e.delta;
              full += e.delta;
              frame ||= requestAnimationFrame(flush);
              break;
            case "results":
              patch(id, (x) => ({ ...x, result: e.data }));
              break;
            case "suggestions":
              patch(id, (x) => ({ ...x, suggestions: e.items.slice(0, 3) }));
              break;
            case "done":
              finished = true;
              flush();
              patch(id, (x) => ({ ...x, status: "done", source: e.source, lang: e.lang }));
              speaker.speakIfEnabled(full, e.lang);
              break;
            case "error":
              fail(e.code);
              break;
          }
        });
        if (!finished) fail("network");
      } catch {
        if (ctrl.signal.aborted) {
          // foydalanuvchi to'xtatdi: kelgan qismi qoladi
          flush();
          patch(id, (x) => ({ ...x, status: "done", stopped: true }));
        } else if (!finished) fail("network");
      } finally {
        if (frame) cancelAnimationFrame(frame);
        if (abortRef.current === ctrl) abortRef.current = null;
      }
    })();
    return true;
  };

  /** Xato bo'lgan savolni qayta yuborish: xato xabari o'rnini yangi javob oladi (ikki marta ko'rinmaydi) */
  const retry = (turn: AiTurn) => {
    if (pending) return;
    setTurns((cur) => cur.filter((x) => x.id !== turn.id));
    ask(turn.query, { display: turn.display, refine: turn.refine });
  };

  /** Javobni to'xtatish (kelgan qismi qoladi) */
  const stop = () => abortRef.current?.abort();

  const refine = (base: AiTurn, key: RefineKey) => ask(refineQuery(base.query, REFINE_WORDS[key]), { display: `+ ${t(`easy.finder.refine.${key}`)}`, refine: true });

  const setMode = (m: FinderMode) => {
    if (m === mode || pending) return;
    speaker.stop();
    setModeState(m);
    const stored = storageRead(m);
    setTurns(stored);
    setStoredConvs(conversationsRead(m));
    setConvIdState(stored.length ? (convIdRead(m) ?? stored[0]!.id) : null);
  };

  /** Yangi suhbat: joriy suhbat ro'yxatda qoladi (yozilgan bo'lsa), ekran bo'shaydi */
  const clear = () => {
    if (pending) return;
    speaker.stop();
    setStoredConvs(conversations);
    setTurns([]);
    setConvId(null);
  };

  /** So'nggi suhbatlardan birini ochish */
  const openConversation = (id: number) => {
    if (pending) return;
    const conv = conversations.find((c) => c.id === id);
    if (!conv) return;
    speaker.stop();
    // joriy suhbat (bo'lsa) ro'yxatda qolsin — endi u "saqlangan"ga aylanadi
    setStoredConvs(conversations);
    seq.current = Math.max(seq.current, ...conv.turns.map((x) => x.id));
    setTurns(conv.turns);
    setRestoredId(conv.turns.at(-1)?.id ?? null);
    setConvId(id);
  };

  /** Suhbatni qurilmadan o'chirish; joriy bo'lsa — ekran ham bo'shaydi (ro'yxat effektda qayta yoziladi) */
  const deleteConversation = (id: number) => {
    if (pending) return;
    setStoredConvs((cur) => cur.filter((c) => c.id !== id));
    if (id === convId) {
      speaker.stop();
      setTurns([]);
      setConvId(null);
    }
  };

  /** Shu sahifadagi boshqa AI oynasi suhbatni davom ettirgan bo'lishi mumkin — ochilganda qurilmadagisi olinadi */
  const reload = () => {
    if (pending) return;
    const stored = storageRead(mode);
    setTurns(stored);
    setRestoredId(stored.at(-1)?.id ?? null);
  };

  /** suhbat tili (oxirgi javobdan) — ovozli kiritish shu tilda tinglaydi */
  const lang = turns.findLast((x) => x.lang)?.lang ?? null;

  return { mode, setMode, turns, pending, ask, retry, stop, refine, clear, reload, restoredId, ready, speaker, lang, conversations, convId, openConversation, deleteConversation };
}

export type AiChatState = ReturnType<typeof useAiChat>;

/** Rejim tanlovi (ish yoki xodim) yoki — rejim qulflangan bo'lsa — qayerda qidirilishi */
export function AiModeSwitch({ chat, locked }: { chat: AiChatState; locked: boolean }) {
  const { t } = useT();
  if (locked) {
    return (
      <p className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-3 py-1.5 text-sm font-semibold text-primary-ink">
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
          <Icon className={cn("size-5 shrink-0", chat.mode === m && "text-primary-ink")} aria-hidden /> {label}
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

/**
 * Jarayon izi — yordamchi hozir nima qilayotgani (va qilgani) ko'rinib turadi: tushunish → bazadan qidirish (nechta topildi) → javob.
 * Faqat haqiqiy bosqichlar: qidiruv bo'lmagan javobda "qidirildi" chiqmaydi; manba (AI yoki oddiy rejim) yashirilmaydi.
 */
function Trace({ turn }: { turn: AiTurn }) {
  const { t } = useT();
  const pending = turn.status === "pending";
  const r = turn.result ?? null;
  const count = r ? r.jobs.length + r.workers.length : 0;
  const steps: { key: string; text: string; state: "done" | "active" | "error" }[] = [];
  if (pending && turn.stage === "thinking" && !turn.reply) steps.push({ key: "understand", text: t("easy.aiws.trace.understanding"), state: "active" });
  else steps.push({ key: "understand", text: t("easy.aiws.trace.understood"), state: "done" });
  if (pending && turn.stage === "searching" && !r) steps.push({ key: "search", text: t("easy.aiws.trace.searching"), state: "active" });
  else if (r) steps.push({ key: "search", text: count || r.total ? t("easy.aiws.trace.searched", { count: r.total || count }) : t("easy.aiws.trace.searched_none"), state: "done" });
  if (pending) {
    if (turn.reply) steps.push({ key: "answer", text: t("easy.aiws.trace.writing"), state: "active" });
  } else if (turn.status === "error") steps.push({ key: "answer", text: t("easy.aiws.trace.failed"), state: "error" });
  else if (turn.stopped) steps.push({ key: "answer", text: t("easy.aiws.trace.stopped"), state: "done" });
  else if (turn.source) steps.push({ key: "answer", text: turn.source === "ai" ? t("easy.aiws.trace.answered_ai") : t("easy.aiws.trace.answered_rules"), state: "done" });
  return (
    <ol className="flex flex-wrap items-center gap-x-1 gap-y-1 text-xs font-semibold text-muted-foreground" aria-label={t("easy.aiws.trace.label")} data-ai-trace>
      {steps.map((st, i) => (
        <li key={st.key} className="flex items-center gap-1" data-state={st.state}>
          {i > 0 ? <ChevronRight className="size-3 opacity-50" aria-hidden /> : null}
          {st.state === "active" ? (
            <span className="ai-dots text-primary-ink" aria-hidden>
              <span />
              <span />
              <span />
            </span>
          ) : st.state === "error" ? (
            <Info className="size-3.5 text-destructive" aria-hidden />
          ) : (
            <Check className="size-3.5 text-success" aria-hidden />
          )}
          <span className={cn(st.state === "active" && "text-foreground", st.state === "error" && "text-destructive")}>{st.text}</span>
        </li>
      ))}
    </ol>
  );
}

function Bubble({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("rounded-2xl rounded-tl-md bg-secondary px-4 py-3 text-base leading-relaxed", className)}>{children}</div>;
}

function Understood({ result }: { result: AiFindResult }) {
  const { t } = useT();
  return (
    <p className="flex flex-wrap items-center gap-1.5 text-base font-semibold">
      {t("easy.finder.understood")}
      {result.understood.map((u) => (
        <span key={u} className="inline-flex min-h-7 items-center rounded-full border border-primary/25 bg-card px-2.5 text-sm font-semibold text-primary-ink">
          {u}
        </span>
      ))}
    </p>
  );
}

/** Hech narsa topilmadi: "yo'q" bilan tugamaydi — yangi e'lon chiqsa Telegram xabari (yozgan matni tayyor) va o'zi e'lon berish */
function EmptyActions({ result }: { result: AiFindResult }) {
  const { t } = useT();
  // sessionStorage'dan tiklangan eski javobda bu havolalar bo'lmasligi mumkin
  const alertHref = result.alertHref ?? (result.mode === "workers" ? "/ai-alerts?role=employer" : "/ai-alerts?role=worker");
  const postHref = result.postHref ?? (result.mode === "workers" ? "/post/vacancy" : "/post/worker");
  return (
    <div className="flex flex-col gap-2 pt-1 sm:flex-row" data-ai-empty-actions>
      {/* uzun tarjima (ruscha, katta shrift) tugmadan chiqib ketmasin: matn ikki qatorga o'tadi */}
      <Button asChild className="h-auto min-h-11 whitespace-normal py-2 text-base">
        <Link href={alertHref}>
          <BellRing className="size-5 shrink-0" aria-hidden /> {t("easy.finder.empty_alert")}
        </Link>
      </Button>
      <Button asChild variant="outline" className="h-auto min-h-11 whitespace-normal bg-card py-2 text-base">
        <Link href={postHref}>
          <Plus className="size-5 shrink-0" aria-hidden /> {result.mode === "workers" ? t("easy.finder.empty_post_vacancy") : t("easy.finder.empty_post_worker")}
        </Link>
      </Button>
    </div>
  );
}

/** Yordamchining javobi: tabiiy matn (oqim bilan), tushunilgani, kartalar (faqat oxirgi javobda), aniqlashtirish va tavsiyalar */
function Answer({ turn, latest, chat }: { turn: AiTurn; latest: boolean; chat: AiChatState }) {
  const { t, locale } = useT();
  const [copied, setCopied] = useState(false);
  const r = turn.result ?? null;
  const pending = turn.status === "pending";
  const reply = turn.reply ?? "";
  const count = r ? r.jobs.length + r.workers.length : 0;
  const note = pending || !turn.source ? null : turn.source === "ai" ? t("easy.finder.by_ai") : t("easy.finder.by_rules");
  const options = r && count && latest && !pending ? refineOptions(r.mode, r.applied) : [];
  const suggestions = latest && !pending ? (turn.suggestions ?? []) : [];
  const unclear = !!r && r.needProfession && r.total === 0;
  /** hech narsa tushunilmadi ("qwerty"): hudud, maosh, grafik ham yo'q — kuzatuvga qo'yadigan narsa yo'q */
  const nothingUnderstood = unclear && !r.flags?.filters;

  const copy = () => {
    void navigator.clipboard?.writeText(reply).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
      () => undefined,
    );
  };
  const tool = "press inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-muted-foreground hover:bg-card hover:text-foreground";

  return (
    <div className="ai-bubble-in space-y-3">
      <AssistantHead busy={pending} note={note} />
      <Trace turn={turn} />
      <Bubble className="space-y-2">
        {reply ? (
          <p data-ai-reply className={cn("whitespace-pre-wrap [overflow-wrap:anywhere]", pending && "type-caret")}>
            {reply}
          </p>
        ) : pending ? (
          <p className="inline-flex items-center gap-3 text-muted-foreground" role="status">
            <span className="ai-dots text-primary-ink" aria-hidden>
              <span />
              <span />
              <span />
            </span>
            <span className="text-sm font-semibold">
              {turn.stage === "searching" ? (turn.mode === "workers" ? t("easy.finder.thinking_workers") : t("easy.finder.thinking_jobs")) : t("easy.finder.thinking_understand")}
            </span>
          </p>
        ) : null}
        {r && !unclear ? <Understood result={r} /> : null}
        {r?.relaxed?.length ? (
          <ul className="space-y-1" aria-label={t("easy.finder.widened")} data-ai-relaxed>
            {r.relaxed.map((line) => (
              <li key={line} className="flex gap-2 rounded-md bg-primary-soft px-3 py-2 text-sm text-foreground">
                <Info className="mt-0.5 size-4 shrink-0 text-primary-ink" aria-hidden />
                {line}
              </li>
            ))}
          </ul>
        ) : null}
        {/* aynan so'ralgani topilmadi (qidiruv kengaytirildi): aynan shunaqasi chiqsa xabar olish — yozgan matni tayyor turadi */}
        {r && count && latest && r.relaxed?.length && r.alertHref ? (
          <Link href={r.alertHref} data-ai-relaxed-alert className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-primary-ink hover:underline">
            <BellRing className="size-4 shrink-0" aria-hidden /> {t("easy.finder.relaxed_alert")}
          </Link>
        ) : null}
        {/* hech narsa topilmadi: "yo'q" bilan tugamaydi — keyingi qadam tugmalari */}
        {/* kasb tushunilmadi — ro'yxatdan tanlash; so'rov tushunilib (hech bo'lmasa hudud yoki shart), lekin topilmadi — yangisi
            chiqsa xabar olish va o'zi e'lon berish; hech narsa tushunilmagan ("qwerty") — faqat ro'yxat */}
        {r && !pending && r.total === 0 ? (
          <>
            {unclear ? (
              <Button asChild variant="outline" className="h-11 bg-card text-base">
                <Link href={r.href}>
                  <ListFilter className="size-5" aria-hidden /> {t("easy.finder.pick_from_list")}
                </Link>
              </Button>
            ) : null}
            {nothingUnderstood ? null : <EmptyActions result={r} />}
          </>
        ) : null}
        {r && count && !latest ? (
          <Link href={r.href} className="inline-flex min-h-11 items-center gap-1 font-semibold text-primary-ink hover:underline">
            {t("easy.finder.open_results")} <ArrowRight className="size-4" aria-hidden />
          </Link>
        ) : null}
        {turn.stopped ? <p className="text-sm text-muted-foreground">{t("easy.finder.stopped")}</p> : null}
        {turn.note ? (
          <p role="alert" className="text-sm text-destructive">
            {turn.note}
          </p>
        ) : null}
        {latest && !pending && reply && (chat.speaker.supported || reply.length > 240) ? (
          <div className="-mx-2 -mb-1.5 flex flex-wrap gap-1" data-ai-reply-actions>
            {chat.speaker.supported ? (
              <button type="button" className={tool} onClick={() => chat.speaker.speak(reply, turn.lang ?? locale)}>
                <Volume2 className="size-4" aria-hidden /> {t("easy.finder.speak")}
              </button>
            ) : null}
            {reply.length > 240 ? (
              <button type="button" className={tool} onClick={copy}>
                {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />} {copied ? t("easy.finder.copied") : t("easy.finder.copy")}
              </button>
            ) : null}
            {/* AI tuzib bergan uzun matn (rezyume, vakansiya): keyingi qadam — shu matn bilan e'lon berish */}
            {reply.length > 240 && turn.source === "ai" ? (
              <Link href={turn.mode === "workers" ? "/post/vacancy" : "/post/worker"} className={cn(tool, "text-primary-ink")}>
                <Plus className="size-4" aria-hidden /> {turn.mode === "workers" ? t("easy.finder.empty_post_vacancy") : t("easy.finder.empty_post_worker")}
              </Link>
            ) : null}
          </div>
        ) : null}
      </Bubble>

      {latest && r && count ? (
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
                  className="press inline-flex min-h-11 items-center gap-1.5 rounded-full border border-primary/30 bg-card px-3.5 text-sm font-semibold text-primary-ink hover:bg-primary-soft disabled:opacity-50"
                >
                  <Plus className="size-4" aria-hidden /> {label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {suggestions.length ? (
        <div className="space-y-2" role="group" aria-label={t("easy.finder.suggest_label")} data-ai-suggestions>
          <p className="text-sm font-semibold text-muted-foreground">{t("easy.finder.suggest_label")}</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((text) => (
              <button
                key={text}
                type="button"
                disabled={chat.pending}
                onClick={() => chat.ask(text)}
                className="press inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border bg-card px-3.5 text-left text-sm font-semibold hover:border-primary/50 hover:text-primary-ink disabled:opacity-50"
              >
                <MessageCircle className="size-4 shrink-0 text-primary-ink" aria-hidden /> {text}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Suhbat oqimi: salomlashuv va misollar (bo'sh bo'lsa) yoki xabarlar; yangi xabar ko'rinadigan joyga suriladi */
export function AiThread({ chat, examples, scrollOnRestore = true, bar: showBar = true }: { chat: AiChatState; examples: string[]; scrollOnRestore?: boolean; /** yuqori qator ("Ovoz bilan javob", "Yangi suhbat") — /ai sahifasida sarlavhada bor */ bar?: boolean }) {
  const { t } = useT();
  const lastRef = useRef<HTMLLIElement>(null);
  const last = chat.turns.at(-1);
  const lastKey = last ? `${last.id}:${last.status}` : "";
  // sahifada (/ai) qurilmadan tiklangan suhbat uchun ekran o'zi surilmaydi — sarlavha ko'rinib tursin
  const skip = !scrollOnRestore && !!last && last.id === chat.restoredId;
  const { speaker } = chat;

  useEffect(() => {
    if (lastKey && !skip) lastRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [lastKey, skip]);

  // yuqori qator: "Ovoz bilan javob" (qurilma qo'llasa) va "Yangi suhbat"
  const bar =
    showBar && (speaker.supported || chat.turns.length) ? (
      <div className="flex items-center justify-between gap-2">
        {speaker.supported ? (
          <button
            type="button"
            role="switch"
            aria-checked={speaker.enabled}
            onClick={() => speaker.setEnabled(!speaker.enabled)}
            className={cn(
              "press -my-2 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold",
              speaker.enabled ? "text-primary-ink" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {speaker.enabled ? <Volume2 className="size-4" aria-hidden /> : <VolumeX className="size-4" aria-hidden />} {t("easy.finder.voice_reply")}
          </button>
        ) : (
          <span />
        )}
        {chat.turns.length ? (
          <button
            type="button"
            onClick={chat.clear}
            disabled={chat.pending}
            className="press -my-2 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            <RotateCcw className="size-4" aria-hidden /> {t("easy.finder.new_chat")}
          </button>
        ) : null}
      </div>
    ) : null;

  if (!chat.turns.length) {
    return (
      <div className="ai-bubble-in space-y-3">
        {bar}
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
                className="press inline-flex min-h-11 items-center gap-2 rounded-full border border-primary/30 bg-primary-soft px-3.5 text-base font-semibold text-primary-ink hover:border-primary/60"
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

  return (
    <div className="space-y-4">
      {bar}
      {/* aria-busy: javob oqib kelayotganda ekran o'qigich har bo'lakni o'qimaydi — tugagach bir marta */}
      <ol className="space-y-5" aria-live="polite" aria-busy={chat.pending}>
        {chat.turns.map((turn) => (
          <li key={turn.id} ref={turn.id === last?.id ? lastRef : undefined} className="scroll-mt-16 space-y-4">
            <div className="ai-bubble-in flex justify-end">
              <p data-ai-you className={cn("max-w-[85%] rounded-2xl rounded-br-md px-4 py-2.5 text-base [overflow-wrap:anywhere]", turn.refine ? "border border-primary/30 bg-primary-soft font-semibold text-primary-ink" : "bg-primary text-primary-foreground")}>
                <span className="sr-only">{t("easy.finder.you")}: </span>
                {turn.display}
              </p>
            </div>
            {turn.status === "error" ? (
              <div className="ai-bubble-in space-y-2">
                <AssistantHead />
                <Trace turn={turn} />
                <Bubble className="space-y-2 bg-destructive-soft text-destructive">
                  <p role="alert">{turn.error}</p>
                  <Button type="button" variant="outline" className="h-11 bg-card text-base" disabled={chat.pending} onClick={() => chat.retry(turn)}>
                    <RotateCcw className="size-4" aria-hidden /> {t("easy.search.retry")}
                  </Button>
                </Bubble>
              </div>
            ) : (
              <Answer turn={turn} latest={turn.id === last?.id} chat={chat} />
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * Yozish maydoni. Asosiy tugma holatga qarab almashadi (messenjerlardagi kabi):
 *  - maydon bo'sh va brauzer ovozni qo'llaydi → katta MIKROFON; tinglayotganda → "To'xtatish" (qizil, pulsli);
 *  - matn bor → "Yuborish"; javob kelayotganda → "Javobni to'xtatish".
 * Aytilgan gap maydonga yoziladi — foydalanuvchi tekshiradi, kerak bo'lsa tuzatadi va o'zi yuboradi (o'zi yuborilmaydi).
 * Mikrofon faqat tugma bosilganda va brauzer ruxsati bilan ishlaydi; ovoz saqlanmaydi.
 */
export function AiPromptBox({ chat, id = "ai-finder-text", autoFocus = false, inputRef }: { chat: AiChatState; id?: string; autoFocus?: boolean; inputRef?: RefObject<HTMLTextAreaElement | null> }) {
  const { t } = useT();
  const [text, setText] = useState("");
  /** maydondagi matn ovozdan kelgan (hali yuborilmagan) — "tekshiring" eslatmasi */
  const [heard, setHeard] = useState(false);
  const ownRef = useRef<HTMLTextAreaElement>(null);
  const ref = inputRef ?? ownRef;
  const { speaker } = chat;

  // maydon matn bilan birga 4 qatorgacha o'sadi
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }, [text, ref]);

  const send = (value = text) => {
    if (chat.ask(value)) {
      setText("");
      setHeard(false);
    } else if (!value.trim()) ref.current?.focus();
  };
  const voice = useVoice(
    (spoken) => setText(spoken.slice(0, MESSAGE_MAX_CHARS)),
    (spoken) => {
      setText(spoken.slice(0, MESSAGE_MAX_CHARS));
      setHeard(true);
    },
    { lang: chat.lang },
  );
  const listen = () => {
    speaker.stop(); // o'qib berilayotgan javob mikrofonga tushmasin
    setHeard(false);
    voice.start();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    }
  };

  const empty = !text.trim();
  const status: { text: string; tone: "live" | "error" | "muted" } | null = voice.listening
    ? { text: t("easy.finder.voice_listening"), tone: "live" }
    : voice.error === "denied"
      ? { text: t("easy.finder.voice_denied"), tone: "error" }
      : voice.error
        ? { text: t("easy.finder.voice_error"), tone: "error" }
        : speaker.speaking
          ? { text: t("easy.finder.voice_speaking"), tone: "live" }
          : heard && !empty
            ? { text: t("easy.finder.voice_review"), tone: "live" }
            : speaker.missing
              ? { text: t("easy.finder.voice_no_voice"), tone: "muted" }
              : null;
  const round = "press relative flex size-12 shrink-0 items-center justify-center rounded-xl";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
      className="space-y-1.5"
      data-voice={voice.listening ? "listening" : chat.pending ? "processing" : speaker.speaking ? "speaking" : voice.error ? "error" : "idle"}
    >
      <div
        className={cn(
          "flex items-end gap-1.5 rounded-2xl border bg-card p-1.5 transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-ring/25",
          voice.listening ? "border-destructive ring-2 ring-destructive/20" : "border-input",
        )}
      >
        <label htmlFor={id} className="sr-only">
          {t("easy.finder.label")}
        </label>
        <textarea
          ref={ref}
          id={id}
          rows={1}
          value={text}
          autoFocus={autoFocus}
          onChange={(e) => setText(e.target.value.slice(0, MESSAGE_MAX_CHARS))}
          onKeyDown={onKeyDown}
          maxLength={MESSAGE_MAX_CHARS}
          enterKeyHint="send"
          placeholder={chat.mode === "workers" ? t("easy.finder.composer_placeholder_workers") : t("easy.finder.composer_placeholder_jobs")}
          // fokus halqasi butun yozish qutisida (focus-within) — ichidagi maydonda ikkinchi halqa chizilmaydi
          className="min-h-12 min-w-0 flex-1 resize-none overflow-hidden bg-transparent px-2.5 py-3 text-base leading-6 text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
        />
        {/* har holatning o'z tugmasi (key): aks holda React bitta tugmani qayta ishlatadi va "To'xtatish" bosilganda u
            shu zahoti "Yuborish"ga aylanib, aytilgan gap tekshirilmasdan yuborilib ketadi */}
        {chat.pending ? (
          <button key="stop" type="button" onClick={chat.stop} aria-label={t("easy.finder.stop_answer")} className={cn(round, "border border-border bg-card text-foreground hover:bg-secondary")}>
            <Square className="size-4 fill-current" aria-hidden />
          </button>
        ) : voice.listening ? (
          <button key="listening" type="button" onClick={voice.stop} aria-pressed aria-label={t("easy.finder.voice_stop")} className={cn(round, "ai-mic bg-destructive-soft text-destructive")}>
            <Square className="size-4 fill-current" aria-hidden />
          </button>
        ) : empty && voice.supported ? (
          <button key="mic" type="button" onClick={listen} aria-pressed={false} aria-label={t("easy.finder.voice_start")} className={cn(round, "bg-primary text-primary-foreground hover:bg-primary-hover")}>
            <Mic className="size-6" aria-hidden />
          </button>
        ) : (
          <button key="send" type="submit" aria-label={t("easy.finder.submit")} className={cn(round, "bg-primary text-primary-foreground hover:bg-primary-hover")}>
            <ArrowUp className="size-5" aria-hidden />
          </button>
        )}
      </div>
      <div className="flex min-h-5 items-center justify-between gap-2 px-1">
        <p className={cn("text-xs", status?.tone === "error" ? "text-destructive" : status?.tone === "live" ? "font-semibold text-foreground" : "text-muted-foreground")} aria-live="polite">
          {status?.text ?? t("easy.finder.disclaimer")}
        </p>
        {speaker.speaking ? (
          <button type="button" onClick={speaker.stop} className="press -my-3 inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-primary-ink hover:bg-secondary">
            <Square className="size-3.5 fill-current" aria-hidden /> {t("easy.finder.voice_stop_speaking")}
          </button>
        ) : null}
      </div>
    </form>
  );
}

/** /ai sahifasi uchun: suhbat sahifaning o'zida (oyna emas), yozish maydoni pastda yopishgan */
export function AiChatPanel({
  defaultMode,
  locked,
  examples,
  initialQuery,
}: {
  defaultMode: FinderMode;
  locked: boolean;
  examples: { jobs: string[]; workers: string[] };
  /** /ai?q=… — bosh sahifadagi maydondan kelgan matn (skriptlar yuklanmasdan yuborilgan): bir marta, o'zi so'raladi */
  initialQuery?: string;
}) {
  const chat = useAiChat(defaultMode);
  const { ready, ask } = chat;
  const asked = useRef(false);
  useEffect(() => {
    if (!ready || asked.current || !initialQuery) return;
    asked.current = true;
    // manzildan ?q= olib tashlanadi — sahifa yangilansa yoki orqaga qaytilsa savol qayta yuborilmaydi
    window.history.replaceState(null, "", window.location.pathname);
    ask(initialQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `ask` har chizishda yangi; savol faqat bir marta yuboriladi (asked)
  }, [ready, initialQuery]);
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
