"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/client";
import { MESSAGE_MAX_CHARS } from "@/features/assistant/types";
import { quickPrepare, quickSearch } from "@/features/find/quick-actions";
import { rememberPlace } from "@/features/find/place-actions";
import { detectIntent, detectPostIntent, postTopic } from "@/features/find/intent";
import { quickPostPrepare, quickPostPreview, quickPostPublish } from "@/features/find/quick-post-actions";
import type { PostAnswers, PostChoice, PostExperience } from "@/features/find/quick-post-types";
import { chooseMode } from "@/features/mode/actions";
import type { AppMode } from "@/features/mode/mode";
import { NO_FILTERS, type QuickOption } from "@/features/find/quick-types";
import { draftFromForm, nextAsk, placeChoices, roleOfMode, shownWord, type AiPart, type Ask, type Draft, type Msg, type Role } from "./guided-logic";
import { isPostAsk, matchRegion, nextPostAsk, parseExperience, parseName, parsePhone, postAnswers, postDraftFromForm, type PostAsk, type PostDraft } from "./post-logic";

export type { AiPart, Ask, Draft, Msg, Role } from "./guided-logic";

/**
 * Asosiy ekrandagi chat (ega, 2026-11-21, master prompt): foydalanuvchi oddiy so'z bilan yozadi, AI maqsadini o'zi
 * aniqlaydi (ish qidiryaptimi yoki ishchi kerakmi), yetishmagan narsani BITTADAN, muloyim va aniq so'raydi (rol — ikki
 * tugma, kasb — yoziladi, hudud — tugmalardan tanlanadi, yozilmaydi), keyin bazadagi HAQIQIY e'lonlarni shu chatda kartalar
 * bilan ko'rsatadi. Bir marta aytilgani qayta so'ralmaydi: rol — rejimdan yoki shu suhbatdan, hudud — matndan yoki shu
 * qurilmada eslab qolinganidan. Suhbat shu tabda (30 daqiqa) saqlanadi — e'lonni ochib qaytganda joyida turadi.
 */

const STORE = "ib_guided_chat";
/** mehmon "Joylash"ni bosib kirishga ketdi: javoblar shu qurilmada (30 daqiqa), kirgach /chat?post=1 da karta qaytadi */
export const POST_HANDOFF = "ib_chat_post";
const TTL = 30 * 60 * 1000;
const KEEP = 40;

