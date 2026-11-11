import type { AiFindResult } from "@/features/find/ai-find-types";
import { conversationLanguage } from "./language";
import { systemPrompt } from "./prompt";
import { searchReply, smallTalk, smallTalkReply, suggestionsFor } from "./replies";
import { compactForModel, parseToolCall, toolsFor, type ToolDef } from "./tools";
import { HISTORY_MESSAGES, MESSAGE_MAX_CHARS, type AssistantLang, type AssistantRole, type ChatMessage, type Emit } from "./types";

/**
 * Suhbat dvigateli (Conversation Engine) — bitta foydalanuvchi xabariga javob:
 *
 *   AI ulangan → model suhbat kontekstini o'qiydi → kerak bo'lsa `search_jobs` / `search_workers` asbobini chaqiradi →
 *   server bazadan HAQIQIY e'lonlarni oladi (kartalar shu ma'lumotdan chiziladi) → model natijaga tayanib qisqa, tabiiy javob
 *   yozadi (oqim bilan chiqadi).
 *
 *   AI ulanmagan / kunlik byudjet tugagan / xato yoki vaqt tugadi (javob boshlanmasdan) → lug'at va shablon: xuddi shu bazaviy
 *   qidiruv va foydalanuvchi tilidagi tayyor javob. Foydalanuvchi hech qachon javobsiz qolmaydi.
 *
 * Bu fayl sof (server modullarini import qilmaydi): model, qidiruv, byudjet va jurnal tashqaridan beriladi — test qilinadi.
 * Suhbat matni serverda saqlanmaydi (jurnalga faqat tokenlar soni va kechikish yoziladi).
 */

export interface LlmBlock {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: unknown;
}
export interface LlmMessage {
  content: LlmBlock[];
  stop_reason: string | null;
  usage?: { input_tokens: number; output_tokens: number };
}
export interface LlmStream {
  on(event: "text", listener: (delta: string) => void): unknown;
  finalMessage(): Promise<LlmMessage>;
  abort(): void;
}
export type LlmTurn = { role: "user" | "assistant"; content: string | LlmBlock[] | Array<{ type: "tool_result"; tool_use_id: string; content: string; is_error?: boolean }> };
export interface LlmParams {
  model: string;
  max_tokens: number;
  system: Array<{ type: "text"; text: string; cache_control?: { type: "ephemeral" } }>;
  /** suhbat uchun tez javob muhim: chuqur mulohaza emas (aiJson bilan bir xil sozlama) */
  output_config: { effort: "low" };
  tools: ToolDef[];
  /** oxirgi urinishda "none": model yana asbob chaqira olmaydi — matn bilan javob berishi shart */
  tool_choice?: { type: "none" };
  messages: LlmTurn[];
}
export interface LlmClient {
  stream(params: LlmParams, options: { signal?: AbortSignal; timeout: number }): LlmStream;
}

export type FindFn = (input: { text: string; mode: "jobs" | "workers"; ai: boolean }) => Promise<{ ok: true; data: AiFindResult } | { ok: false }>;

export interface EngineDeps {
  /** null — AI kaliti sozlanmagan */
  llm: LlmClient | null;
  model: string;
  /** kunlik AI byudjeti (xarajat himoyasi): false — AI chaqirilmaydi, lug'at bilan javob beriladi */
  budget: () => Promise<boolean>;
  find: FindFn;
  log?: (u: { ok: boolean; latencyMs: number; inputTokens: number; outputTokens: number; error: string | null }) => void | Promise<void>;
  now?: () => number;
  today?: () => string;
}

export interface EngineInput {
  messages: ChatMessage[];
  role: AssistantRole;
  /** sayt tili — xabar tilini aniqlab bo'lmaganda */
  siteLocale: AssistantLang;
  firstName?: string | null;
  loggedIn: boolean;
  emit: Emit;
  /** brauzer ulanishni uzdi — ish to'xtatiladi */
  signal?: AbortSignal;
}

