import type { AiFindResult } from "@/features/find/ai-find-types";
import { adviceReply } from "./advice";
import { conversationLanguage } from "./language";
import { statsSubject, type MarketStats } from "./market-math";
import { systemPrompt } from "./prompt";
import { adviceSuggestions, isStatsQuestion, searchReply, smallTalk, smallTalkReply, statsAskReply, statsReply, statsSuggestions, suggestionsFor } from "./replies";
import { compactForModel, compactStatsForModel, parseToolCall, toolsFor, type ToolDef } from "./tools";
import { HISTORY_MESSAGES, MESSAGE_MAX_CHARS, type AssistantLang, type AssistantRole, type ChatMessage, type Emit } from "./types";

/**
 * Suhbat dvigateli (Conversation Engine) — bitta foydalanuvchi xabariga javob:
 *
 *   AI ulangan → model suhbat kontekstini o'qiydi → kerak bo'lsa `search_jobs` / `search_workers` (bazadan HAQIQIY e'lonlar,
 *   kartalar shu ma'lumotdan chiziladi) yoki `market_stats` (kasb bo'yicha vakansiyalar, ish izlovchilar soni va maosh oralig'i —
 *   bazadan hisoblanadi) asbobini chaqiradi → model natijaga tayanib qisqa, tabiiy javob yozadi (oqim bilan chiqadi).
 *
 *   AI ulanmagan / kunlik byudjet tugagan / xato yoki vaqt tugadi (javob boshlanmasdan) → lug'at va shablon: xuddi shu bazaviy
 *   qidiruv, bozor statistikasi, amaliy maslahat (rezyume, suhbat, karyera, vakansiya matni) va foydalanuvchi tilidagi tayyor
 *   javob. Foydalanuvchi hech qachon javobsiz yoki "boshi berk" javob bilan qolmaydi.
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
/** kasb (va hudud) bo'yicha bozor holati; data: null — kasb tushunilmadi */
export type StatsFn = (text: string) => Promise<{ ok: true; data: MarketStats | null } | { ok: false }>;

export interface EngineDeps {
  /** null — AI kaliti sozlanmagan */
  llm: LlmClient | null;
  model: string;
  /** kunlik AI byudjeti (xarajat himoyasi): false — AI chaqirilmaydi, lug'at bilan javob beriladi */
  budget: () => Promise<boolean>;
  find: FindFn;
  /** bozor statistikasi (berilmasa — statistika so'rovi oddiy qidiruv sifatida ishlanadi) */
  stats?: StatsFn;
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
  /**
   * Foydalanuvchining o'z e'lonidan qisqa ma'lumot (kasb, hudud, tajriba; ish beruvchida — faol vakansiyalari nomi) —
   * yordamchi so'ramasdan mosini qidira olishi uchun. Ism, telefon va boshqa shaxsiy ma'lumot berilmaydi.
   */
  profile?: string[];
  emit: Emit;
  /** brauzer ulanishni uzdi — ish to'xtatiladi */
  signal?: AbortSignal;
}

/** Bitta javob uchun umumiy vaqt, model chaqiruvlari va asboblar soni chegaralari */
export const TOTAL_MS = 30_000;
export const MAX_ROUNDS = 3;
export const MAX_TOOL_CALLS_PER_ROUND = 2;
const MAX_TOKENS = 1500;
/** AI'siz kontekst: nechta oldingi foydalanuvchi xabari bilan birga qidirib ko'riladi */
const CONTEXT_MESSAGES = 3;

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

/** Statistika so'rovining davomi ("oshpaz" yoki "Samarqandda-chi?" — oldingi xabar "… maoshi qancha?" edi) */
const FOLLOW_UP_MAX = 40;

/**
 * AI'siz javob: bozor statistikasi savoli — bazadan hisob; salomlashuv/rahmat — tayyor gap; maslahat (rezyume, suhbat,
 * karyera, vakansiya matni) — amaliy yo'riqnoma; aks holda bazadan qidiruv va shablon javob.
 */
