"use server";

import { randomUUID } from "node:crypto";
import { safeFilterValue } from "@/lib/security/postgrest";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import type { ActionResult } from "@/features/auth/actions";
import { moderateNow } from "@/features/moderation/service";
import { runBackgroundTickSafe } from "@/features/notifications/tick";
import { getSession, type SessionContext } from "@/features/auth/session";
import { createClient, type SupabaseServerClient } from "@/lib/supabase/server";
import { errorCode } from "@/lib/utils";
import type { Database } from "@/types/database.types";
import { customSkillSchema, saveStepInputSchema, statusChangeSchema, titleSchema, vacancyIdSchema, type StepPayload } from "./schema";
import type { VacancyStatus } from "./types";

type VacancyUpdate = Database["public"]["Tables"]["vacancies"]["Update"];
type Ctx = { session: SessionContext; supabase: SupabaseServerClient };
type CtxResult = { ok: true; ctx: Ctx } | { ok: false; error: string };

/** Sessiya + ish beruvchi roli (client'dagi rolga ishonilmaydi) */
async function employerCtx(): Promise<CtxResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "not_authenticated" };
  if (session.profile.is_blocked) return { ok: false, error: "blocked" };
  if (!session.employerId) return { ok: false, error: "employer_only" };
  return { ok: true, ctx: { session, supabase: await createClient() } };
}

function revalidateVacancy(id?: string) {
  revalidatePath("/employer");
  revalidatePath("/employer/vacancies");
  revalidatePath("/employer/vacancies/new");
  if (id) {
    revalidatePath(`/employer/vacancies/${id}`);
    revalidatePath(`/employer/vacancies/${id}/edit`);
  }
}

type EditableVacancy = { id: string; status: VacancyStatus; category_id: string | null; company_id: string | null; applications_count: number };

/** Vakansiyani o'qish (RLS) + can_edit_vacancy tekshiruvi */
async function loadEditable(supabase: SupabaseServerClient, id: string): Promise<{ ok: true; vacancy: EditableVacancy } | { ok: false; error: string }> {
  const { data, error } = await supabase.from("vacancies").select("id, status, category_id, company_id, applications_count").eq("id", id).maybeSingle();
  if (error) return { ok: false, error: errorCode(error) };
  if (!data) return { ok: false, error: "not_found" };
  const { data: canEdit, error: rpcError } = await supabase.rpc("can_edit_vacancy", { p_vacancy_id: id });
  if (rpcError) return { ok: false, error: errorCode(rpcError) };
  if (!canEdit) return { ok: false, error: "forbidden" };
  return { ok: true, vacancy: data };
}

/** update ... returning id — 0 qator = RLS rad etdi (masalan hidden) */
async function updateRow(supabase: SupabaseServerClient, id: string, patch: VacancyUpdate): Promise<ActionResult> {
  const { data, error } = await supabase.from("vacancies").update(patch).eq("id", id).select("id");
  if (error) return { ok: false, error: errorCode(error) };
  if (!data.length) return { ok: false, error: "forbidden" };
  return { ok: true };
}

// ---------------------------------------------------------------------------
// 1-qadam: qoralama yaratish
// ---------------------------------------------------------------------------

/**
 * Yangi qoralama (status = draft). ID serverda yaratiladi: RLS'dagi manages_vacancy() snapshot
 * sababli `insert ... returning` ishlamaydi, shuning uchun select'siz insert qilinadi.
 */
