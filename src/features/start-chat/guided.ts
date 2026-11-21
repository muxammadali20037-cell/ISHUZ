"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n/client";
import { MESSAGE_MAX_CHARS } from "@/features/assistant/types";
import { quickPrepare, quickSearch } from "@/features/find/quick-actions";
import { rememberPlace } from "@/features/find/place-actions";
import { postTopic } from "@/features/find/intent";
import { chooseMode } from "@/features/mode/actions";
import type { AppMode } from "@/features/mode/mode";
import { NO_FILTERS, type QuickOption } from "@/features/find/quick-types";
import { draftFromForm, nextAsk, placeChoices, roleOfMode, shownWord, type AiPart, type Ask, type Draft, type Msg, type Role } from "./guided-logic";

export type { AiPart, Ask, Draft, Msg, Role } from "./guided-logic";

/**
 * Asosiy ekrandagi chat (ega, 2026-11-21, master prompt): foydalanuvchi oddiy so'z bilan yozadi, AI maqsadini o'zi
 * aniqlaydi (ish qidiryaptimi yoki ishchi kerakmi), yetishmagan narsani BITTADAN, muloyim va aniq so'raydi (rol — ikki
 * tugma, kasb — yoziladi, hudud — tugmalardan tanlanadi, yozilmaydi), keyin bazadagi HAQIQIY e'lonlarni shu chatda kartalar
 * bilan ko'rsatadi. Bir marta aytilgani qayta so'ralmaydi: rol — rejimdan yoki shu suhbatdan, hudud — matndan yoki shu
 * qurilmada eslab qolinganidan. Suhbat shu tabda (30 daqiqa) saqlanadi — e'lonni ochib qaytganda joyida turadi.
 */

const STORE = "ib_guided_chat";
const TTL = 30 * 60 * 1000;
const KEEP = 40;

interface Stored {
  at: number;
  /** kimning suhbati (foydalanuvchi id yoki "guest"): hisob almashsa — boshqa odamning suhbati ko'rinmaydi */
  owner: string;
  role: Role | null;
  msgs: Msg[];
  draft: Draft | null;
  awaiting: Ask | null;
}

function load(owner: string): Stored | null {
  try {
    const raw = sessionStorage.getItem(STORE);
    if (!raw) return null;
    const s = JSON.parse(raw) as Stored;
    if (!s || typeof s.at !== "number" || Date.now() - s.at > TTL || !Array.isArray(s.msgs)) return null;
    if (s.owner !== owner) {
      sessionStorage.removeItem(STORE);
      return null;
    }
    // tugamagan (kutilayotgan) javoblar tiklanmaydi
    return { ...s, msgs: s.msgs.filter((m) => m.ai?.kind !== "thinking" && m.ai?.kind !== "searching").slice(-KEEP) };
  } catch {
    return null;
  }
}

function save(s: Omit<Stored, "at">) {
  try {
    if (!s.msgs.length) sessionStorage.removeItem(STORE);
    else sessionStorage.setItem(STORE, JSON.stringify({ ...s, msgs: s.msgs.slice(-KEEP), at: Date.now() }));
  } catch {
    // maxfiy rejim yoki to'lgan xotira — suhbat faqat shu ekranda qoladi
  }
}

