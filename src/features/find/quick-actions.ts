"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { getSession } from "@/features/auth/session";
import { allowRate } from "@/lib/rate-limit";
import { clientIp, ipBucket, subjectHash } from "@/lib/security/request";
import { MESSAGE_MAX_CHARS } from "@/features/assistant/types";
import { prepareQuick, runQuick } from "./quick-core";
import type { QuickForm, QuickResult } from "./quick-types";

/**
 * Yordamchi — oddiy qidiruv amallari (oyna oldidan tushunish va "Qidirish"). Himoya: bloklangan foydalanuvchi — yo'q,
 * soatlik limit (kirgan — 120, mehmon IP bo'yicha — 200; mobil operatorlarda ko'p odam bitta IP ortida). AI faqat matnni
 * tushunishda va o'z limiti bilan (ai-search.ts). Matn serverda saqlanmaydi.
 */

type Out<T> = { ok: true; data: T } | { ok: false; error: "validation" | "forbidden" | "rate_limited" | "search_failed" };

const mode = z.enum(["jobs", "workers"]);

async function guard(): Promise<{ ok: true; session: Awaited<ReturnType<typeof getSession>> } | { ok: false; error: "forbidden" | "rate_limited" }> {
  const session = await getSession();
  if (session?.profile.is_blocked) return { ok: false, error: "forbidden" };
  const key = session ? `quick_find:${session.userId}` : `quick_find_ip:${subjectHash("ip", ipBucket(clientIp(await headers())))}`;
  if (!(await allowRate(key, session ? 120 : 200, 3600))) return { ok: false, error: "rate_limited" };
  return { ok: true, session };
}

// bo'sh matn — tezkor tugma ("Ish qidirish"): oyna bo'sh kasb bilan ochiladi
const prepareSchema = z.object({ text: z.string().trim().max(MESSAGE_MAX_CHARS), mode });

export async function quickPrepare(input: unknown): Promise<Out<QuickForm>> {
  const parsed = prepareSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const g = await guard();
  if (!g.ok) return g;
  try {
    return { ok: true, data: await prepareQuick({ text: parsed.data.text, mode: parsed.data.mode, session: g.session }) };
  } catch (e) {
    console.error(JSON.stringify({ quick_prepare_error: e instanceof Error ? e.message.slice(0, 160) : "error" }));
    return { ok: false, error: "search_failed" };
  }
}

const searchSchema = z.object({
  mode,
  answers: z.object({
    profession: z.string().max(120),
    nodeId: z.uuid().nullable(),
    place: z.string().max(120).regex(/^(all|remote|[a-z0-9_-]{2,60}(~[0-9a-f-]{36})?)$/i),
    salary: z.number().int().min(0).max(1_000_000_000).nullable(),
    filters: z.object({
      pay: z.enum(["daily"]).nullable(),
      noexp: z.boolean(),
      exp: z.boolean(),
      schedule: z.enum(["5_2", "6_1", "2_2", "shift", "flexible"]).nullable(),
    }),
  }),
});

export async function quickSearch(input: unknown): Promise<Out<QuickResult>> {
  const parsed = searchSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const g = await guard();
  if (!g.ok) return g;
  try {
    const res = await runQuick({ mode: parsed.data.mode, answers: parsed.data.answers, session: g.session });
    return res.ok ? res : { ok: false, error: "search_failed" };
  } catch (e) {
    console.error(JSON.stringify({ quick_search_error: e instanceof Error ? e.message.slice(0, 160) : "error" }));
    return { ok: false, error: "search_failed" };
  }
}
