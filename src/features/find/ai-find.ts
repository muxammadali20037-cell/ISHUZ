"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { allowRate } from "@/lib/rate-limit";
import { clientIp, ipBucket, subjectHash } from "@/lib/security/request";
import { getSession } from "@/features/auth/session";
import type { ActionResult } from "@/features/auth/actions";
import { runAiFind } from "./ai-find-core";
import type { AiFindResult } from "./ai-find-types";

const input = z.object({
  text: z.string().trim().min(2).max(300),
  mode: z.enum(["jobs", "workers"]).nullable(),
});

/**
 * "O'zingizga mosini toping" (lupa tugmasi): qisqa matn → maqsad, kasb, hudud, kunlik/oylik, maosh (lug'at, kerak bo'lsa AI) →
 * bazadagi haqiqiy e'lonlar, qidiruv sahifasidagi tartibda saralangan (ajratilgan, tuman, yangi). Natija ilova ichida ko'rsatiladi.
 */
export async function aiFind(raw: unknown): Promise<ActionResult<AiFindResult>> {
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "validation" };
  const session = await getSession();
  const key = session ? `ai_find:${session.userId}` : `ai_find_ip:${subjectHash("ip", ipBucket(clientIp(await headers())))}`;
  if (!(await allowRate(key, 30, 3600))) return { ok: false, error: "rate_limited" };
  return runAiFind({ text: parsed.data.text, mode: parsed.data.mode, session });
}