/** Bitta javob uchun umumiy vaqt, model chaqiruvlari va asboblar soni chegaralari */
export const TOTAL_MS = 30_000;
export const MAX_ROUNDS = 3;
export const MAX_TOOL_CALLS_PER_ROUND = 2;
const MAX_TOKENS = 1500;

/** Tarixni tozalash: faqat oxirgi bir nechta xabar, uzunligi cheklangan, boshida va oxirida foydalanuvchi xabari */
export function sanitizeHistory(messages: ChatMessage[]): ChatMessage[] {
  const clean = messages
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.text === "string")
    .map((m) => ({ role: m.role, text: m.text.replace(/\s+/g, " ").trim().slice(0, MESSAGE_MAX_CHARS) }))
    .filter((m) => m.text.length > 0)
    .slice(-HISTORY_MESSAGES);
  while (clean.length && clean[0]!.role !== "user") clean.shift();
  return clean;
}

export async function runAssistant(input: EngineInput, deps: EngineDeps): Promise<void> {
  const { emit, role } = input;
  const history = sanitizeHistory(input.messages);
  const last = history.at(-1);
  if (!last || last.role !== "user" || last.text.length < 1) {
    emit({ type: "error", code: "validation" });
    return;
  }
  const userTexts = history.filter((m) => m.role === "user").map((m) => m.text);
  const lang = conversationLanguage(userTexts, input.siteLocale);
  const ctx: Ctx = { ...input, history, lang, turn: userTexts.length - 1, mode: role === "employer" ? "workers" : "jobs" };

  if (!deps.llm || !(await deps.budget())) return rulesTurn(ctx, deps);
  return aiTurn(ctx, deps, deps.llm);
}

interface Ctx extends EngineInput {
  history: ChatMessage[];
  lang: AssistantLang;
  /** nechanchi foydalanuvchi xabari (0 dan) — shablon javoblar takrorlanmasligi uchun */
  turn: number;
  mode: "jobs" | "workers";
}

/** AI'siz javob: salomlashuv/rahmat — tayyor gap; aks holda bazadan qidiruv va shablon javob */
async function rulesTurn(ctx: Ctx, deps: EngineDeps): Promise<void> {
  const { emit, lang, role, turn } = ctx;
  const userTexts = ctx.history.filter((m) => m.role === "user").map((m) => m.text);
  const last = userTexts.at(-1)!;
  const talk = smallTalk(last);
  if (talk) {
    emit({ type: "text", delta: smallTalkReply(talk, lang, role, turn) });
    emit({ type: "suggestions", items: suggestionsFor(null, lang, role) });
    emit({ type: "done", source: "rules", lang });
    return;
  }
  emit({ type: "status", stage: "searching" });
  let res = await deps.find({ text: last.slice(0, 300), mode: ctx.mode, ai: true });
  // qisqa davom ("Chilonzorda", "5 mln dan") o'zi tushunarsiz bo'lsa — oldingi xabar bilan birga qidiriladi (suhbat konteksti)
  const prev = userTexts.at(-2);
  if (res.ok && res.data.needProfession && res.data.total === 0 && prev && !smallTalk(prev) && last.split(" ").length <= 4) {
    const joined = await deps.find({ text: `${prev} ${last}`.slice(0, 300), mode: ctx.mode, ai: true });
    if (joined.ok && (joined.data.total > 0 || !joined.data.needProfession)) res = joined;
  }
  if (ctx.signal?.aborted) return;
  if (!res.ok) {
    emit({ type: "error", code: "search_failed" });
    return;
  }
  emit({ type: "results", data: res.data });
  emit({ type: "text", delta: searchReply(res.data, lang, role, turn) });
  emit({ type: "suggestions", items: suggestionsFor(res.data, lang, role) });
  emit({ type: "done", source: "rules", lang });
}

