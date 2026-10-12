"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AUTH_HANDOFF_EVENT } from "@/components/shared/login-link";
import {
  LAST_USER_KEY,
  claimGuestDraft,
  draftKey,
  guestId,
  ownerOf,
  readEnvelope,
  sanitizeDraft,
  writeEnvelope,
  type DraftEntity,
  type DraftRules,
} from "./draft-store";

/**
 * Qoralama shu qurilmada (localStorage) saqlanadi: sahifa yangilansa, orqaga qaytilsa yoki hisobga kirib qaytilsa
 * javoblar yo'qolmaydi. Brauzer xotirasi yopiq bo'lsa ham forma ishlayveradi (faqat eslab qolinmaydi).
 * `ready` bo'lguncha komponent skeleton ko'rsatadi — server va brauzer chizgani bir xil bo'lishi uchun.
 *
 * Xavfsizlik (draft-store.ts): qoralama egasi (hisob yoki mehmon) bo'yicha ajratiladi, muddati va tuzilmasi
 * tekshiriladi; boshqa tabda chiqish/hisob almashsa — bu tabdagi qoralama ham tozalanadi.
 * `restored` — qurilmadagi saqlanmagan o'zgarishlar tiklandi (server ma'lumoti bilan to'qnashsa forma tanlov beradi).
 */