interface Stored {
  at: number;
  /** kimning suhbati (foydalanuvchi id yoki "guest"): hisob almashsa — boshqa odamning suhbati ko'rinmaydi */
  owner: string;
  role: Role | null;
  msgs: Msg[];
  draft: Draft | null;
  awaiting: Ask | PostAsk | null;
  /** chatda yig'ilayotgan e'lon (3-bosqich) */
  post: PostDraft | null;
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
  const [awaiting, setAwaiting] = useState<Ask | PostAsk | null>(null);
  const [post, setPost] = useState<PostDraft | null>(null);
  const router = useRouter();
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
      setPost(s.post ?? null);
      if (s.role) setRole(s.role);
    } else seq.current = Date.now();
    setReady(true);
  }, [owner]);

  useEffect(() => {
    if (ready && !pending) save({ owner, role, msgs, draft, awaiting, post });
  }, [ready, pending, owner, role, msgs, draft, awaiting, post]);

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
  const markAnswered = () =>
    setMsgs((cur) => cur.map((m) => ((m.ai?.kind === "ask" || m.ai?.kind === "post-ask" || m.ai?.kind === "post-preview" || m.ai?.kind === "post") && !m.answered ? { ...m, answered: true } : m)));

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
    setPost(null);
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
          // ishchi e'loni — shu chatning o'zida, bittadan savol bilan (3-bosqich); mazmun (kasb, joy) darhol hisobga olinadi
          if (who === "worker") return startPost(postTopic(q), mid, run);
          // vakansiya — yordamchi bilan alohida ekran; kimligi noma'lum — bitta savol (tugmalar)
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

  // ---------------------------------------------------------------------------------------------------------------
  // Chatda ishchi e'loni (3-bosqich): kasb → viloyat → ism → tajriba → telefon → karta va "Joylash"
  // ---------------------------------------------------------------------------------------------------------------

  /** Keyingi savol (bittadan) yoki tayyor karta */
  const postNext = (d: PostDraft, mid: number, extra: Partial<Extract<AiPart, { kind: "post-ask" }>> = {}) => {
    setPost(d);
    const a = nextPostAsk(d);
    if (!a) return postPreview(d, mid);
    setAwaiting(a);
    replace(mid, { kind: "post-ask", ask: a, ...(a === "post_region" ? { options: d.regions } : {}), ...extra });
  };

  /** Shu savol qayta (javob tushunilmadi) */
  const postRetry = (a: PostAsk, mid: number, extra: Partial<Extract<AiPart, { kind: "post-ask" }>> = {}) => {
    setAwaiting(a);
    replace(mid, { kind: "post-ask", ask: a, retry: true, ...(a === "post_region" ? { options: post?.regions ?? [] } : {}), ...extra });
  };

  const postPreview = (d: PostDraft, mid: number) => {
    const answers = postAnswers(d);
    setAwaiting(null);
    if (!answers) return replace(mid, { kind: "error", message: errorText("generic") });
    const run = ++runRef.current;
    quickPostPreview(answers).then(
      (res) => {
        if (runRef.current !== run) return;
        if (!res.ok || !res.data) return replace(mid, { kind: "error", message: errorText(res.ok ? "generic" : res.error) });
        replace(mid, { kind: "post-preview", preview: res.data });
      },
      () => runRef.current === run && replace(mid, { kind: "error", message: errorText("network") }),
    );
  };

  /** "O'zim haqimda e'lon bermoqchiman": aytilgan mazmun bilan boshlanadi ("men oshpazman" — kasb so'ralmaydi) */
  const startPost = (topic: string, mid: number, run = ++runRef.current) => {
    setDraft(null);
    const fail = () => runRef.current === run && replace(mid, { kind: "error", message: errorText("network") });
    quickPostPrepare({ text: topic }).then(async (res) => {
      if (runRef.current !== run) return;
      if (!res.ok) return replace(mid, { kind: "error", message: errorText(res.error) });
      const u = res.data;
      if (u.kind === "reply") {
        // mazmun tushunilmadi ("…qwerty…") — bo'sh e'lon bilan, kasb so'raladi
        const base = await quickPostPrepare({ text: "" }).catch(() => null);
        if (runRef.current !== run) return;
        if (!base?.ok || base.data.kind === "reply") return fail();
        return postNext(postDraftFromForm(base.data.form), mid, { intro: true, ...(topic ? { word: shownWord(topic, topic) } : {}) });
      }
      const d = postDraftFromForm(u.form);
      if (u.kind === "options") {
        setPost(d);
        setAwaiting("post_which");
        return replace(mid, { kind: "post-ask", ask: "post_which", intro: true, question: u.question, groups: u.groups });
      }
      postNext(d, mid, { intro: true });
    }, fail);
  };

  /** Kim uchun noma'lum edi — "O'zim haqimda" tugmasi */
  const beginPost = (topic: string, label: string) => {
    if (pending) return;
    markAnswered();
    const mid = id();
    push(label, mid);
    startPost(topic, mid);
  };

  /** "Qanday ish qilasiz?" — yozilgan kasb tushuniladi (guruh bo'lsa — "aynan qaysi biri?" tugmalari) */
  const answerPostProfession = (q: string, d: PostDraft, mid: number) => {
    const run = ++runRef.current;
    quickPostPrepare({ text: q }).then(
      (res) => {
        if (runRef.current !== run) return;
        if (!res.ok) return replace(mid, { kind: "error", message: errorText(res.error) });
        const u = res.data;
        if (u.kind === "options") {
          setPost(d);
          setAwaiting("post_which");
          return replace(mid, { kind: "post-ask", ask: "post_which", question: u.question, groups: u.groups });
        }
        if (u.kind === "reply" || !u.form.profession) return postRetry("post_profession", mid, { word: shownWord(q, q) });
        // gapda viloyat ham aytilgan bo'lsa ("Samarqandda oshpazman") — u ham olinadi
        const place = d.regionId ? {} : { regionId: u.form.regionId, districtId: u.form.districtId };
        postNext({ ...d, profession: u.form.profession, ...place }, mid);
      },
      () => runRef.current === run && replace(mid, { kind: "error", message: errorText("network") }),
    );
  };

  /** Yozish maydonidan kelgan javob — kutilayotgan savolga */
  const answerPost = (q: string, a: PostAsk, d: PostDraft) => {
    // yangi e'lon niyati ("vakansiya joylamoqchiman") yoki kasbdan keyingi savollarda yangi maqsad ("menga haydovchi kerak") —
    // bu e'lon to'xtaydi, oddiy so'rov
    if (detectPostIntent(q) || (a !== "post_profession" && a !== "post_which" && detectIntent(q) && q.split(" ").length >= 3)) return newQuery(q);
    const mid = id();
    markAnswered();
    setAwaiting(null);
    push(q, mid);
    if (a === "post_profession" || a === "post_which") return answerPostProfession(q, d, mid);
    if (a === "post_region") {
      const hit = matchRegion(q, d.regions);
      return hit ? postNext({ ...d, regionId: hit.value, districtId: null }, mid) : postRetry("post_region", mid);
    }
    if (a === "post_name") {
      const n = parseName(q);
      return n ? postNext({ ...d, firstName: n.first, lastName: n.last }, mid) : postRetry("post_name", mid);
    }
    if (a === "post_experience") {
      const x = parseExperience(q);
      return x ? postNext({ ...d, experience: x }, mid) : postRetry("post_experience", mid);
    }
    const phone = parsePhone(q);
    return phone ? postNext({ ...d, phone }, mid) : postRetry("post_phone", mid);
  };

  /** Tugma bilan javob: "aynan qaysi biri", viloyat, tajriba */
  const pickPost = (patch: Partial<PostDraft>, label: string) => {
    if (pending || !post) return;
    markAnswered();
    const mid = id();
    push(label, mid);
    postNext({ ...post, ...patch }, mid);
  };
  const pickPostChoice = (choice: PostChoice) => pickPost({ profession: choice }, choice.name);
  const pickPostRegion = (opt: QuickOption) => pickPost({ regionId: opt.value, districtId: null }, opt.label);
  const pickPostExperience = (x: PostExperience, label: string) => pickPost({ experience: x }, label);

  /** "Joylash": mehmon — bir marta kirib qaytadi (javoblar shu qurilmada saqlanadi); kirgan — joylanadi va tekshiriladi */
  const publishPost = (answers: PostAnswers, loggedIn: boolean) => {
    if (pending) return;
    if (!loggedIn) {
      try {
        localStorage.setItem(POST_HANDOFF, JSON.stringify({ at: Date.now(), answers }));
      } catch {
        // xotira yopiq — kirgandan keyin savollarga qaytadan javob beriladi
      }
      router.push(`/auth?${new URLSearchParams({ next: "/chat?post=1", phone: answers.phone }).toString()}`);
      return;
    }
    markAnswered();
    const mid = id();
    const publishing: AiPart = { kind: "thinking", text: t("easy.guided.post_publishing") };
    setMsgs((cur) => [...cur, { id: mid, ai: publishing }].slice(-KEEP));
    const run = ++runRef.current;
    quickPostPublish(answers).then(
      (res) => {
        if (runRef.current !== run) return;
        if (!res.ok || !res.data) {
          // e'londagi raqam tekshiruvdan o'tmadi — raqam qayta so'raladi
          if (!res.ok && res.error === "phone_required" && post) return postRetry("post_phone", mid);
          return replace(mid, { kind: "error", message: errorText(res.ok ? "generic" : res.error) });
        }
        setPost(null);
        replace(mid, { kind: "post-done", outcome: res.data });
        router.refresh();
      },
      () => runRef.current === run && replace(mid, { kind: "error", message: errorText("network") }),
    );
  };

  /** Mehmon kirib qaytdi (/chat?post=1): o'sha javoblar bilan tayyor karta — endi "Joylash" darhol joylaydi */
  const resumePost = () => {
    let answers: PostAnswers | null = null;
    try {
      const raw = localStorage.getItem(POST_HANDOFF);
      localStorage.removeItem(POST_HANDOFF);
      const v = raw ? (JSON.parse(raw) as { at?: number; answers?: PostAnswers }) : null;
      if (v?.answers && typeof v.at === "number" && Date.now() - v.at < TTL) answers = v.answers;
    } catch {
      answers = null;
    }
    if (!answers) return;
    const mid = id();
    setMsgs((cur) => [...cur, { id: mid, ai: THINKING }].slice(-KEEP));
    const run = ++runRef.current;
    quickPostPreview(answers).then(
      (res) => {
        if (runRef.current !== run) return;
        if (!res.ok || !res.data) return replace(mid, { kind: "error", message: errorText(res.ok ? "generic" : res.error) });
        replace(mid, { kind: "post-preview", preview: res.data });
      },
      () => runRef.current === run && replace(mid, { kind: "error", message: errorText("network") }),
    );
  };

  /** Yozish maydonidan */
  const ask = (text: string) => {
    const q = text.replace(/\s+/g, " ").trim().slice(0, MESSAGE_MAX_CHARS);
    if (!q || pending) return false;
    if (awaiting === "profession" && draft) answerProfession(q, draft);
    else if (isPostAsk(awaiting) && post) answerPost(q, awaiting, post);
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
    setPost(null);
  };

  return {
    msgs,
    pending,
    ready,
    role,
    awaiting,
    ask,
    stop,
    clear,
    pickRole,
    pickPlace,
    otherPlace,
    beginPost,
    pickPostChoice,
    pickPostRegion,
    pickPostExperience,
    publishPost,
    resumePost,
    mode: role ?? "jobs",
  };
}

export type GuidedChat = ReturnType<typeof useGuidedChat>;
