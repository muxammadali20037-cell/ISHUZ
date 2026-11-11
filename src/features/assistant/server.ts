import "server-only";

import type Anthropic from "@anthropic-ai/sdk";
import { AI_MODEL, getAiClient } from "@/lib/ai/client";
import { aiBudgetAllows } from "@/lib/ai/json";
import { logAiUsage } from "@/lib/ai/usage";
import type { SessionContext } from "@/features/auth/session";
import { runAiFind } from "@/features/find/ai-find-core";
import { runAssistant, type LlmClient } from "./engine";
import type { AssistantLang, AssistantRole, ChatMessage, Emit } from "./types";

const FEATURE = "assistant_chat";

/**
 * Suhbat dvigatelini haqiqiy xizmatlarga ulash: Claude (kalit faqat serverda), bazaviy qidiruv, kunlik byudjet, jurnal.
 * Jurnalga suhbat MATNI yozilmaydi — faqat tokenlar soni, kechikish va xato kodi (ai_usage_log).
 */
export function runAssistantOnServer(input: { messages: ChatMessage[]; role: AssistantRole; siteLocale: AssistantLang; session: SessionContext | null; emit: Emit; signal?: AbortSignal }): Promise<void> {
  const client = getAiClient();
  const llm: LlmClient | null = client
    ? {
        // maxRetries: 0 — qayta urinish o'rniga lug'at javobi (foydalanuvchi kutib qolmasin)
        stream: (params, options) => client.messages.stream(params as unknown as Anthropic.MessageStreamParams, { signal: options.signal, timeout: options.timeout, maxRetries: 0 }),
      }
    : null;
  return runAssistant(
    {
      messages: input.messages,
      role: input.role,
      siteLocale: input.siteLocale,
      firstName: input.session?.profile.first_name?.trim() || null,
      loggedIn: !!input.session,
      emit: input.emit,
      signal: input.signal,
    },
    {
      llm,
      model: AI_MODEL,
      budget: () => aiBudgetAllows(FEATURE),
      find: async ({ text, mode, ai }) => {
        const res = await runAiFind({ text, mode, session: input.session, ai });
        return res.ok ? { ok: true, data: res.data } : { ok: false };
      },
      log: (u) => logAiUsage({ feature: FEATURE, provider: "anthropic", model: AI_MODEL, ok: u.ok, latencyMs: u.latencyMs, inputTokens: u.inputTokens, outputTokens: u.outputTokens, error: u.error }),
    },
  );
}
