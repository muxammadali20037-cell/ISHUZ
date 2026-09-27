"use server";

import { z } from "zod";
import { Constants } from "@/types/database.types";
import { getSession } from "@/features/auth/session";
import type { ActionResult } from "@/features/auth/actions";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getLocale } from "@/lib/i18n/server";
import { aiEnabled } from "@/lib/ai/client";
import { savePersonal, saveLocation, saveProfession, saveExperience, saveSkills, saveEducation, savePreferences, skipStep } from "@/features/onboarding/actions";
import { stepHref } from "@/features/onboarding/utils";
import { createDraft, saveStep } from "@/features/vacancies/actions";
import { loadAiCatalog } from "./catalog";
import { extractVacancy, extractWorker, isAiRateLimit } from "./extract";
import { planVacancy, planWorker, type WorkerPlan } from "./mapping";

const textSchema = z.object({ text: z.string().trim().min(15).max(4000) });

/** AI chaqiruvlari pullik — foydalanuvchi boshiga soatiga cheklov */
async function allowAiCall(userId: string): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const { data } = await admin.rpc("check_rate_limit", { p_key: `ai:${userId}`, p_limit: 20, p_window_seconds: 3600 });
    return data !== false;
  } catch {
    return true; // service key yo'q (lokal) — cheklovsiz
  }
}

async function prepare(input: unknown): Promise<{ ok: true; userId: string; text: string } | { ok: false; error: string }> {
  if (!aiEnabled()) return { ok: false, error: "ai_disabled" };
  const parsed = textSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "ai_text_short" };
  const session = await getSession();
  if (!session) return { ok: false, error: "not_authenticated" };
  if (session.profile.is_blocked) return { ok: false, error: "blocked" };
  if (!(await allowAiCall(session.userId))) return { ok: false, error: "rate_limited" };
  return { ok: true, userId: session.userId, text: parsed.data.text };
}

function aiError(error: unknown, where: string): { ok: false; error: string } {
  console.error(`[ai] ${where}`, error instanceof Error ? error.message : error);
  return { ok: false, error: isAiRateLimit(error) ? "ai_busy" : "ai_failed" };
}

// ---------------------------------------------------------------------------
// Ishchi: matn → reja (saqlanmaydi) → tasdiq → qadamlar bo'yicha saqlash
// ---------------------------------------------------------------------------

export interface WorkerAiPreview {
  plan: WorkerPlan;
  /** Ko'rsatish uchun ko'nikma nomlari (id → nom) */
  skillNames: Record<string, { name_uz: string; name_ru: string }>;
}

export async function analyzeWorkerText(input: unknown): Promise<ActionResult<WorkerAiPreview>> {
  const pre = await prepare(input);
  if (!pre.ok) return pre;
  try {
    const [catalog, locale] = await Promise.all([loadAiCatalog(), getLocale()]);
    const extract = await extractWorker(catalog, pre.text, locale);
    if (!extract) return { ok: false, error: "ai_failed" };
    const plan = planWorker(catalog, extract);
    const ids = plan.skills.skills.map((s) => s.skill_id);
    const skillNames: WorkerAiPreview["skillNames"] = {};
    if (ids.length) {
      const supabase = await createClient();
      const { data } = await supabase.from("skills").select("id, name_uz, name_ru").in("id", ids);
      for (const s of data ?? []) skillNames[s.id] = { name_uz: s.name_uz, name_ru: s.name_ru };
    }
    return { ok: true, data: { plan, skillNames } };
  } catch (error) {
    return aiError(error, "analyzeWorkerText");
  }
}

const personalFixSchema = z.object({
  first_name: z.string().trim().max(60),
  last_name: z.string().trim().max(60),
  birth_date: z.string().max(10),
  gender: z.enum(Constants.public.Enums.gender).nullable(),
});
const applyWorkerSchema = z.object({
  personal: personalFixSchema,
  // Qolgan qismlar har bir save* action ichida o'z sxemasi bilan tekshiriladi
  location: z.unknown(),
  profession: z.unknown(),
  experience: z.unknown(),
  skills: z.object({ skills: z.array(z.unknown()), languages: z.array(z.unknown()) }),
  education: z.unknown(),
  preferences: z.unknown(),
  about: z.string().max(2000),
});

