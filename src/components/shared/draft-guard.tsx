"use client";

import { useEffect } from "react";
import { LAST_USER_KEY, clearAllDrafts, guestId, ownerOf, purgeForeignDrafts, rotateGuestId } from "@/features/post/draft-store";

/**
 * Umumiy qurilmada hisoblar aralashmasligi: sahifa ochilganda joriy hisob oldingisi bilan solishtiriladi.
 * - Chiqildi (hisob → mehmon): barcha qoralamalar o'chiriladi, mehmon identifikatori almashtiriladi.
 * - Boshqa hisobga kirildi: oldingi hisob qoralamalari o'chiriladi.
 * - Har safar: joriy hisob va joriy mehmonga tegishli bo'lmagan (va eski, egasiz) qoralamalar o'chiriladi.
 * Boshqa ochiq tablar LAST_USER_KEY o'zgarishini storage hodisasi orqali sezadi (use-draft.ts).
 */
export function DraftGuard({ userId }: { userId: string | null }) {
  useEffect(() => {
    try {
      const s = window.localStorage;
      const prev = s.getItem(LAST_USER_KEY);
      const cur = userId ?? "";
      if (prev !== null && prev !== "" && prev !== cur) {
        clearAllDrafts(s);
        if (!userId) rotateGuestId(s);
      }
      if (prev !== cur) s.setItem(LAST_USER_KEY, cur);
      const gOwner = ownerOf(null, guestId(s));
      purgeForeignDrafts(s, userId ? [ownerOf(userId, ""), gOwner] : [gOwner]);
    } catch {
      // xotira yopiq — qoralama ham saqlanmaydi, tozalash shart emas
    }
  }, [userId]);
  return null;
}