export async function createDraft(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = titleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const c = await employerCtx();
  if (!c.ok) return c;
  const { session, supabase } = c.ctx;

  let categoryId: string | null = null;
  let subcategoryId: string | null = null;
  if (parsed.data.subcategoryId) {
    const { data: sub } = await supabase.from("subcategories").select("id, category_id").eq("id", parsed.data.subcategoryId).maybeSingle();
    if (sub) {
      categoryId = sub.category_id;
      subcategoryId = sub.id;
    }
  }

  // Kasblar daraxtidan tanlangan bo'lsa — soha/yo'nalish trigger orqali tugundan olinadi
  let professionNodeId: string | null = null;
  if (parsed.data.professionNodeId) {
    const { data: node } = await supabase.from("profession_nodes").select("id, is_active").eq("id", parsed.data.professionNodeId).maybeSingle();
    if (!node?.is_active) return { ok: false, error: "validation" };
    professionNodeId = node.id;
  }
  const custom = !professionNodeId && parsed.data.customProfession && parsed.data.categoryId ? parsed.data.customProfession : null;
  if (custom) categoryId = parsed.data.categoryId ?? null;

  // Ish joyi — kompaniya (yoki ish beruvchi) manzili oldindan qo'yiladi, keyingi qadamda o'zgartirish mumkin
  const place: { region_id: string | null; district_id: string | null; address?: string | null } | null = session.companyId
    ? (await supabase.from("companies").select("region_id, district_id, address").eq("id", session.companyId).maybeSingle()).data
    : (await supabase.from("employer_profiles").select("region_id, district_id").eq("profile_id", session.userId).maybeSingle()).data;

  const id = randomUUID();
  const base = {
    id,
    region_id: place?.region_id ?? null,
    district_id: place?.district_id ?? null,
    ...(place?.address ? { address: place.address } : {}),
    owner_profile_id: session.userId,
    title: parsed.data.title,
    slug: "",
    category_id: categoryId,
    subcategory_id: subcategoryId,
    ...(professionNodeId ? { profession_node_id: professionNodeId } : {}),
    ...(custom ? { custom_profession: custom } : {}),
  };
  let { error } = await supabase.from("vacancies").insert({ ...base, company_id: session.companyId });
  // Kompaniyada faqat "viewer" bo'lsa RLS rad etadi — shaxsiy vakansiya sifatida yaratiladi
  if (error && session.companyId && errorCode(error) === "forbidden") {
    ({ error } = await supabase.from("vacancies").insert({ ...base, company_id: null }));
  }
  if (error) return { ok: false, error: errorCode(error) };
  if (custom) {
    const { error: reqErr } = await supabase.from("custom_occupation_requests").insert({ raw_text: custom, category_id: categoryId, context: "vacancy", vacancy_id: id });
    if (reqErr && reqErr.code !== "23505") console.error("[vacancies] custom occupation", reqErr.message);
  }
  revalidateVacancy(id);
  return { ok: true, data: { id } };
}

// ---------------------------------------------------------------------------
// Qadamni saqlash (autosave)
// ---------------------------------------------------------------------------

/**
 * Bitta qadam ma'lumotini saqlaydi.
 * - active: to'g'ridan-to'g'ri yangilanadi (holat saqlanadi, RLS)
 * - expired: avval set_vacancy_status('draft') (RLS expired holatda update'ga ruxsat bermaydi)
 * - hidden: qulflangan (admin) → vacancy_locked
 * - rejected: tahrirlanadi; qayta e'lon qilinganda moderatsiyaga tushadi
 */
export async function saveStep(input: unknown): Promise<ActionResult<{ status: VacancyStatus; movedToDraft: boolean }>> {
  const parsed = saveStepInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const c = await employerCtx();
  if (!c.ok) return c;
  const { session, supabase } = c.ctx;
  const { vacancyId, payload } = parsed.data;

  const loaded = await loadEditable(supabase, vacancyId);
  if (!loaded.ok) return loaded;
  let status = loaded.vacancy.status;
  let movedToDraft = false;
  if (status === "hidden") return { ok: false, error: "vacancy_locked" };
  if (status === "expired") {
    const { error } = await supabase.rpc("set_vacancy_status", { p_vacancy_id: vacancyId, p_status: "draft" });
    if (error) return { ok: false, error: errorCode(error) };
    status = "draft";
    movedToDraft = true;
  }

  const applied = await applyStep(supabase, loaded.vacancy, payload, session.userId);
  if (!applied.ok) return applied;
  // faol e'lon matni o'zgarsa — qayta tekshiruv (tekshirilmagan matn ommaga chiqmaydi), fonda
  if (status === "active") after(() => runBackgroundTickSafe({ moderation: 3, matchJobs: 10, telegram: 30, budgetMs: 25_000 }));
  revalidateVacancy(vacancyId);
  return { ok: true, data: { status, movedToDraft } };
}

