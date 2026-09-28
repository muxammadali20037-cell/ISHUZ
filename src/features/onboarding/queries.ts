import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { SessionContext } from "@/features/auth/session";
import type { DraftSkill, SkillOption, SkillQuestion, WorkerDraft } from "./types";

const WORKER_COLUMNS =
  "id, headline, category_id, subcategory_id, profession_node_id, experience_level, region_id, district_id, area_hint, remote_preference, work_format, onboarding_step, onboarding_completed_at, completeness";

/**
 * Wizard qoralamasi: profil + kontakt + worker jadvallari (hammasi egasi sifatida, RLS ostida).
 * Worker profili hali yo'q bo'lsa bo'sh qoralama (1-qadam).
 */
export const getWorkerDraft = cache(async (session: SessionContext): Promise<WorkerDraft> => {
  const supabase = await createClient();
  const p = session.profile;
  const profile = { first_name: p.first_name, last_name: p.last_name, birth_date: p.birth_date, gender: p.gender, avatar_url: p.avatar_url };

  const [contactsRes, workerRes] = await Promise.all([
    supabase.from("profile_contacts").select("phone, phone_verified_at, telegram_username").eq("profile_id", session.userId).maybeSingle(),
    supabase.from("worker_profiles").select(WORKER_COLUMNS).eq("profile_id", session.userId).maybeSingle(),
  ]);

  const base: WorkerDraft = {
    workerId: null,
    onboardingStep: 1,
    profile,
    contacts: contactsRes.data ?? null,
    worker: null,
    locations: [],
    hasGeo: false,
    skills: [],
    languages: [],
    experience: [],
    education: [],
    portfolio: [],
    preferences: null,
  };
  const worker = workerRes.data;
  if (!worker) return base;
  const wid = worker.id;

  const [locations, geo, skills, languages, experience, education, portfolio, preferences] = await Promise.all([
    supabase.from("worker_locations").select("district_id").eq("worker_id", wid),
    supabase.from("worker_geo").select("worker_id").eq("worker_id", wid).maybeSingle(),
    supabase.from("worker_skills").select("skill_id, level, skills(name_uz, name_ru)").eq("worker_id", wid),
    supabase.from("worker_languages").select("language_code, level").eq("worker_id", wid),
    supabase.from("worker_experience").select("*").eq("worker_id", wid).order("sort_order").order("started_on", { ascending: false }),
    supabase.from("worker_education").select("*").eq("worker_id", wid).order("created_at"),
    supabase.from("worker_portfolio").select("*").eq("worker_id", wid).order("sort_order").order("created_at"),
    supabase.from("worker_preferences").select("*").eq("worker_id", wid).maybeSingle(),
  ]);

  const draftSkills: DraftSkill[] = (skills.data ?? []).map((row) => ({
    skill_id: row.skill_id,
    level: row.level,
    name_uz: row.skills?.name_uz ?? "",
    name_ru: row.skills?.name_ru ?? "",
  }));

  return {
    ...base,
    workerId: wid,
    onboardingStep: worker.onboarding_step,
    worker,
    locations: (locations.data ?? []).map((l) => l.district_id),
    hasGeo: !!geo.data,
    skills: draftSkills,
    languages: languages.data ?? [],
    experience: experience.data ?? [],
    education: education.data ?? [],
    portfolio: portfolio.data ?? [],
    preferences: preferences.data ?? null,
  };
});

/**
 * Ko'nikma tanlash ro'yxati: barcha tasdiqlangan ko'nikmalar + foydalanuvchining o'zi qo'shganlari.
 * Tartib: ko'p ishlatilganlar birinchi. Kategoriya bo'yicha tavsiya client'da ajratiladi.
 */
export const getSkillOptions = cache(async (userId: string): Promise<SkillOption[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("skills")
    .select("id, name_uz, name_ru, category_id")
    .or(`is_approved.eq.true,created_by.eq.${userId}`)
    .order("usage_count", { ascending: false })
    .order("name_uz")
    .limit(1500);
  return data ?? [];
});

/**
 * Ishchi kasbiga mos savollar ("Guvohnoma toifasi?", "Qaysi dasturlar?").
 * Butun soha uchun (subcategory_slugs bo'sh) yoki aynan shu kasb uchun.
 */
/**
 * Kasbga xos savollar: soha savollari + yo'nalish (subcategory) savollari + kasblar daraxti bo'ylab meros
 * (tugunga bog'langan savol shu tugun va uning barcha ichki yo'nalishlariga beriladi).
 */
export const getSkillQuestions = cache(async (categoryId: string | null, subcategoryId: string | null, nodeId: string | null = null): Promise<SkillQuestion[]> => {
  if (!categoryId) return [];
  const supabase = await createClient();
  const [{ data: sub }, { data: node }, { data, error }] = await Promise.all([
    subcategoryId ? supabase.from("subcategories").select("slug").eq("id", subcategoryId).maybeSingle() : Promise.resolve({ data: null }),
    nodeId ? supabase.from("profession_nodes").select("path").eq("id", nodeId).maybeSingle() : Promise.resolve({ data: null }),
    supabase
      .from("skill_questions")
      .select("id, title_uz, title_ru, hint_uz, hint_ru, subcategory_slugs, profession_node_id, sort_order, options:skill_question_options(sort_order, skill:skills(id, name_uz, name_ru))")
      .eq("category_id", categoryId)
      .eq("is_active", true)
      .order("sort_order"),
  ]);
  if (error) {
    console.error("[onboarding] skill questions", error.message);
    return [];
  }
  const slug = sub?.slug ?? null;
  return (data ?? [])
    .filter((q) => q.subcategory_slugs.length === 0 || (slug !== null && q.subcategory_slugs.includes(slug)))
    .filter((q) => !q.profession_node_id || (node?.path ?? []).includes(q.profession_node_id))
    .map((q) => ({
      id: q.id,
      title_uz: q.title_uz,
      title_ru: q.title_ru,
      hint_uz: q.hint_uz,
      hint_ru: q.hint_ru,
      options: [...q.options].sort((a, b) => a.sort_order - b.sort_order).flatMap((o) => (o.skill ? [o.skill] : [])),
    }))
    .filter((q) => q.options.length > 0);
});