/**
 * Rejani mavjud onboarding qadamlari orqali saqlaydi (bir xil validatsiya va RLS).
 * Biror qadam o'tmasa — o'sha qadamga yo'naltiradi, foydalanuvchi qolganini to'ldiradi.
 */
export async function applyWorkerPlan(input: unknown): Promise<ActionResult<{ redirect: string }>> {
  const parsed = applyWorkerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const session = await getSession();
  if (!session) return { ok: false, error: "not_authenticated" };
  const p = parsed.data;
  const supabase = await createClient();
  const stop = (step: number) => ({ ok: true as const, data: { redirect: stepHref(step) } });

  const { data: contacts } = await supabase.from("profile_contacts").select("telegram_username").eq("profile_id", session.userId).maybeSingle();
  const personal = await savePersonal({ ...p.personal, telegram_username: contacts?.telegram_username ?? "" });
  if (!personal.ok) {
    // To'liq bo'lmasa ham ismlarni saqlab qo'yamiz — 1-qadamda tayyor turadi
    const names = { first_name: p.personal.first_name, last_name: p.personal.last_name };
    if (names.first_name.length >= 2 && names.last_name.length >= 2) await supabase.from("profiles").update(names).eq("id", session.userId);
    return stop(1);
  }
  if (!p.location || !(await saveLocation(p.location)).ok) return stop(2);
  if (!p.profession || !(await saveProfession(p.profession)).ok) return stop(3);
  if (!(await saveExperience(p.experience)).ok) return stop(4);
  if (!p.skills.skills.length || !(await saveSkills(p.skills)).ok) return stop(5);
  if (!(p.education ? (await saveEducation(p.education)).ok : (await skipStep({ step: 6 })).ok)) return stop(6);
  if (!(await skipStep({ step: 7 })).ok) return stop(7);
  if (!p.preferences || !(await savePreferences(p.preferences)).ok) return stop(8);
  if (p.about.trim()) await supabase.from("worker_profiles").update({ about: p.about.trim() }).eq("profile_id", session.userId);
  return stop(9);
}

// ---------------------------------------------------------------------------
// Ish beruvchi: matn → qoralama vakansiya (barcha qadamlar to'ldirilgan) → tekshiruv sahifasi
// ---------------------------------------------------------------------------

export async function createVacancyFromText(input: unknown): Promise<ActionResult<{ redirect: string }>> {
  const pre = await prepare(input);
  if (!pre.ok) return pre;
  try {
    const [catalog, locale] = await Promise.all([loadAiCatalog(), getLocale()]);
    const extract = await extractVacancy(catalog, pre.text, locale);
    if (!extract) return { ok: false, error: "ai_failed" };
    const plan = planVacancy(catalog, extract);
    const title = plan.title || pre.text.split(/\s+/).slice(0, 6).join(" ").slice(0, 120);
    const subcategoryId = plan.steps.find((s) => s.step === "category")?.data;
    const draft = await createDraft({ title, subcategoryId: subcategoryId && "subcategoryId" in subcategoryId ? subcategoryId.subcategoryId : null });
    if (!draft.ok || !draft.data) return { ok: false, error: draft.ok ? "generic" : draft.error };
    const id = draft.data.id;

    let firstMissing: string | null = null;
    for (const payload of plan.steps) {
      const res = await saveStep({ vacancyId: id, payload });
      // Majburiy qadamlar: kategoriya va joylashuv — o'tmasa foydalanuvchi o'zi tanlaydi
      if (!res.ok && !firstMissing && (payload.step === "category" || payload.step === "location")) firstMissing = payload.step;
    }
    return { ok: true, data: { redirect: `/employer/vacancies/new?id=${id}&step=${firstMissing ?? "review"}` } };
  } catch (error) {
    return aiError(error, "createVacancyFromText");
  }
}