async function applyStep(supabase: SupabaseServerClient, v: EditableVacancy, payload: StepPayload, userId: string): Promise<ActionResult> {
  switch (payload.step) {
    case "title": {
      const patch: VacancyUpdate = { title: payload.data.title };
      if (payload.data.subcategoryId && !v.category_id) {
        const { data: sub } = await supabase.from("subcategories").select("id, category_id").eq("id", payload.data.subcategoryId).maybeSingle();
        if (sub) {
          patch.category_id = sub.category_id;
          patch.subcategory_id = sub.id;
        }
      }
      return updateRow(supabase, v.id, patch);
    }
    case "category": {
      if (payload.data.professionNodeId) {
        // soha va yo'nalish trigger orqali tugundan olinadi
        const { data: node } = await supabase.from("profession_nodes").select("id, is_active").eq("id", payload.data.professionNodeId).maybeSingle();
        if (!node?.is_active) return { ok: false, error: "validation" };
        return updateRow(supabase, v.id, { profession_node_id: node.id });
      }
      let subcategoryId: string | null = null;
      if (payload.data.subcategoryId) {
        const { data: sub } = await supabase.from("subcategories").select("id, category_id").eq("id", payload.data.subcategoryId).maybeSingle();
        if (sub && sub.category_id === payload.data.categoryId) subcategoryId = sub.id;
      }
      const custom = payload.data.customProfession ?? null;
      const row = await updateRow(supabase, v.id, {
        category_id: payload.data.categoryId,
        subcategory_id: subcategoryId,
        ...(custom ? { profession_node_id: null, custom_profession: custom } : {}),
      });
      if (row.ok && custom) {
        const { error: reqErr } = await supabase
          .from("custom_occupation_requests")
          .insert({ raw_text: custom, category_id: payload.data.categoryId, context: "vacancy", vacancy_id: v.id });
        if (reqErr && reqErr.code !== "23505") console.error("[vacancies] custom occupation", reqErr.message);
      }
      return row;
    }
    case "location": {
      const d = payload.data;
      let districtId: string | null = null;
      if (d.districtId && d.regionId) {
        const { data: district } = await supabase.from("districts").select("id, region_id").eq("id", d.districtId).maybeSingle();
        if (district && district.region_id === d.regionId) districtId = district.id;
      }
      return updateRow(supabase, v.id, {
        is_remote: d.isRemote,
        region_id: d.regionId,
        district_id: districtId,
        address: d.address?.trim() || null,
        lat: d.lat,
        lng: d.lng,
      });
    }
    case "salary": {
      const d = payload.data;
      return updateRow(supabase, v.id, { salary_negotiable: d.salaryNegotiable, salary_from: d.salaryFrom, salary_to: d.salaryTo, salary_type: d.salaryType });
    }
    case "schedule": {
      const d = payload.data;
      const learning = d.opportunityType === "internship" || d.opportunityType === "practice" || d.opportunityType === "apprenticeship";
      return updateRow(supabase, v.id, {
        opportunity_type: d.opportunityType,
        is_paid: learning ? d.isPaid : null,
        student_friendly: d.studentFriendly,
        employment_type: d.employmentType,
        schedule: d.schedule,
        work_time_from: d.workTimeFrom,
        work_time_to: d.workTimeTo,
      });
    }
    case "requirements": {
      const d = payload.data;
      const row = await updateRow(supabase, v.id, {
        experience_min_months: d.experienceMinMonths,
        ...(d.positionsCount ? { positions_count: d.positionsCount } : {}),
        age_min: d.ageMin,
        age_max: d.ageMax,
        education_min: d.educationMin,
        gender: d.gender,
      });
      if (!row.ok) return row;
      const del = await supabase.from("vacancy_languages").delete().eq("vacancy_id", v.id);
      if (del.error) return { ok: false, error: errorCode(del.error) };
      const seen = new Set<string>();
      const rows = d.languages.filter((l) => (seen.has(l.code) ? false : (seen.add(l.code), true))).map((l) => ({ vacancy_id: v.id, language_code: l.code, min_level: l.minLevel }));
      if (rows.length) {
        const ins = await supabase.from("vacancy_languages").insert(rows);
        if (ins.error) return { ok: false, error: errorCode(ins.error) };
      }
      return { ok: true };
    }
    case "skills": {
      const del = await supabase.from("vacancy_skills").delete().eq("vacancy_id", v.id);
      if (del.error) return { ok: false, error: errorCode(del.error) };
      const seen = new Set<string>();
      const rows = payload.data.skills.filter((s) => (seen.has(s.skillId) ? false : (seen.add(s.skillId), true))).map((s) => ({ vacancy_id: v.id, skill_id: s.skillId, is_required: s.isRequired }));
      if (rows.length) {
        const ins = await supabase.from("vacancy_skills").insert(rows);
        if (ins.error) return { ok: false, error: errorCode(ins.error) };
      }
      // updated_at yangilansin (ro'yxat tartibi uchun)
      return updateRow(supabase, v.id, { updated_at: new Date().toISOString() });
    }
    case "work_format": {
      const d = payload.data;
      return updateRow(supabase, v.id, { work_format: d.workFormat, official_terms: d.workFormat === "official" ? [...new Set(d.officialTerms)] : [] });
    }
    case "description":
      return updateRow(supabase, v.id, { description: payload.data.description.trim() || null });
    case "benefits": {
      const del = await supabase.from("vacancy_benefits").delete().eq("vacancy_id", v.id);
      if (del.error) return { ok: false, error: errorCode(del.error) };
      const codes = [...new Set(payload.data.benefits)];
      if (codes.length) {
        const ins = await supabase.from("vacancy_benefits").insert(codes.map((code) => ({ vacancy_id: v.id, benefit_code: code })));
        if (ins.error) return { ok: false, error: errorCode(ins.error) };
      }
      return updateRow(supabase, v.id, { updated_at: new Date().toISOString() });
    }
    default: {
      // userId hozircha faqat audit uchun (kelajakda o'zgarish tarixi)
      void userId;
      return { ok: false, error: "validation" };
    }
  }
}

