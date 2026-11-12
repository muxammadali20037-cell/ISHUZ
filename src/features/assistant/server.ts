import "server-only";

import type Anthropic from "@anthropic-ai/sdk";
import { AI_MODEL, getAiClient } from "@/lib/ai/client";
import { aiBudgetAllows } from "@/lib/ai/json";
import { logAiUsage } from "@/lib/ai/usage";
import type { SessionContext } from "@/features/auth/session";
import { runAiFind } from "@/features/find/ai-find-core";
import { createClient } from "@/lib/supabase/server";
import { getDistricts, getRegions } from "@/lib/reference";
import { runAssistant, type LlmClient } from "./engine";
import { marketStats } from "./market";
import type { AssistantLang, AssistantRole, ChatMessage, Emit } from "./types";

const FEATURE = "assistant_chat";

/**
 * Suhbat dvigatelini haqiqiy xizmatlarga ulash: Claude (kalit faqat serverda), bazaviy qidiruv, kunlik byudjet, jurnal.
 * Jurnalga suhbat MATNI yozilmaydi — faqat tokenlar soni, kechikish va xato kodi (ai_usage_log).
 */
const EXPERIENCE: Record<string, string> = {
  none: "no experience yet",
  lt_6m: "less than 6 months",
  "6_12m": "6–12 months",
  "1_2y": "1–2 years",
  "2_3y": "2–3 years",
  "3_5y": "3–5 years",
  "5y_plus": "more than 5 years",
};

/**
 * Foydalanuvchining O'Z e'lonidan qisqa kontekst (faqat AI javob berayotganda ishlatiladi): ish izlovchi — kasb, hudud,
 * tajriba, kutilayotgan maosh; ish beruvchi — faol vakansiyalari nomi. Telefon, familiya, manzil va boshqa shaxsiy
 * ma'lumot olinmaydi. O'qib bo'lmasa — bo'sh (yordamchi kontekstsiz ishlayveradi).
 */
async function profileLines(session: SessionContext, role: AssistantRole): Promise<string[]> {
  try {
    const supabase = await createClient();
    if (role === "employer") {
      const { data } = await supabase.from("vacancies").select("title").eq("owner_profile_id", session.userId).eq("status", "active").order("published_at", { ascending: false }).limit(5);
      const titles = (data ?? []).map((v) => v.title).filter(Boolean);
      return titles.length ? [`Their active vacancies on the platform: ${titles.join("; ")}`] : [];
    }
    if (!session.workerId) return [];
    const [{ data: w }, { data: pref }] = await Promise.all([
      supabase
        .from("worker_profiles")
        // FK nomi aniq: worker_professions (ko'p-ko'p) tufayli oddiy "profession_nodes(...)" ikki ma'noli (PGRST201)
        .select("headline, custom_profession, experience_level, region_id, district_id, profession_nodes!worker_profiles_profession_node_id_fkey(name_uz)")
        .eq("id", session.workerId)
        .maybeSingle(),
      supabase.from("worker_preferences").select("salary_expected, salary_type").eq("worker_id", session.workerId).maybeSingle(),
    ]);
    if (!w) return [];
    const region = w.region_id ? ((await getRegions()).find((r) => r.id === w.region_id) ?? null) : null;
    const district = region && w.district_id ? ((await getDistricts(region.id)).find((d) => d.id === w.district_id) ?? null) : null;
    const profession = w.profession_nodes?.name_uz ?? w.custom_profession ?? w.headline;
    return [
      profession ? `Profession in their own ad: ${profession}` : null,
      region ? `Where they look for work: ${[region.name_uz, district?.name_uz].filter(Boolean).join(", ")}` : null,
      w.experience_level ? `Experience: ${EXPERIENCE[w.experience_level] ?? w.experience_level}` : null,
      pref?.salary_expected ? `Expected salary: ${pref.salary_expected} UZS (${pref.salary_type})` : null,
    ].filter((x): x is string => !!x);
  } catch {
    return [];
  }
}

export async function runAssistantOnServer(input: { messages: ChatMessage[]; role: AssistantRole; siteLocale: AssistantLang; session: SessionContext | null; emit: Emit; signal?: AbortSignal }): Promise<void> {
  const client = getAiClient();
  // profil konteksti faqat AI ulangan va foydalanuvchi kirgan bo'lsa o'qiladi (lug'at javobiga kerak emas)
  const profile = client && input.session ? await profileLines(input.session, input.role) : [];
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
      profile,
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
      stats: (text) => marketStats(text),
      log: (u) => logAiUsage({ feature: FEATURE, provider: "anthropic", model: AI_MODEL, ok: u.ok, latencyMs: u.latencyMs, inputTokens: u.inputTokens, outputTokens: u.outputTokens, error: u.error }),
    },
  );
}
