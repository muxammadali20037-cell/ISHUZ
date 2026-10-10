"use client";

import { useEffect } from "react";
import { playTicks } from "@/lib/sfx";

/** Ro'yxat elementlari birin-ketin chiqqanda (CSS .pop-list) — ular bilan bir vaqtda "tiq-tiq-tiq" */
export function PopSounds({ count }: { count: number }) {
  useEffect(() => {
    playTicks(count);
  }, [count]);
  return null;
}
