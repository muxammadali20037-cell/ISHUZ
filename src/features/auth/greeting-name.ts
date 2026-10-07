import "server-only";

import { cookies } from "next/headers";
import { GREETING_NAME_COOKIE } from "@/components/shared/welcome-cookie";

/** Kirish oynasida aytilgan ism (bo'lmasa — bo'sh qator) */
export async function getGreetingName(): Promise<string> {
  const raw = (await cookies()).get(GREETING_NAME_COOKIE)?.value;
  if (!raw) return "";
  try {
    return decodeURIComponent(raw).trim().slice(0, 60);
  } catch {
    return "";
  }
}
