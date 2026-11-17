"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type FormEvent, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import { ArrowRight, ArrowUp, BellRing, BriefcaseBusiness, Info, LogIn, Pencil, Plus, RotateCcw, Search, SlidersHorizontal, Square, UsersRound } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { FilterChip } from "@/components/ui/chip";
import { Dialog, Sheet } from "@/components/ui/dialog";
import { AiAvatar } from "@/components/shared/ai-avatar";
import { cn } from "@/lib/utils";
import { formatMoneyShort } from "@/lib/format";
import { MESSAGE_MAX_CHARS } from "@/features/assistant/types";
import {
  CHAT_KEEP,
  chatStorageKey,
  conversationTitle,
  conversationsStorageKey,
  parseStoredChat,
  parseStoredConversations,
  serializeChat,
  serializeConversations,
  upsertConversation,
  type FinderMode,
  type StoredConversation,
} from "../ai-chat-model";
import { quickPrepare, quickSearch } from "../quick-actions";
import { NO_FILTERS, QUICK_SALARIES, type QuickAnswers, type QuickFilters, type QuickForm, type QuickList, type QuickResult } from "../quick-types";
import { JobResultCard, WorkerResultCard } from "./result-cards";

/**
 * Yordamchi — suhbat oynasi, ODDIY QIDIRUV (2026-11-16, ega: "AI uzun matn yozmasin. So'rov qilgandan keyin oyna chiqsin —
 * qaysi hududdan, oylik maoshi qancha bo'lsin — oxirida «Qidirish». Ish yo'q bo'lsa — so'rovingiz qoldirildi, e'lon chiqishi
 * bilan xabar beramiz, bo'ldi. Yaqin kasblar chiqqan bo'lsa — pastda. Sodda va tushunarli").
 *  1) foydalanuvchi yozadi → matndan kasb, hudud va maosh tushuniladi (lug'at, kerak bo'lsa AI; AI javob matni YOZMAYDI);
 *  2) oyna (telefonda pastdan): "Qanday ish?", "Qaysi hududda?", "Oylik maosh qancha bo'lsin?" — oldindan to'ldirilgan;
 *  3) "Qidirish" → bazadagi HAQIQIY e'lonlar. Topilmasa — qidiruv saqlanadi (kirgan bo'lsa) va shunga yaqin kasblar pastda.
 * Suhbat faqat shu qurilmada (tab — 30 daqiqa, ro'yxat — 7 kun), serverda saqlanmaydi. Bitta mantiq ikki joyda: oyna
 * (AiFinder) va /ai sahifasi.
 */

/** Oyna javoblarining kaliti (oldindan qidirilgan natija shu javoblar uchunmi) — maydonlar doim bir xil tartibda */
function answersKey(mode: FinderMode, a: QuickAnswers): string {
  return JSON.stringify([mode, a.profession, a.nodeId, a.place, a.salary, a.filters.pay, a.filters.noexp, a.filters.exp, a.filters.schedule]);
}

/** Oyna ochilganda standart javoblar ("Qidirish" o'zgarishsiz bosilsa yuboriladiganlar bilan aynan bir xil) */
export function defaultAnswers(form: QuickForm): QuickAnswers {
  const filters = form.filters ?? NO_FILTERS;
  return {
    profession: form.profession.replace(/\s+/g, " ").trim().slice(0, 120),
    nodeId: form.nodeId,
    place: form.place,
    salary: form.mode === "jobs" && !filters.pay ? form.salary : null,
    filters,
  };
}

