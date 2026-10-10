"use server";

import type { ActionResult } from "@/features/auth/actions";
import { geminiProbe, type GeminiProbeResult } from "@/lib/ai/gemini";
import { requirePerm } from "./guard";

/** "AI'ni sinash": har bir Gemini modeliga kichik so'rov — kalit, kvota, model va tezlik (faqat settings.manage) */
export async function testAiProviders(): Promise<ActionResult<{ results: GeminiProbeResult[] }>> {
  const guard = await requirePerm("settings.manage");
  if (!guard.ok) return guard;
  return { ok: true, data: { results: await geminiProbe() } };
}
