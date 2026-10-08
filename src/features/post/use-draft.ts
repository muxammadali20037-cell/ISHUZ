"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

/**
 * Qoralama shu qurilmada (localStorage) saqlanadi: sahifa yangilansa, orqaga qaytilsa yoki hisobga kirib qaytilsa
 * javoblar yo'qolmaydi. Brauzer xotirasi yopiq bo'lsa ham forma ishlayveradi (faqat eslab qolinmaydi).
 * `ready` bo'lguncha komponent skeleton ko'rsatadi — server va brauzer chizgani bir xil bo'lishi uchun.
 */
export function useDraft<T extends { v: number }>(key: string, makeInitial: () => T) {
  const [draft, setDraft] = useState<T>(makeInitial);
  const [ready, setReady] = useState(false);
  const initial = useRef(makeInitial);

  useEffect(() => {
    const id = window.setTimeout(() => {
      try {
        const raw = window.localStorage.getItem(key);
        if (raw) {
          const saved = JSON.parse(raw) as Partial<T>;
          if (saved && saved.v === initial.current().v) setDraft({ ...initial.current(), ...saved });
        }
      } catch {
        // buzilgan yoki yopiq xotira — yangi qoralama bilan davom etamiz
      }
      setReady(true);
    }, 0);
    return () => window.clearTimeout(id);
  }, [key]);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(draft));
    } catch {
      // xotira to'la/yopiq — forma ishlashda davom etadi
    }
  }, [key, draft, ready]);

  const update = useCallback((patch: Partial<T> | ((d: T) => Partial<T>)) => {
    setDraft((d) => ({ ...d, ...(typeof patch === "function" ? patch(d) : patch) }));
  }, []);

  const clear = useCallback(() => {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // ahamiyatsiz
    }
  }, [key]);

  const reset = useCallback(() => {
    clear();
    setDraft(initial.current());
  }, [clear]);

  return { draft, update, ready, clear, reset };
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