export interface AiTurn {
  id: number;
  /** foydalanuvchi yozgan matn */
  query: string;
  /** ekranda ko'rinadigan matn */
  display: string;
  mode: FinderMode;
  /** tezkor tugmadan (matn tushunilmagan) */
  blank?: boolean;
  /** "form" — oyna javoblarini kutyapti */
  status: "pending" | "form" | "done" | "error";
  /** kutilayotganda: tushunish yoki qidirish */
  stage?: "thinking" | "searching";
  form?: QuickForm;
  /** boshqa mavzu ("salom", "kimsan") — oyna o'rniga qisqa javob */
  reply?: string;
  answers?: QuickAnswers;
  quick?: QuickResult;
  /** foydalanuvchi to'xtatdi */
  stopped?: boolean;
  error?: string;
}

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
  /** qaysi savol uchun oyna (so'rovnoma) ochiq */
  const [formFor, setFormFor] = useState<number | null>(null);
  const seq = useRef(0);
  /** har so'rovning raqami: "To'xtatish" yoki yangi so'rovdan keyin kelgan eski javob e'tiborga olinmaydi */
  const runRef = useRef(0);
  /**
   * Oldindan qidiruv (2026-11-17, ega: "hammasi tezlik bilan bo'lsin"): oyna ochilishi bilan standart javoblar bo'yicha
   * natija so'raladi (hech narsa saqlanmaydi); "Qidirish" o'zgarishsiz bosilsa va natija bor bo'lsa — darhol ko'rsatiladi
   */
  const prefetched = useRef<{ key: string; res: ReturnType<typeof quickSearch> } | null>(null);
  const pending = turns.some((x) => x.status === "pending");

  // qurilmada saqlangan suhbat — faqat brauzerda, birinchi chizishdan keyin (SSR bilan mos)
  useEffect(() => {
    const stored = storageRead(defaultMode);
    seq.current = Math.max(Date.now(), ...stored.map((s) => s.id));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- tashqi xotiradan bir martalik tiklash
    setTurns((cur) => (cur.length ? cur : stored));
    setRestoredId(stored.at(-1)?.id ?? null);
    setStoredConvs(conversationsRead(defaultMode));
    setConvIdState(stored.length ? (convIdRead(defaultMode) ?? stored[0]!.id) : null);
    setReady(true);
  }, [defaultMode]);

  // So'nggi suhbatlar ro'yxati: saqlanganlar + joriy suhbat (tugagan savol-javoblari bilan). Savol raqamlari vaqt tamg'asi.
  const conversations = useMemo(() => {
    const done = turns.filter((x) => x.status !== "pending");
    if (!convId || !done.length) return storedConvs;
    return upsertConversation(storedConvs, { id: convId, title: conversationTitle(done[0]!.query), at: done.at(-1)!.id, turns: done });
  }, [storedConvs, turns, convId]);

  useEffect(() => {
    if (!ready || pending) return;
    storageWrite(mode, turns);
    conversationsWrite(mode, conversations);
  }, [ready, pending, mode, turns, conversations]);

  const setConvId = (id: number | null) => {
    setConvIdState(id);
    convIdWrite(mode, id);
  };

  // oyna yopilsa — kelayotgan javob e'tiborga olinmaydi
  useEffect(() => () => void (runRef.current += 1), []);

  const errorText = (code: string) => {
    for (const key of [`easy.finder.errors.${code}`, `common.errors.${code}`]) {
      const v = t(key);
      if (v !== key) return v;
    }
    return t("common.errors.generic");
  };

  const patch = (id: number, fn: (turn: AiTurn) => AiTurn) => setTurns((cur) => cur.map((turn) => (turn.id === id ? fn(turn) : turn)));

  /**
   * Yozilgan matn: tushunish → oyna (so'rovnoma) ochiladi. `blank` — tezkor tugma ("Ish qidirish"): matn tushunilmaydi,
   * oyna bo'sh "Qanday ish?" bilan ochiladi (tugma nomi kasb deb olinmasin)
   */
  const ask = (text: string, opts?: { blank?: boolean }) => {
    const q = text.replace(/\s+/g, " ").trim().slice(0, MESSAGE_MAX_CHARS);
    if (q.length < 1 || pending) return false;
    const id = ++seq.current;
    const m = mode;
    const run = ++runRef.current;
    setFormFor(null);
    setTurns((cur) => [...cur, { id, query: q, display: q, blank: opts?.blank, mode: m, status: "pending" as const, stage: "thinking" as const }].slice(-CHAT_KEEP));
    if (!convId) setConvId(id);
    quickPrepare({ text: opts?.blank ? "" : q, mode: m }).then(
      (res) => {
        if (runRef.current !== run) return;
        if (!res.ok) return patch(id, (x) => ({ ...x, status: "error", stage: undefined, error: errorText(res.error) }));
        const reply = res.data.reply;
        if (reply) return patch(id, (x) => ({ ...x, status: "done", stage: undefined, reply }));
        const form = res.data;
        patch(id, (x) => ({ ...x, status: "form", stage: undefined, form }));
        setFormFor(id);
        const answers = defaultAnswers(form);
        const pre = quickSearch({ mode: m, answers, prefetch: true });
        pre.catch(() => null);
        prefetched.current = { key: answersKey(m, answers), res: pre };
      },
      () => {
        if (runRef.current === run) patch(id, (x) => ({ ...x, status: "error", stage: undefined, error: errorText("network") }));
      },
    );
    return true;
  };

  /** Oynadagi "Qidirish": bazadan haqiqiy e'lonlar */
  const search = (id: number, answers: QuickAnswers) => {
    const turn = turns.find((x) => x.id === id);
    if (!turn || pending) return;
    const run = ++runRef.current;
    setFormFor(null);
    patch(id, (x) => ({ ...x, status: "pending", stage: "searching", answers, quick: undefined, error: undefined, stopped: undefined }));
    // oldindan olingan natija (javoblar o'zgarmagan va nimadir topilgan) — kutilmaydi; topilmagan bo'lsa — haqiqiy qidiruv
    // (o'xshashlar va "so'rovingiz saqlandi" faqat unda)
    const pre = prefetched.current?.key === answersKey(turn.mode, answers) ? prefetched.current.res : null;
    prefetched.current = null;
    const call = (pre ?? Promise.resolve(null))
      .catch(() => null)
      .then((r) => (r?.ok && r.data.total > 0 ? r : quickSearch({ mode: turn.mode, answers })));
    call.then(
      (res) => {
        if (runRef.current !== run) return;
        patch(id, (x) => (res.ok ? { ...x, status: "done", stage: undefined, quick: res.data } : { ...x, status: "error", stage: undefined, error: errorText(res.error) }));
      },
      () => {
        if (runRef.current === run) patch(id, (x) => ({ ...x, status: "error", stage: undefined, error: errorText("network") }));
      },
    );
  };

  /** Xato bo'lgan savolni qayta yuborish */
  const retry = (turn: AiTurn) => {
    if (pending) return;
    if (turn.form && turn.answers) return search(turn.id, turn.answers);
    setTurns((cur) => cur.filter((x) => x.id !== turn.id));
    ask(turn.query, { blank: turn.blank });
  };

  /** To'xtatish: kelayotgan javob e'tiborga olinmaydi; oyna javoblari bo'lsa — qaytadan so'rovnoma */
  const stop = () => {
    runRef.current += 1;
    setTurns((cur) => cur.map((x) => (x.status !== "pending" ? x : x.form ? { ...x, status: "form", stage: undefined } : { ...x, status: "done", stage: undefined, stopped: true })));
  };

  const openForm = (id: number) => {
    if (!pending && turns.some((x) => x.id === id && x.form)) setFormFor(id);
  };
  const closeForm = () => setFormFor(null);

  const setMode = (m: FinderMode) => {
    if (m === mode || pending) return;
    setModeState(m);
    setFormFor(null);
    const stored = storageRead(m);
    setTurns(stored);
    setStoredConvs(conversationsRead(m));
    setConvIdState(stored.length ? (convIdRead(m) ?? stored[0]!.id) : null);
  };

  /** Yangi suhbat: joriy suhbat ro'yxatda qoladi (yozilgan bo'lsa), ekran bo'shaydi */
  const clear = () => {
    if (pending) return;
    setFormFor(null);
    setStoredConvs(conversations);
    setTurns([]);
    setConvId(null);
  };

  /** So'nggi suhbatlardan birini ochish */
  const openConversation = (id: number) => {
    if (pending) return;
    const conv = conversations.find((c) => c.id === id);
    if (!conv) return;
    setFormFor(null);
    setStoredConvs(conversations);
    seq.current = Math.max(seq.current, ...conv.turns.map((x) => x.id));
    setTurns(conv.turns);
    setRestoredId(conv.turns.at(-1)?.id ?? null);
    setConvId(id);
  };

  /** Suhbatni qurilmadan o'chirish; joriy bo'lsa — ekran ham bo'shaydi */
  const deleteConversation = (id: number) => {
    if (pending) return;
    setStoredConvs((cur) => cur.filter((c) => c.id !== id));
    if (id === convId) {
      setFormFor(null);
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

  return { mode, setMode, turns, pending, ask, search, retry, stop, clear, reload, restoredId, ready, conversations, convId, openConversation, deleteConversation, formFor, openForm, closeForm };
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

function Bubble({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("rounded-2xl rounded-tl-md bg-secondary px-4 py-3 text-base leading-relaxed", className)}>{children}</div>;
}

function Dots({ text }: { text: string }) {
  return (
    <p className="inline-flex items-center gap-3 text-muted-foreground" role="status">
      <span className="ai-dots text-primary-ink" aria-hidden>
        <span />
        <span />
        <span />
      </span>
      <span className="text-sm font-semibold">{text}</span>
    </p>
  );
}

/** Natija kartalari (ish yoki nomzod) */
function Cards({ list, saved }: { list: QuickList; saved: string[] }) {
  return (
    <ul className="grid grid-cols-1 gap-3">
      {list.jobs.map((job) => (
        <li key={job.id} className="flex [&>article]:w-full">
          <JobResultCard job={job} imageUrl={job.profession_node_id ? list.images[job.profession_node_id] : null} photoPath={list.photos[job.id] ?? null} saved={saved.includes(job.id)} />
        </li>
      ))}
      {list.workers.map((w) => (
        <li key={w.id} className="flex [&>article]:w-full">
          <WorkerResultCard worker={w} imageUrl={w.profession_node_id ? list.images[w.profession_node_id] : null} saved={saved.includes(w.id)} />
        </li>
      ))}
    </ul>
  );
}

/**
 * Yordamchining javobi — matn yozilmaydi (ega, 2026-11-16): tushunish/qidirish belgisi, oyna tugmasi yoki natija:
 * qisqa xulosa ("Avtoinstruktor · Toshkent shahri · 4 mln so'mdan"), topilganlar; topilmasa — bitta qisqa xabar va pastda
 * shunga yaqin kasblar. Kartalar faqat oxirgi javobda (oldingilarida — havola).
 */
function QuickAnswer({ turn, latest, chat }: { turn: AiTurn; latest: boolean; chat: AiChatState }) {
  const { t } = useT();
  const r = turn.quick ?? null;
  const jobs = turn.mode === "jobs";
  const pending = turn.status === "pending";

  if (pending) {
    return (
      <div className="ai-bubble-in space-y-2">
        <AssistantHead busy />
        <Bubble>
          <Dots text={turn.stage === "searching" ? (jobs ? t("easy.finder.thinking_jobs") : t("easy.finder.thinking_workers")) : t("easy.finder.thinking_understand")} />
        </Bubble>
      </div>
    );
  }

  if (turn.status === "form") {
    return (
      <div className="ai-bubble-in space-y-2" data-quick-pending-form>
        <AssistantHead />
        <Bubble className="space-y-3">
          <p>{t("easy.quick.form_note")}</p>
          <Button type="button" className="h-11 text-base" onClick={() => chat.openForm(turn.id)} disabled={chat.pending} data-quick-open-form>
            <SlidersHorizontal className="size-5" aria-hidden /> {t("easy.quick.open_form")}
          </Button>
        </Bubble>
      </div>
    );
  }

  // boshqa mavzu — oyna yo'q, faqat qisqa javob
  if (turn.reply) {
    return (
      <div className="ai-bubble-in space-y-2" data-quick-reply>
        <AssistantHead />
        <Bubble>
          <p>{turn.reply}</p>
        </Bubble>
      </div>
    );
  }

  if (!r) {
    return (
      <div className="ai-bubble-in space-y-2">
        <AssistantHead />
        <Bubble>
          <p className="text-muted-foreground">{turn.stopped ? t("easy.finder.stopped") : t("common.errors.generic")}</p>
        </Bubble>
      </div>
    );
  }

  const shown = r.jobs.length + r.workers.length;
  return (
    <div className="ai-bubble-in space-y-3" data-quick-answer>
      <AssistantHead />
      {/* nima bo'yicha qidirildi + "O'zgartirish" (oyna qayta ochiladi) */}
      <div className="flex flex-wrap items-center gap-1.5" data-quick-summary>
        {r.summary.map((s) => (
          <span key={s} className="inline-flex min-h-8 items-center rounded-full border border-primary/25 bg-card px-3 text-sm font-semibold text-primary-ink">
            {s}
          </span>
        ))}
        {latest && turn.form ? (
          <button
            type="button"
            onClick={() => chat.openForm(turn.id)}
            disabled={chat.pending}
            className="press inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-sm font-semibold text-muted-foreground hover:text-foreground disabled:opacity-50"
            data-quick-edit
          >
            <Pencil className="size-4" aria-hidden /> {t("easy.quick.edit")}
          </button>
        ) : null}
      </div>

      {r.total > 0 ? (
        <>
          <p className="text-base font-bold" data-quick-found>
            {jobs ? t("easy.quick.found_jobs", { count: r.total }) : t("easy.quick.found_workers", { count: r.total })}
          </p>
          {latest ? <Cards list={r} saved={r.saved} /> : null}
          {latest && r.total > shown ? (
            <Button asChild variant="outline" size="lg" fullWidth className="text-base">
              <Link href={r.href}>
                {t("easy.finder.show_all", { count: r.total })} <ArrowRight className="size-5" aria-hidden />
              </Link>
            </Button>
          ) : null}
          {!latest ? (
            <Link href={r.href} className="inline-flex min-h-11 items-center gap-1 font-semibold text-primary-ink hover:underline">
              {t("easy.finder.open_results")} <ArrowRight className="size-4" aria-hidden />
            </Link>
          ) : null}
        </>
      ) : (
        // topilmadi — bitta qisqa xabar (ega: "bo'ldi, shu yetadi")
        <div
          className={cn("flex gap-3 rounded-2xl px-4 py-3 text-base", r.save === "saved" || r.save === "exists" ? "bg-success-soft" : "bg-secondary")}
          role="status"
          data-quick-none
          data-save={r.save ?? undefined}
        >
          {r.save === "saved" || r.save === "exists" ? <BellRing className="mt-0.5 size-5 shrink-0 text-success" aria-hidden /> : <Info className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />}
          <div className="min-w-0 space-y-2">
            <p className="font-semibold">{jobs ? t("easy.quick.none_jobs") : t("easy.quick.none_workers")}</p>
            {r.save === "saved" || r.save === "exists" ? <p>{t("easy.quick.saved")}</p> : null}
            {r.save === "login" ? (
              <>
                <p>{t("easy.quick.login_note")}</p>
                <Button asChild className="h-11 text-base">
                  <Link href="/auth?next=%2Fai">
                    <LogIn className="size-5" aria-hidden /> {t("easy.quick.login")}
                  </Link>
                </Button>
              </>
            ) : null}
            {!jobs && latest ? (
              <Button asChild variant="outline" className="h-11 bg-card text-base">
                <Link href="/post/vacancy">
                  <Plus className="size-5" aria-hidden /> {t("easy.finder.empty_post_vacancy")}
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
      )}

      {/* shunga yaqin kasblar (yoki shu kasb boshqa hududlarda) — pastda */}
      {latest && r.total === 0 && r.similar ? (
        <section className="space-y-2" aria-labelledby={`similar-${turn.id}`} data-quick-similar={r.similar.kind}>
          <h3 id={`similar-${turn.id}`} className="text-base font-bold">
            {jobs ? t("easy.quick.similar_near_jobs") : t("easy.quick.similar_near_workers")}
          </h3>
          <Cards list={r.similar} saved={r.similar.saved} />
          {r.similar.total > r.similar.jobs.length + r.similar.workers.length ? (
            <Link href={r.similar.href} className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-primary-ink hover:underline">
              {t("easy.finder.show_all", { count: r.similar.total })} <ArrowRight className="size-4" aria-hidden />
            </Link>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

/**
 * So'rovnoma oynasi (telefonda pastdan, kompyuterda markazda): "Qanday ish?", "Qaysi hududda?", "Oylik maosh qancha bo'lsin?"
 * — yozilgan matndan oldindan to'ldirilgan; "Qidirish" — bazadan. Xodim qidirishda maosh so'ralmaydi.
 */
function QuickSheet({ chat }: { chat: AiChatState }) {
  const turn = chat.turns.find((x) => x.id === chat.formFor && x.form) ?? null;
  return (
    <Dialog open={!!turn} onOpenChange={(open) => (open ? undefined : chat.closeForm())}>
      {turn?.form ? <QuickFormBody key={turn.id} turn={turn} form={turn.form} chat={chat} /> : null}
    </Dialog>
  );
}

function QuickFormBody({ turn, form, chat }: { turn: AiTurn; form: QuickForm; chat: AiChatState }) {
  const { t, locale, tEnum } = useT();
  const submitRef = useRef<HTMLButtonElement>(null);
  // eski (filtrsiz) yozuvlar uchun — bo'sh shartlar
  const start = turn.answers ?? { profession: form.profession, nodeId: form.nodeId, place: form.place, salary: form.salary, filters: form.filters ?? NO_FILTERS };
  const [profession, setProfession] = useState(start.profession);
  const [place, setPlace] = useState(start.place);
  const [salary, setSalary] = useState<number | null>(start.salary);
  const [filters, setFilters] = useState<QuickFilters>(start.filters ?? NO_FILTERS);
  const jobs = form.mode === "jobs";
  const formId = `quick-form-${turn.id}`;
  // matndan tushunilgan maosh ro'yxatda bo'lmasa (masalan 5 mln) — u ham tanlov sifatida
  const salaries = [...new Set([...QUICK_SALARIES, ...(start.salary ? [start.salary] : [])])].sort((a, b) => a - b);
  const places = form.places.some((p) => p.value === place) ? form.places : [{ value: place, label: place }, ...form.places];

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    const name = profession.replace(/\s+/g, " ").trim().slice(0, 120);
    // kasb nomi o'zgartirilmagan bo'lsa — tushunilgan kasb bilan (qayta tushunish shart emas)
    const nodeId = name === start.profession.trim() ? start.nodeId : null;
    chat.search(turn.id, { profession: name, nodeId, place, salary: jobs && !filters.pay ? salary : null, filters });
  };

  const chip = (selected: boolean) =>
    cn(
      "press inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold",
      selected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:border-primary/50",
    );

  return (
    <Sheet
      title={jobs ? t("easy.quick.sheet_title_jobs") : t("easy.quick.sheet_title_workers")}
      description={t("easy.quick.sheet_desc")}
      icon={<AiAvatar />}
      // ochilganda fokus "Qidirish"da: telefonda klaviatura o'zi chiqmaydi, Enter bilan darhol qidiriladi
      onOpenAutoFocus={(e) => {
        e.preventDefault();
        submitRef.current?.focus({ preventScroll: true });
      }}
      data-quick-sheet
      footer={
        <Button ref={submitRef} type="submit" form={formId} size="lg" fullWidth className="brand-fill text-base shadow-glow" data-quick-submit>
          <Search className="size-5" aria-hidden /> {t("easy.quick.search")}
        </Button>
      }
    >
      <form id={formId} onSubmit={submit} className="space-y-5 pt-1">
        <div className="space-y-1.5">
          <label htmlFor={`${formId}-p`} className="text-base font-bold">
            {jobs ? t("easy.quick.q_profession_jobs") : t("easy.quick.q_profession_workers")}
          </label>
          <Input
            id={`${formId}-p`}
            value={profession}
            onChange={(e) => setProfession(e.target.value.slice(0, 120))}
            placeholder={t("easy.quick.profession_placeholder")}
            enterKeyHint="search"
            data-quick-profession
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor={`${formId}-r`} className="text-base font-bold">
            {jobs ? t("easy.quick.q_place_jobs") : t("easy.quick.q_place_workers")}
          </label>
          <Select id={`${formId}-r`} value={place} onChange={(e) => setPlace(e.target.value)} options={places} data-quick-place />
        </div>
        {/* matndan tushunilgan shartlar ("kunlik", "tajribasiz"…) — kerak bo'lmasa olib tashlanadi */}
        {filters.pay || filters.noexp || filters.exp || filters.schedule ? (
          <div className="flex flex-wrap gap-2" data-quick-filters>
            {filters.pay ? <FilterChip onRemove={() => setFilters({ ...filters, pay: null })}>{t("easy.search.daily_jobs")}</FilterChip> : null}
            {filters.schedule ? <FilterChip onRemove={() => setFilters({ ...filters, schedule: null })}>{tEnum("work_schedule", filters.schedule)}</FilterChip> : null}
            {filters.noexp ? <FilterChip onRemove={() => setFilters({ ...filters, noexp: false })}>{t("easy.search.no_experience")}</FilterChip> : null}
            {filters.exp ? <FilterChip onRemove={() => setFilters({ ...filters, exp: false })}>{t("easy.search.experienced")}</FilterChip> : null}
          </div>
        ) : null}
        {/* kunlik haqli ishda oylik maosh so'ralmaydi */}
        {jobs && !filters.pay ? (
          <fieldset className="space-y-2">
            <legend className="text-base font-bold">{t("easy.quick.q_salary")}</legend>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("easy.quick.q_salary")} data-quick-salary>
              <button type="button" role="radio" aria-checked={salary === null} onClick={() => setSalary(null)} className={chip(salary === null)}>
                {t("easy.quick.salary_any")}
              </button>
              {salaries.map((s) => (
                <button key={s} type="button" role="radio" aria-checked={salary === s} onClick={() => setSalary(s)} className={chip(salary === s)} data-salary={s}>
                  {t("easy.quick.salary_from", { amount: formatMoneyShort(s, locale) })}
                </button>
              ))}
            </div>
          </fieldset>
        ) : null}
      </form>
    </Sheet>
  );
}

/** Suhbat oqimi: salomlashuv va misollar (bo'sh bo'lsa) yoki xabarlar; yangi xabar ko'rinadigan joyga suriladi */
export function AiThread({ chat, examples, scrollOnRestore = true, bar: showBar = true }: { chat: AiChatState; examples: string[]; scrollOnRestore?: boolean; /** yuqori qator ("Yangi suhbat") — /ai sahifasida sarlavhada bor */ bar?: boolean }) {
  const { t } = useT();
  const lastRef = useRef<HTMLLIElement>(null);
  const last = chat.turns.at(-1);
  const lastKey = last ? `${last.id}:${last.status}` : "";
  // sahifada (/ai) qurilmadan tiklangan suhbat uchun ekran o'zi surilmaydi — sarlavha ko'rinib tursin
  const skip = !scrollOnRestore && !!last && last.id === chat.restoredId;

  useEffect(() => {
    if (lastKey && !skip) lastRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [lastKey, skip]);

  const bar =
    showBar && chat.turns.length ? (
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={chat.clear}
          disabled={chat.pending}
          className="press -my-2 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          <RotateCcw className="size-4" aria-hidden /> {t("easy.finder.new_chat")}
        </button>
      </div>
    ) : null;

  if (!chat.turns.length) {
    return (
      <div className="ai-bubble-in space-y-3">
        {bar}
        <AssistantHead />
        <Bubble>{chat.mode === "workers" ? t("easy.finder.greeting_workers") : t("easy.finder.greeting_jobs")}</Bubble>
        {examples.length ? (
          <>
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
          </>
        ) : null}
        <QuickSheet chat={chat} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {bar}
      <ol className="space-y-5" aria-live="polite" aria-busy={chat.pending}>
        {chat.turns.map((turn) => (
          <li key={turn.id} ref={turn.id === last?.id ? lastRef : undefined} className="scroll-mt-16 space-y-4">
            <div className="ai-bubble-in flex justify-end">
              <p data-ai-you className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-base text-primary-foreground [overflow-wrap:anywhere]">
                <span className="sr-only">{t("easy.finder.you")}: </span>
                {turn.display}
              </p>
            </div>
            {turn.status === "error" ? (
              <div className="ai-bubble-in space-y-2">
                <AssistantHead />
                <Bubble className="space-y-2 bg-destructive-soft text-destructive">
                  <p role="alert">{turn.error}</p>
                  <Button type="button" variant="outline" className="h-11 bg-card text-base" disabled={chat.pending} onClick={() => chat.retry(turn)}>
                    <RotateCcw className="size-4" aria-hidden /> {t("easy.search.retry")}
                  </Button>
                </Bubble>
              </div>
            ) : (
              <QuickAnswer turn={turn} latest={turn.id === last?.id} chat={chat} />
            )}
          </li>
        ))}
      </ol>
      <QuickSheet chat={chat} />
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
  const ownRef = useRef<HTMLTextAreaElement>(null);
  const ref = inputRef ?? ownRef;
  // sahifa skriptlari yuklandi (testlar va sekin telefon: shundan keyin yozish maydoni ishlaydi)
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);

  // maydon matn bilan birga 4 qatorgacha o'sadi
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }, [text, ref]);

  const send = (value = text) => {
    if (chat.ask(value)) setText("");
    else if (!value.trim()) ref.current?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    }
  };

  const round = "press relative flex size-12 shrink-0 items-center justify-center rounded-xl";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
      className="space-y-1.5"
      data-state={chat.pending ? "processing" : "idle"}
      data-hydrated={hydrated ? "" : undefined}
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
          onChange={(e) => setText(e.target.value.slice(0, MESSAGE_MAX_CHARS))}
          onKeyDown={onKeyDown}
          maxLength={MESSAGE_MAX_CHARS}
          enterKeyHint="send"
          placeholder={chat.mode === "workers" ? t("easy.finder.composer_placeholder_workers") : t("easy.finder.composer_placeholder_jobs")}
          // fokus halqasi butun yozish qutisida (focus-within) — ichidagi maydonda ikkinchi halqa chizilmaydi
          className="min-h-12 min-w-0 flex-1 resize-none overflow-hidden bg-transparent px-2.5 py-3 text-base leading-6 text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
        />
        {/* har holatning o'z tugmasi (key): "To'xtatish" bosilganda o'sha tugma "Yuborish"ga aylanib qolmasin */}
        {chat.pending ? (
          <button key="stop" type="button" onClick={chat.stop} aria-label={t("easy.finder.stop_answer")} className={cn(round, "border border-border bg-card text-foreground hover:bg-secondary")}>
            <Square className="size-4 fill-current" aria-hidden />
          </button>
        ) : (
          <button key="send" type="submit" aria-label={t("easy.finder.submit")} className={cn(round, "bg-primary text-primary-foreground hover:bg-primary-hover")}>
            <ArrowUp className="size-5" aria-hidden />
          </button>
        )}
      </div>
      <p className="min-h-5 px-1 text-xs text-muted-foreground">{t("easy.finder.disclaimer")}</p>
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

const noopSubscribe = () => () => {};
