"use client";

import { useEffect } from "react";
import { haptic, playSfx, unlockSfx } from "@/lib/sfx";

const INTERACTIVE = '[data-sfx], a[href], button, [role="button"], [role="radio"], [role="option"], [role="switch"], [role="tab"], [role="checkbox"], summary';

/**
 * Bosilganda yengil javob: mayin "tik" va (Telegram'da) tebranish. Asosiy tugmalarda data-sfx="pop" — "voup".
 * data-sfx="none" — ovozsiz. Bitta umumiy tinglovchi (passive) — sahifa tezligiga ta'sir qilmaydi.
 */
export function SfxListener() {
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      unlockSfx();
      const el = (e.target as Element | null)?.closest?.(INTERACTIVE);
      if (!el || (el as HTMLButtonElement).disabled || el.getAttribute("aria-disabled") === "true") return;
      const kind = el.getAttribute("data-sfx");
      if (kind === "none") return;
      if (kind === "pop") {
        playSfx("pop");
        haptic("impact");
      } else {
        playSfx("tap");
        haptic("select");
      }
    };
    // klaviatura bilan yozish ham "foydalanuvchi harakati" — qidiruv natijalarining "tiq-tiq"i uchun
    const onKey = () => unlockSfx();
    document.addEventListener("pointerdown", onDown, { capture: true, passive: true });
    document.addEventListener("keydown", onKey, { capture: true, passive: true });
    return () => {
      document.removeEventListener("pointerdown", onDown, { capture: true });
      document.removeEventListener("keydown", onKey, { capture: true });
    };
  }, []);
  return null;
}
