"use client";

import { useSyncExternalStore } from "react";

/**
 * Bosilgan, lekin hali ochilmagan sahifa manzili (NavProgress yozadi): pastki menyu bosilgan bo'limni server javobini
 * kutmasdan darhol belgilaydi (ega, 2026-11-16: "keyingi oynaga o'tishi sekin, ko'k chiziq kutib turadi").
 */
let pending: string | null = null;
const listeners = new Set<() => void>();

export function setPendingPath(path: string | null) {
  if (pending === path) return;
  pending = path;
  listeners.forEach((fn) => fn());
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function usePendingPath(): string | null {
  return useSyncExternalStore(subscribe, () => pending, () => null);
}
