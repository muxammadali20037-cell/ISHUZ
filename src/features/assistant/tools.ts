import { z } from "zod";
import type { AiFindResult } from "@/features/find/ai-find-types";
import type { AssistantRole } from "./types";

/**
 * Yordamchining "qo'llari": bazadan qidirish. Model faqat qisqa qidiruv iborasini beradi; uni ID'larga lug'at bog'laydi va
 * bazadan HAQIQIY e'lonlar olinadi (runAiFind: kengaytirish va matnli qidiruv bilan). Modelga qaytadigan natija — ixcham
 * (nom, joy, maosh, grafik): telefon, ism va boshqa shaxsiy ma'lumot modelga berilmaydi.
 */
export interface ToolDef {
  name: "search_jobs" | "search_workers";
  description: string;
  input_schema: { type: "object"; properties: Record<string, { type: "string"; description: string }>; required: string[]; additionalProperties: false };
}

const QUERY_HINT =
  "A short search phrase in the user's language built from the whole conversation: profession or job title, district or region, minimum salary, 'kunlik' (daily pay), 'tajribasiz' (no experience), 'masofaviy' (remote), schedule. Examples: 'oshpaz Chilonzor 5 mln', 'kunlik ish Samarqand', 'водитель Ташкент без опыта'.";

export const SEARCH_JOBS: ToolDef = {
  name: "search_jobs",
  description:
    "Search real, currently active vacancies in the Ish topdim database. Call it whenever the user wants to find work or changes what they are looking for. Returns the total, a few top results (title, employer, place, salary, schedule, experience) and 'widened' notes if the exact request had no results and the search was widened.",
  input_schema: { type: "object", properties: { query: { type: "string", description: QUERY_HINT } }, required: ["query"], additionalProperties: false },
};

export const SEARCH_WORKERS: ToolDef = {
  name: "search_workers",
  description:
    "Search real, currently public job-seeker ads (candidates) in the Ish topdim database. Call it whenever the employer wants to find staff or changes the requirements. Returns the total, a few top results (profession, place, experience level, expected salary) and 'widened' notes if the exact request had no results.",
  input_schema: { type: "object", properties: { query: { type: "string", description: QUERY_HINT } }, required: ["query"], additionalProperties: false },
};

export function toolsFor(role: AssistantRole): ToolDef[] {
  return role === "employer" ? [SEARCH_WORKERS] : [SEARCH_JOBS];
}

const searchInput = z.object({ query: z.string().trim().min(2).max(200) });

/** Model bergan asbob kiritmasi: nom shu rolga ruxsat etilgan bo'lishi va so'rov matni yaroqli bo'lishi kerak */
export function parseToolCall(role: AssistantRole, name: string, input: unknown): { mode: "jobs" | "workers"; query: string } | null {
  if (!toolsFor(role).some((t) => t.name === name)) return null;
  const parsed = searchInput.safeParse(input);
  if (!parsed.success) return null;
  return { mode: name === "search_workers" ? "workers" : "jobs", query: parsed.data.query.replace(/\s+/g, " ") };
}

const MODEL_ITEMS = 6;

/** Bazadan topilgan natijaning modelga beriladigan ixcham ko'rinishi (faqat ommaviy, shaxsiy bo'lmagan maydonlar) */
export function compactForModel(data: AiFindResult): string {
  const place = (r: { region_name_uz?: string | null; district_name_uz?: string | null }, remote: boolean) => [r.region_name_uz, r.district_name_uz].filter(Boolean).join(", ") || (remote ? "remote" : null);
  const jobs = data.jobs.slice(0, MODEL_ITEMS).map((j) => ({
    title: j.title,
    employer: j.employer_name,
    place: place(j, j.is_remote),
    remote: j.is_remote || undefined,
    salary_from: j.salary_from,
    salary_to: j.salary_to,
    salary_period: j.salary_type,
    salary_negotiable: j.salary_negotiable || undefined,
    schedule: j.schedule,
    experience_min_months: j.experience_min_months,
  }));
  const workers = data.workers.slice(0, MODEL_ITEMS).map((w) => ({
    profession: w.profession_name_uz ?? w.headline,
    headline: w.headline,
    place: place(w, w.remote_ok),
    remote_ok: w.remote_ok || undefined,
    experience_level: w.experience_level,
    salary_expected: w.salary_expected,
  }));
  return JSON.stringify({
    total: data.total,
    shown_to_user_as_cards: data.jobs.length + data.workers.length,
    understood: data.understood,
    widened: data.relaxed,
    profession_unclear: data.needProfession || undefined,
    results: data.mode === "workers" ? workers : jobs,
    note: data.total === 0 ? "Nothing found. Say so honestly; the app shows a Telegram alert button and a 'post your own ad' button." : undefined,
  });
}
