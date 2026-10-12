"use client";

import { useEffect, type RefObject } from "react";

/**
 * Ekran pastidagi yopishqoq amallar paneli (masalan, "Ariza yuborish"): u egallagan balandlik `--cta-offset` ga yoziladi,
 * o'ng pastdagi lupa tugmasi (.ai-fab) undan yuqorida turadi va asosiy tugmani yopmaydi. Panel yashirin bo'lsa — o'chiriladi.
 */
export function useCtaOffset(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = document.documentElement;
    const update = () => {
      if (!el.getClientRects().length) {
        root.style.removeProperty("--cta-offset");
        return;
      }
      root.style.setProperty("--cta-offset", `${Math.max(0, Math.round(window.innerHeight - el.getBoundingClientRect().top))}px`);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
      root.style.removeProperty("--cta-offset");
    };
  }, [ref]);
}