async function rulesTurn(ctx: Ctx, deps: EngineDeps): Promise<void> {
  const { emit, lang, role, turn } = ctx;
  const userTexts = ctx.history.filter((m) => m.role === "user").map((m) => m.text);
  const last = userTexts.at(-1)!;
  const earlier = userTexts.slice(0, -1).filter((x) => !smallTalk(x)).slice(-CONTEXT_MESSAGES);
  const talk = smallTalk(last);
  const prev = earlier.at(-1);
  const asked = isStatsQuestion(last);
  const followUp = !asked && !talk && !!prev && isStatsQuestion(prev) && last.length <= FOLLOW_UP_MAX;
  if (deps.stats && (asked || followUp)) {
    emit({ type: "status", stage: "searching" });
    let res = await deps.stats(last.slice(0, 200));
    // kasb shu xabarda yo'q, lekin joy yoki boshqa so'z bor ("Samarqandda maosh qancha?", "Toshkentda-chi?") — oldingi xabarlar
    // bilan birga (eng yaqinidan). Faqat so'roqning o'zi ("statistika", "kasbim bo'yicha maosh qancha") — kasb so'raladi.
    const hasSubject = /\p{L}{2,}/u.test(statsSubject(last));
    for (let i = earlier.length - 1; hasSubject && res.ok && !res.data && i >= 0; i--) {
      const joined = await deps.stats(`${last} ${earlier[i]}`.slice(0, 200));
      if (!joined.ok) break;
      if (joined.data) res = joined;
    }
    if (ctx.signal?.aborted) return;
    if (!res.ok) {
      emit({ type: "error", code: "search_failed" });
      return;
    }
    if (res.data) {
      emit({ type: "stats", data: res.data });
      emit({ type: "text", delta: statsReply(res.data, lang, role) });
      emit({ type: "suggestions", items: statsSuggestions(res.data, lang, role) });
      emit({ type: "done", source: "rules", lang });
      return;
    }
    if (asked) {
      emit({ type: "text", delta: statsAskReply(lang, role, turn) });
      emit({ type: "suggestions", items: suggestionsFor(null, lang, role, false) });
      emit({ type: "done", source: "rules", lang });
      return;
    }
    // davom etuvchi xabardan ham kasb chiqmadi — oddiy qidiruv sifatida
  }
  if (talk === "advice") {
    emit({ type: "text", delta: adviceReply(last, lang, role) });
    emit({ type: "suggestions", items: adviceSuggestions(lang, role) });
    emit({ type: "done", source: "rules", lang });
    return;
  }
  if (talk) {
    emit({ type: "text", delta: smallTalkReply(talk, lang, role, turn) });
    emit({ type: "suggestions", items: suggestionsFor(null, lang, role, false) });
    emit({ type: "done", source: "rules", lang });
    return;
  }
  emit({ type: "status", stage: "searching" });
  let res = await deps.find({ text: last.slice(0, 300), mode: ctx.mode, ai: true });
  // Suhbat konteksti (AI'siz): xabarda kasb yo'q, lekin shart bor ("Chilonzorda", "5 mln dan", "kunlik") — bu oldingi so'rovning
  // davomi: oldingi xabarlar (ko'pi bilan 3 ta) bilan birga qidiriladi, kasb topilguncha. Hech narsa tushunilmagan matn
  // ("qwerty") oldingisiga qo'shilmaydi — "tushunmadim" deb aytiladi.
  if (res.ok && !res.data.flags.profession && res.data.flags.filters) {
    for (let n = 1; n <= earlier.length; n++) {
      const joined = await deps.find({ text: [...earlier.slice(-n), last].join(" ").slice(0, 300), mode: ctx.mode, ai: true });
      if (!joined.ok) break;
      if (joined.data.flags.profession) {
        res = joined;
        break;
      }
    }
  }
  if (ctx.signal?.aborted) return;
  if (!res.ok) {
    emit({ type: "error", code: "search_failed" });
    return;
  }
  emit({ type: "results", data: res.data });
  emit({ type: "text", delta: searchReply(res.data, lang, role, turn) });
  emit({ type: "suggestions", items: suggestionsFor(res.data, lang, role, false) });
  emit({ type: "done", source: "rules", lang });
}

async function aiTurn(ctx: Ctx, deps: EngineDeps, llm: LlmClient): Promise<void> {
  const { emit, lang, role } = ctx;
  const now = deps.now ?? Date.now;
  const started = now();
  const system = systemPrompt({ role, lang, firstName: ctx.firstName, loggedIn: ctx.loggedIn, profile: ctx.profile, today: (deps.today ?? (() => new Date().toISOString().slice(0, 10)))() });
  const convo: LlmTurn[] = ctx.history.map((m) => ({ role: m.role, content: m.text }));
  const usage = { inputTokens: 0, outputTokens: 0 };
  let wroteText = false;
  let needGap = false;
  let lastData: AiFindResult | null = null;
  let lastStats: MarketStats | null = null;
  let sentResults = false;
  const withStats = !!deps.stats;

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
          tools: toolsFor(role, withStats),
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
        const parsed = calls.includes(call) ? parseToolCall(role, call.name ?? "", call.input, withStats) : null;
        if (!parsed) {
          results.push({ type: "tool_result", tool_use_id: call.id!, content: "This tool call is not available. Answer without it.", is_error: true });
          continue;
        }
        if (parsed.tool === "stats") {
          const st = await deps.stats!(parsed.query);
          if (!st.ok) {
            results.push({ type: "tool_result", tool_use_id: call.id!, content: "The statistics query failed. Tell the user to try again in a moment; do not invent numbers.", is_error: true });
            continue;
          }
          if (st.data) {
            lastStats = st.data;
            sentResults = true;
            emit({ type: "stats", data: st.data });
          }
          results.push({ type: "tool_result", tool_use_id: call.id!, content: compactStatsForModel(st.data) });
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
    if (!wroteText) emit({ type: "text", delta: lastData ? searchReply(lastData, lang, role, ctx.turn) : lastStats ? statsReply(lastStats, lang, role) : searchReply(null, lang, role, ctx.turn) });
    emit({ type: "suggestions", items: !lastData && lastStats ? statsSuggestions(lastStats, lang, role) : suggestionsFor(lastData, lang, role, true) });
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
