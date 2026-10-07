"use client";

import { useSyncExternalStore } from "react";
import { ANDROID_APP, APP_COOKIE } from "./app-platform";

const read = () =>
  document.cookie.split("; ").some((c) => c === `${APP_COOKIE}=${ANDROID_APP}`);
const subscribe = () => () => {};

/** Mijoz komponentlar uchun: Android ilova ichida ochilganmi (serverda va birinchi chizishda — false) */
export function useAndroidApp(): boolean {
  return useSyncExternalStore(subscribe, read, () => false);
}