/** `owner` — kirgan foydalanuvchi id'si yoki "guest" (suhbat faqat o'sha odamga tiklanadi) */
export function useGuidedChat(appMode: AppMode | null, owner: string) {
  const { t } = useT();
  const known = roleOfMode(appMode);
  const [role, setRole] = useState<Role | null>(known);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [awaiting, setAwaiting] = useState<Ask | null>(null);
  const [ready, setReady] = useState(false);
  const seq = useRef(0);
  /** har so'rov raqami: "To'xtatish" yoki yangi so'rovdan keyin kelgan eski javob e'tiborga olinmaydi */
  const runRef = useRef(0);
  /** rejim faqat bir marta yoziladi (mehmon rolni tanlaganda yoki AI aniqlaganda) */
  const modeSaved = useRef(appMode !== null);
  const pending = msgs.some((m) => m.ai?.kind === "thinking" || m.ai?.kind === "searching");

  useEffect(() => {
    const s = load(owner);
    if (s) {
      seq.current = Math.max(Date.now(), ...s.msgs.map((m) => m.id));
      // eslint-disable-next-line react-hooks/set-state-in-effect -- tashqi xotiradan bir martalik tiklash
      setMsgs(s.msgs);
      setDraft(s.draft);
      setAwaiting(s.awaiting);
      if (s.role) setRole(s.role);
    } else seq.current = Date.now();
    setReady(true);
  }, [owner]);

  useEffect(() => {
    if (ready && !pending) save({ owner, role, msgs, draft, awaiting });
  }, [ready, pending, owner, role, msgs, draft, awaiting]);

  useEffect(() => () => void (runRef.current += 1), []);

  const errorText = (code: string) => {
    for (const key of [`easy.finder.errors.${code}`, `common.errors.${code}`]) {
      const v = t(key);
      if (v !== key) return v;
    }
    return t("common.errors.generic");
  };

  const id = () => ++seq.current;
  const THINKING: AiPart = { kind: "thinking" };
  /** foydalanuvchi bubble'i (bo'lsa) va yordamchining "o'ylayapman" javobi */
  const push = (you: string | null, mid: number) =>
    setMsgs((cur) => [...cur, ...(you !== null ? [{ id: id(), you }] : []), { id: mid, ai: THINKING }].slice(-KEEP));
  const replace = (mid: number, ai: AiPart) => setMsgs((cur) => cur.map((m) => (m.id === mid ? { ...m, ai } : m)));
  const markAnswered = () => setMsgs((cur) => cur.map((m) => (m.ai?.kind === "ask" && !m.answered ? { ...m, answered: true } : m)));

  /** mehmon (rejimi yo'q) — aniqlangan rol rejim sifatida yoziladi (e'lon berish, "E'lonlarim" shunga qarab) */
  const persistRole = (r: Role) => {
    if (modeSaved.current) return;
    modeSaved.current = true;
    void chooseMode(r === "workers" ? "employer" : "worker").catch(() => null);
  };

  const search = (d: Draft, r: Role, mid: number) => {
    const run = ++runRef.current;
    replace(mid, { kind: "searching", mode: r });
    const filters = d.formMode === r ? d.filters : NO_FILTERS;
    quickSearch({ mode: r, answers: { profession: d.profession.replace(/\s+/g, " ").trim().slice(0, 120), nodeId: d.nodeId, place: d.place, salary: null, filters } }).then(
      (res) => {
        if (runRef.current !== run) return;
        if (!res.ok) return replace(mid, { kind: "error", message: errorText(res.error) });
        replace(mid, { kind: "results", mode: r, result: res.data, query: d.text, draft: d });
        setDraft(null);
        setAwaiting(null);
      },
      () => runRef.current === run && replace(mid, { kind: "error", message: errorText("network") }),
    );
  };

  /** Yetishmagan narsani so'raydi yoki qidiradi. `mid` — yordamchining shu javob o'rni */
  const proceed = (d: Draft, r: Role | null, mid: number) => {
    const a = nextAsk(d, r);
    if (!a) return search(d, r!, mid);
    let next = d;
    if (a === "profession") next = { ...d, askedProfession: true };
    setDraft(next);
    setAwaiting(a);
    replace(mid, {
      kind: "ask",
      ask: a,
      mode: r,
      word: a === "profession" && !d.nodeId && d.profession.trim() ? shownWord(d.profession, d.text) : undefined,
      profession: a === "role" ? d.profession.trim() || undefined : undefined,
      options: a === "place" && r ? placeChoices(d.places, r) : undefined,
    });
  };

  const prepare = (text: string, mode: Role) => quickPrepare({ text, mode });

  const newQuery = (q: string) => {
    const mid = id();
    markAnswered();
    setAwaiting(null);
    setDraft(null);
    push(q, mid);
    const run = ++runRef.current;
    prepare(q, role ?? "jobs").then(
      (res) => {
        if (runRef.current !== run) return;
        if (!res.ok) return replace(mid, { kind: "error", message: errorText(res.error) });
        const form = res.data;
        if (form.reply) return replace(mid, { kind: "reply", text: form.reply });
        if (form.post) {
          const who = form.post.who ?? (role === "workers" ? "employer" : role === "jobs" ? "worker" : null);
          // e'lon yordamchisiga faqat mazmun (kasb, joy) o'tadi — "vakansiya joylamoqchiman" gapining o'zi emas
          return replace(mid, { kind: "post", who, query: postTopic(q) });
        }
        const r = form.intent ?? role;
        if (form.intent) {
          setRole(form.intent);
          persistRole(form.intent);
        }
        proceed(draftFromForm(form), r, mid);
      },
      () => runRef.current === run && replace(mid, { kind: "error", message: errorText("network") }),
    );
  };

  /** "Qanday ish?" savoliga yozilgan javob: kasb qayta tushuniladi, avvalgi hudud saqlanadi */
  const answerProfession = (q: string, d: Draft) => {
    const mid = id();
    markAnswered();
    setAwaiting(null);
    push(q, mid);
    const r = role ?? "jobs";
    const run = ++runRef.current;
    prepare(q, r).then(
      (res) => {
        if (runRef.current !== run) return;
        if (!res.ok) return replace(mid, { kind: "error", message: errorText(res.error) });
        const f = res.data;
        // "salom", "rahmat" — qisqa javob, kasb savoli o'z joyida kutadi
        if (f.reply) {
          replace(mid, { kind: "reply", text: f.reply });
          setAwaiting("profession");
          return;
        }
        const merged: Draft = {
          ...d,
          // e'lon berishga o'tilsa — shu javob (kasb) bilan
          text: q,
          profession: f.profession || q,
          nodeId: f.nodeId,
          ...(f.placeKnown && !d.placeKnown ? { place: f.place, placeKnown: true } : {}),
          places: f.places.length ? f.places : d.places,
        };
        // javobda maqsad ham aytilgan bo'lsa ("menga haydovchi kerak") — shunga o'tiladi
        const r2 = f.intent ?? role;
        if (f.intent && f.intent !== role) setRole(f.intent);
        proceed(merged, r2, mid);
      },
      () => runRef.current === run && replace(mid, { kind: "error", message: errorText("network") }),
    );
  };

  /** Yozish maydonidan */
  const ask = (text: string) => {
    const q = text.replace(/\s+/g, " ").trim().slice(0, MESSAGE_MAX_CHARS);
    if (!q || pending) return false;
    if (awaiting === "profession" && draft) answerProfession(q, draft);
    else newQuery(q);
    return true;
  };

  /** "Men ish qidiryapman" / "Menga ishchi kerak" */
  const pickRole = (r: Role, label: string) => {
    if (pending || !draft) return;
    markAnswered();
    setRole(r);
    persistRole(r);
    const mid = id();
    push(label, mid);
    proceed(draft, r, mid);
  };

  /** Hudud tugmasi: tanlov shu qurilmada eslab qolinadi (keyingi safar so'ralmaydi) */
  const pickPlace = (opt: QuickOption) => {
    if (pending || !draft || !role) return;
    markAnswered();
    const d = { ...draft, place: opt.value, placeKnown: true };
    if (opt.value !== "all" && opt.value !== "remote") void rememberPlace({ region: opt.value, district: "all" }).catch(() => null);
    const mid = id();
    push(opt.label, mid);
    proceed(d, role, mid);
  };

  /** Topilmadi → "Boshqa viloyatda qidirish": o'sha so'rov, hudud qayta so'raladi */
  const otherPlace = (d: Draft, r: Role) => {
    if (pending) return;
    markAnswered();
    const mid = id();
    push(null, mid);
    proceed({ ...d, placeKnown: false }, r, mid);
  };

  const stop = () => {
    runRef.current += 1;
    setMsgs((cur) => cur.map((m) => (m.ai?.kind === "thinking" || m.ai?.kind === "searching" ? { ...m, ai: { kind: "reply", text: t("easy.finder.stopped") } } : m)));
  };

  const clear = () => {
    if (pending) return;
    setMsgs([]);
    setDraft(null);
    setAwaiting(null);
  };

  return { msgs, pending, ready, role, awaiting, ask, stop, clear, pickRole, pickPlace, otherPlace, mode: role ?? "jobs" };
}

export type GuidedChat = ReturnType<typeof useGuidedChat>;