async function aiTurn(ctx: Ctx, deps: EngineDeps, llm: LlmClient): Promise<void> {
  const { emit, lang, role } = ctx;
  const now = deps.now ?? Date.now;
  const started = now();
  const system = systemPrompt({ role, lang, firstName: ctx.firstName, loggedIn: ctx.loggedIn, today: (deps.today ?? (() => new Date().toISOString().slice(0, 10)))() });
  const convo: LlmTurn[] = ctx.history.map((m) => ({ role: m.role, content: m.text }));
  const usage = { inputTokens: 0, outputTokens: 0 };
  let wroteText = false;
  let needGap = false;
  let lastData: AiFindResult | null = null;
  let sentResults = false;

  try {
    emit({ type: "status", stage: "thinking" });
    for (let round = 0; round < MAX_ROUNDS; round++) {
      const remaining = TOTAL_MS - (now() - started);
      if (remaining <= 1000) throw new Error("timeout");
      const stream = llm.stream(
        {
          model: deps.model,
          max_tokens: MAX_TOKENS,
          output_config: { effort: "low" },
          system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
          tools: toolsFor(role),
          ...(round === MAX_ROUNDS - 1 ? { tool_choice: { type: "none" as const } } : {}),
          messages: convo,
        },
        { signal: ctx.signal, timeout: remaining },
      );
      stream.on("text", (delta) => {
        if (!delta) return;
        emit({ type: "text", delta: needGap ? `\n\n${delta}` : delta });
        needGap = false;
        wroteText = true;
      });
      const message = await stream.finalMessage();
      usage.inputTokens += message.usage?.input_tokens ?? 0;
      usage.outputTokens += message.usage?.output_tokens ?? 0;
      const calls = message.content.filter((b) => b.type === "tool_use" && b.id && b.name).slice(0, MAX_TOOL_CALLS_PER_ROUND);
      if (message.stop_reason !== "tool_use" || !calls.length) break;

      convo.push({ role: "assistant", content: message.content });
      emit({ type: "status", stage: "searching" });
      const results: Array<{ type: "tool_result"; tool_use_id: string; content: string; is_error?: boolean }> = [];
      for (const call of message.content.filter((b) => b.type === "tool_use" && b.id)) {
        const parsed = calls.includes(call) ? parseToolCall(role, call.name ?? "", call.input) : null;
        if (!parsed) {
          results.push({ type: "tool_result", tool_use_id: call.id!, content: "This tool call is not available. Answer without it.", is_error: true });
          continue;
        }
        const found = await deps.find({ text: parsed.query, mode: parsed.mode, ai: false });
        if (!found.ok) {
          results.push({ type: "tool_result", tool_use_id: call.id!, content: "The database search failed. Tell the user to try again in a moment; do not invent results.", is_error: true });
          continue;
        }
        lastData = found.data;
        sentResults = true;
        emit({ type: "results", data: found.data });
        results.push({ type: "tool_result", tool_use_id: call.id!, content: compactForModel(found.data) });
      }
      convo.push({ role: "user", content: results });
      needGap = wroteText;
    }
    // model matn yozmay to'xtagan bo'lsa (kamdan-kam) — foydalanuvchi javobsiz qolmaydi: natija bo'yicha tayyor gap
    if (!wroteText) emit({ type: "text", delta: lastData ? searchReply(lastData, lang, role, ctx.turn) : searchReply(null, lang, role, ctx.turn) });
    emit({ type: "suggestions", items: suggestionsFor(lastData, lang, role) });
    emit({ type: "done", source: "ai", lang });
    await deps.log?.({ ok: true, latencyMs: now() - started, ...usage, error: null });
  } catch (e) {
    if (ctx.signal?.aborted) return; // foydalanuvchi to'xtatdi yoki sahifani yopdi
    const timedOut = now() - started >= TOTAL_MS - 1000 || (e instanceof Error && /timeout|timed out|abort/i.test(e.message));
    await deps.log?.({ ok: false, latencyMs: now() - started, ...usage, error: (e instanceof Error ? e.message : "error").slice(0, 200) });
    // javob hali boshlanmagan — lug'at bilan to'liq javob beriladi (foydalanuvchi xatoni ko'rmaydi)
    if (!wroteText && !sentResults) return rulesTurn(ctx, deps);
    emit({ type: "error", code: timedOut ? "timeout" : "unavailable" });
  }
}