export function useDraft<T extends { v: number; step: number }>({
  entity,
  editId = null,
  userId,
  makeInitial,
  rules,
  compareIgnore = ["step"],
}: {
  entity: DraftEntity;
  editId?: string | null;
  userId: string | null;
  makeInitial: () => T;
  rules: DraftRules<T>;
  /** "o'zgarish bormi" solishtirishda e'tiborga olinmaydigan maydonlar */
  compareIgnore?: (keyof T)[];
}) {
  const [draft, setDraft] = useState<T>(makeInitial);
  const [ready, setReady] = useState(false);
  const [restored, setRestored] = useState(false);
  const initial = useRef(makeInitial);
  const rulesRef = useRef(rules);
  const ignoreRef = useRef(compareIgnore);
  const keyRef = useRef<string | null>(null);
  const ownerRef = useRef<string | null>(null);
  // faqat foydalanuvchi o'zgartirganidan keyin yoziladi: tozalangan qoralama avtomatik "tirilmaydi"
  const dirty = useRef(false);
  // mehmon "kirish"ga ketgan vaqt: keyingi avtosaqlash ham shu belgini saqlaydi (aks holda o'tkazish yo'qolardi)
  const handoffAt = useRef<number | undefined>(undefined);

  useEffect(() => {
    const id = window.setTimeout(() => {
      try {
        const s = window.localStorage;
        const now = Date.now();
        const gOwner = ownerOf(null, guestId(s));
        const owner = userId ? ownerOf(userId, "") : gOwner;
        const key = draftKey(entity, editId, owner);
        keyRef.current = key;
        ownerRef.current = owner;
        let env = readEnvelope(s, key, now);
        if (!env && userId && !editId) env = claimGuestDraft(s, entity, gOwner, owner, now);
        if (env) {
          const base = initial.current();
          const saved = sanitizeDraft(env.data, base, rulesRef.current);
          if (saved) {
            setDraft(saved);
            setRestored(draftDiffers(saved, base, ignoreRef.current));
          } else {
            s.removeItem(key);
          }
        }
      } catch {
        // xotira yopiq — yangi qoralama bilan davom etamiz (hech narsa saqlanmaydi)
        keyRef.current = null;
      }
      setReady(true);
    }, 0);
    return () => window.clearTimeout(id);
  }, [entity, editId, userId]);

  useEffect(() => {
    if (!ready || !dirty.current || !keyRef.current || !ownerRef.current) return;
    try {
      writeEnvelope(window.localStorage, keyRef.current, {
        schema: 2,
        owner: ownerRef.current,
        updatedAt: Date.now(),
        handoffAt: handoffAt.current,
        data: draft as unknown as Record<string, unknown>,
      });
    } catch {
      // xotira to'la/yopiq — forma ishlashda davom etadi
    }
  }, [draft, ready]);

  // boshqa tabda chiqish yoki hisob almashishi: bu tabdagi shaxsiy qoralama ham tozalanadi
  useEffect(() => {
    if (!userId) return;
    const onStorage = (e: StorageEvent) => {
      if (e.key !== null && e.key !== LAST_USER_KEY) return;
      if (e.key === LAST_USER_KEY && e.newValue === userId) return;
      dirty.current = false;
      setDraft(initial.current());
      setRestored(false);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [userId]);

  const update = useCallback((patch: Partial<T> | ((d: T) => Partial<T>)) => {
    dirty.current = true;
    setDraft((d) => ({ ...d, ...(typeof patch === "function" ? patch(d) : patch) }));
  }, []);

  /** Qoralamani o'chirish (muvaffaqiyatli yuborilgandan keyin): keyingi o'zgarishgacha qayta yozilmaydi */
  const clear = useCallback(() => {
    dirty.current = false;
    handoffAt.current = undefined;
    setRestored(false);
    try {
      if (keyRef.current) window.localStorage.removeItem(keyRef.current);
    } catch {
      // ahamiyatsiz
    }
  }, []);

  const reset = useCallback(() => {
    clear();
    setDraft(initial.current());
  }, [clear]);

  /** Mehmon "joylash" bosib kirishga ketyapti: shu qoralama kirgandan keyin aynan shu hisobga o'tkaziladi */
  const prepareAuthHandoff = useCallback(
    (patch?: Partial<T>) => {
      const next = { ...draft, ...patch };
      if (patch) setDraft(next);
      if (userId || !keyRef.current || !ownerRef.current) return;
      try {
        const now = Date.now();
        handoffAt.current = now;
        dirty.current = true;
        writeEnvelope(window.localStorage, keyRef.current, { schema: 2, owner: ownerRef.current, updatedAt: now, handoffAt: now, data: next as unknown as Record<string, unknown> });
      } catch {
        // xotira yopiq — kirgandan keyin forma yangidan to'ldiriladi
      }
    },
    [draft, userId],
  );

  // sarlavhadagi "Kirish" bosilsa ham (formaning o'z tugmasidan tashqari) — javoblar kirgan hisobga o'tadi
  useEffect(() => {
    const onLogin = () => prepareAuthHandoff();
    window.addEventListener(AUTH_HANDOFF_EVENT, onLogin);
    return () => window.removeEventListener(AUTH_HANDOFF_EVENT, onLogin);
  }, [prepareAuthHandoff]);

  return { draft, update, ready, clear, reset, restored, dismissRestored: () => setRestored(false), prepareAuthHandoff };
}

function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o)
      .filter((k) => o[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stable(o[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(v) ?? "null";
}

export function draftDiffers<T>(a: T, b: T, ignore: (keyof T)[]): boolean {
  const strip = (x: T) => {
    const o = { ...x } as Record<string, unknown>;
    for (const k of ignore) delete o[k as string];
    return stable(o);
  };
  return strip(a) !== strip(b);
}

/**
 * Qadam URL'da (?step=2): brauzerning "orqaga" tugmasi oldingi qadamga qaytaradi, sahifa yangilansa qadam saqlanadi.
 * window.history.pushState Next.js router bilan sinxron (useSearchParams yangilanadi), server qayta chizilmaydi.
 */
export function useStep(total: number, fallback: number) {
  const params = useSearchParams();
  const raw = Number(params.get("step"));
  const step = Number.isInteger(raw) && raw >= 1 && raw <= total ? raw : Math.min(Math.max(fallback, 1), total);

  const go = useCallback((next: number, replace = false) => {
    const url = new URL(window.location.href);
    url.searchParams.set("step", String(next));
    if (replace) window.history.replaceState(null, "", url);
    else window.history.pushState(null, "", url);
    window.scrollTo({ top: 0 });
  }, []);

  return { step, go };
}
