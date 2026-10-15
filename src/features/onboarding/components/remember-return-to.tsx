"use client";

import { useEffect } from "react";
import { rememberReturnTo } from "../return-to";

/** /onboarding/worker?next=… — qaytish manzilini shu tabda eslab qoladi (onboarding yakunida o'sha sahifaga) */
export function RememberReturnTo({ path }: { path: string }) {
  useEffect(() => {
    rememberReturnTo(path);
  }, [path]);
  return null;
}
