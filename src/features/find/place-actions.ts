"use server";

import { cookies } from "next/headers";
import { prefCookie } from "@/lib/security/cookies";
import type { ActionResult } from "@/features/auth/actions";
import { PLACE_COOKIE, formatPlace, parsePlace } from "./place";

/** Joylashuvdan topilgan tumanni shu qurilmada eslab qolish (keyingi "Yaqin atrofda" — so'ramasdan) */
export async function rememberPlace(input: unknown): Promise<ActionResult> {
  const place = typeof input === "object" && input ? parsePlace(`${(input as { region?: unknown }).region}~${(input as { district?: unknown }).district}`) : null;
  if (!place) return { ok: false, error: "validation" };
  (await cookies()).set(PLACE_COOKIE, formatPlace(place), prefCookie(60 * 60 * 24 * 180));
  return { ok: true };
}