// ---------------------------------------------------------------------------
// Holat: e'lon qilish / to'xtatish / yopish / qoralama
// ---------------------------------------------------------------------------

/** publish_vacancy RPC → 'active' yoki 'pending_review' (moderatsiya / rad etilgandan keyin) */
export async function publishVacancy(input: unknown): Promise<ActionResult<{ status: VacancyStatus }>> {
  const parsed = vacancyIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const c = await employerCtx();
  if (!c.ok) return c;
  const { data, error } = await c.ctx.supabase.rpc("publish_vacancy", { p_vacancy_id: parsed.data.vacancyId });
  if (error) return { ok: false, error: errorCode(error) };
  let status = data;
  // majburiy moderatsiya: darhol (vaqt cheklangan) tekshiruv, ulgurmasa — fon navbati
  if (status === "pending_review" && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    await moderateNow("vacancy", parsed.data.vacancyId, 12_000).catch(() => null);
    const { data: fresh } = await c.ctx.supabase.from("vacancies").select("status").eq("id", parsed.data.vacancyId).maybeSingle();
    if (fresh) status = fresh.status;
  }
  after(() => runBackgroundTickSafe({ moderation: 3, matchJobs: 10, telegram: 50, budgetMs: 25_000 }));
  revalidateVacancy(parsed.data.vacancyId);
  return { ok: true, data: { status } };
}

/** set_vacancy_status RPC (paused | closed | draft). Natijaviy holat qayta o'qiladi. */
export async function setVacancyStatus(input: unknown): Promise<ActionResult<{ status: VacancyStatus }>> {
  const parsed = statusChangeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const c = await employerCtx();
  if (!c.ok) return c;
  const { supabase } = c.ctx;
  const { error } = await supabase.rpc("set_vacancy_status", { p_vacancy_id: parsed.data.vacancyId, p_status: parsed.data.status });
  if (error) return { ok: false, error: errorCode(error) };
  const { data } = await supabase.from("vacancies").select("status").eq("id", parsed.data.vacancyId).maybeSingle();
  if (!data) return { ok: false, error: "not_found" };
  if (data.status !== parsed.data.status) return { ok: false, error: "invalid_status" };
  revalidateVacancy(parsed.data.vacancyId);
  return { ok: true, data: { status: data.status } };
}

// ---------------------------------------------------------------------------
// Nusxa olish / o'chirish
// ---------------------------------------------------------------------------

