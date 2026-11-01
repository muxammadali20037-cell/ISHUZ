"use server";

import { cookies } from "next/headers";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { prefCookie } from "@/lib/security/cookies";
import { getSession } from "@/features/auth/session";
import type { ActionResult } from "@/features/auth/actions";
import { PLACE_COOKIE, formatPlace, parsePlace } from "@/features/find/place";
import { isMissingRelation } from "@/features/saved/missing";

const schema = z.object({
  categories: z.array(z.string().uuid()).min(1).max(8),
  /** viloyat slug'i ("all" — butun O'zbekiston); berilmasa — o'zgarmaydi */
  region: z
    .string()
    .regex(/^[a-z0-9_-]{2,60}$/)
    .nullable()
    .optional(),
});

/**
 * "Dunyongizni yarating" yakuni: qiziqishlar (1–8 soha) bazaga (set_my_interests — to'liq almashtiradi), hudud — shu qurilmada
 * eslab qolinadi (bosh sahifa va qidiruv bilan bir xil cookie). Mehmon — kirishga.
 */
export async function saveWorld(input: unknown): Promise<ActionResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const session = await getSession();
  if (!session) return { ok: false, error: "not_authenticated" };
  const supabase = await createClient();
  const { error, status } = await supabase.rpc("set_my_interests", { p_category_ids: parsed.data.categories });
  if (error) {
    if (isMissingRelation(error, status)) return { ok: false, error: "unavailable" };
    console.error("[world] set_my_interests", error.message);
    return { ok: false, error: error.message.includes("invalid_interests") ? "validation" : "generic" };
  }
  const region = parsed.data.region;
  if (region && region !== "all") {
    const place = parsePlace(`${region}~all`);
    if (place) (await cookies()).set(PLACE_COOKIE, formatPlace(place), prefCookie(60 * 60 * 24 * 180));
  } else if (region === "all") {
    (await cookies()).delete(PLACE_COOKIE);
  }
  return { ok: true };
}