/** Yangi qoralama sifatida nusxa: barcha maydonlar + ko'nikma/til/imkoniyatlar */
export async function duplicateVacancy(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = vacancyIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const c = await employerCtx();
  if (!c.ok) return c;
  const { session, supabase } = c.ctx;

  const { data: v, error } = await supabase
    .from("vacancies")
    .select("*, vacancy_skills(skill_id, is_required), vacancy_languages(language_code, min_level), vacancy_benefits(benefit_code)")
    .eq("id", parsed.data.vacancyId)
    .maybeSingle();
  if (error) return { ok: false, error: errorCode(error) };
  if (!v) return { ok: false, error: "not_found" };
  const { data: canView } = await supabase.rpc("manages_vacancy", { p_vacancy_id: v.id });
  if (!canView) return { ok: false, error: "not_found" };

  const id = randomUUID();
  // Admin/hisob maydonlari (is_featured, requires_review, moderation_note, published_at, expires_at, hisoblagichlar) default qoladi
  const base = {
    id,
    owner_profile_id: session.userId,
    title: v.title,
    slug: "",
    category_id: v.category_id,
    subcategory_id: v.subcategory_id,
    description: v.description,
    region_id: v.region_id,
    district_id: v.district_id,
    address: v.address,
    lat: v.lat,
    lng: v.lng,
    is_remote: v.is_remote,
    salary_from: v.salary_from,
    salary_to: v.salary_to,
    salary_type: v.salary_type,
    salary_negotiable: v.salary_negotiable,
    employment_type: v.employment_type,
    schedule: v.schedule,
    work_time_from: v.work_time_from,
    work_time_to: v.work_time_to,
    experience_min_months: v.experience_min_months,
    age_min: v.age_min,
    age_max: v.age_max,
    education_min: v.education_min,
    gender: v.gender,
    work_format: v.work_format,
    official_terms: v.official_terms,
  };
  let ins = await supabase.from("vacancies").insert({ ...base, company_id: v.company_id });
  if (ins.error && v.company_id && errorCode(ins.error) === "forbidden") {
    ins = await supabase.from("vacancies").insert({ ...base, company_id: null });
  }
  if (ins.error) return { ok: false, error: errorCode(ins.error) };

  if (v.vacancy_skills.length) {
    const r = await supabase.from("vacancy_skills").insert(v.vacancy_skills.map((s) => ({ vacancy_id: id, skill_id: s.skill_id, is_required: s.is_required })));
    if (r.error) return { ok: false, error: errorCode(r.error) };
  }
  if (v.vacancy_languages.length) {
    const r = await supabase.from("vacancy_languages").insert(v.vacancy_languages.map((l) => ({ vacancy_id: id, language_code: l.language_code, min_level: l.min_level })));
    if (r.error) return { ok: false, error: errorCode(r.error) };
  }
  if (v.vacancy_benefits.length) {
    const r = await supabase.from("vacancy_benefits").insert(v.vacancy_benefits.map((b) => ({ vacancy_id: id, benefit_code: b.benefit_code })));
    if (r.error) return { ok: false, error: errorCode(r.error) };
  }
  revalidateVacancy(id);
  return { ok: true, data: { id } };
}

/** O'chirish: RLS faqat draft/closed/expired/rejected va arizasiz vakansiyaga ruxsat beradi */
export async function deleteVacancy(input: unknown): Promise<ActionResult> {
  const parsed = vacancyIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const c = await employerCtx();
  if (!c.ok) return c;
  const { data, error } = await c.ctx.supabase.from("vacancies").delete().eq("id", parsed.data.vacancyId).select("id");
  if (error) return { ok: false, error: errorCode(error) };
  if (!data.length) return { ok: false, error: "cannot_delete" };
  revalidateVacancy(parsed.data.vacancyId);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Ko'nikmalar: foydalanuvchi qo'shgan (moderatsiya kutadi)
// ---------------------------------------------------------------------------

function slugifyLatin(input: string): string {
  return input
    .toLowerCase()
    .replace(/[ʻʼ'’`]/g, "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

/** PostgREST filtr qiymatlaridagi maxsus belgilarni olib tashlash */

export interface CustomSkillResult {
  id: string;
  name_uz: string;
  name_ru: string;
  existed: boolean;
}

/** Mavjud ko'nikma bo'lsa uni qaytaradi, aks holda is_custom/is_approved=false bilan yaratadi */
export async function addCustomSkill(input: unknown): Promise<ActionResult<CustomSkillResult>> {
  const parsed = customSkillSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const c = await employerCtx();
  if (!c.ok) return c;
  const { session, supabase } = c.ctx;
  const name = parsed.data.name;

  const needle = safeFilterValue(name);
  if (needle) {
    const { data: existing } = await supabase
      .from("skills")
      .select("id, name_uz, name_ru")
      .or(`name_uz.ilike.${needle},name_ru.ilike.${needle}`)
      .limit(1)
      .maybeSingle();
    if (existing) return { ok: true, data: { ...existing, existed: true } };
  }

  const slug = `custom-${slugifyLatin(name) || "skill"}-${randomUUID().slice(0, 6)}`;
  const { data, error } = await supabase
    .from("skills")
    .insert({ slug, name_uz: name, name_ru: name, category_id: parsed.data.categoryId, is_custom: true, is_approved: false, created_by: session.userId })
    .select("id, name_uz, name_ru")
    .single();
  if (error) return { ok: false, error: errorCode(error) };
  return { ok: true, data: { ...data, existed: false } };
}
