"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { errorCode } from "@/lib/utils";
import { publicEnv } from "@/lib/env";
import { getSession, type SessionContext } from "@/features/auth/session";
import type { ActionResult } from "@/features/auth/actions";
import type { TablesInsert, TablesUpdate } from "@/types/database.types";
import {
  acceptInviteSchema,
  companySchema,
  completeCompanyOnboardingSchema,
  createInviteSchema,
  deleteInviteSchema,
  employerDraftSchema,
  employerTypeSchema,
  inviteLink,
  isValidDocumentPath,
  isValidLogoPath,
  personSchema,
  removeMemberSchema,
  saveCompanyLogoSchema,
  setMemberRoleSchema,
  updateCompanySchema,
  verificationRequestSchema,
  COMPANY_VERIFICATION_TYPES,
  type CompanyFormValues,
} from "./schema";

/** Ish beruvchi moduli: server action'lar (zod → supabase → ActionResult). RLS oxirgi himoya. */

type Fail = { ok: false; error: string };

async function requireActionSession(): Promise<{ session: SessionContext } | Fail> {
  const session = await getSession();
  if (!session) return { ok: false, error: "not_authenticated" };
  if (session.profile.is_blocked) return { ok: false, error: "blocked" };
  return { session };
}

function companyColumns(v: CompanyFormValues): Omit<TablesUpdate<"companies">, "id" | "created_by" | "verification_status" | "verified_at" | "is_blocked" | "slug" | "logo_url"> {
  return {
    name: v.name,
    phone: v.phone,
    telegram: v.telegram,
    website: v.website,
    instagram: v.instagram,
    address: v.address,
    region_id: v.regionId,
    district_id: v.districtId,
    industry_category_id: v.industryCategoryId,
    about: v.about,
    size: v.size,
    tin: v.tin,
  };
}

function revalidateEmployer(slug?: string | null) {
  revalidatePath("/employer");
  revalidatePath("/company/settings");
  if (slug) revalidatePath(`/company/${slug}`);
}

// ---------- onboarding ----------

/** 1-qadam: ish beruvchi turini darhol saqlash (autosave) */
export async function saveEmployerType(input: unknown): Promise<ActionResult> {
  const parsed = employerTypeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const auth = await requireActionSession();
  if ("ok" in auth) return auth;
  const supabase = await createClient();
  const row: TablesInsert<"employer_profiles"> = {
    profile_id: auth.session.userId,
    employer_type: parsed.data.employerType,
    employer_type_note: parsed.data.employerType === "other" ? parsed.data.note || null : null,
  };
  const { error } = await supabase.from("employer_profiles").upsert(row, { onConflict: "profile_id" });
  if (error) return { ok: false, error: errorCode(error) };
  return { ok: true };
}

/** Qadamlar orasida qoralama: umumiy maydonlarni employer_profiles ga yozish */
export async function saveEmployerDraft(input: unknown): Promise<ActionResult> {
  const parsed = employerDraftSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const auth = await requireActionSession();
  if ("ok" in auth) return auth;
  const supabase = await createClient();
  const d = parsed.data;
  const { error } = await supabase
    .from("employer_profiles")
    .update({ display_name: d.displayName, contact_phone: d.contactPhone, region_id: d.regionId, district_id: d.districtId, about: d.about })
    .eq("profile_id", auth.session.userId);
  if (error) return { ok: false, error: errorCode(error) };
  return { ok: true };
}

/** 2a-qadam: kompaniya/YaTT — kompaniya yaratish + profilni yakunlash */
export async function completeCompanyOnboarding(input: unknown): Promise<ActionResult<{ companyId: string; slug: string }>> {
  const parsed = completeCompanyOnboardingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const auth = await requireActionSession();
  if ("ok" in auth) return auth;
  const { userId, companyId: existingCompanyId } = auth.session;
  const v = parsed.data;
  const supabase = await createClient();

  // 1) employer_profiles mavjudligini ta'minlash (trigger kompaniyani shu yozuvga bog'laydi)
  const profileRow: TablesInsert<"employer_profiles"> = {
    profile_id: userId,
    employer_type: v.employerType,
    display_name: v.name,
    contact_phone: v.phone,
    region_id: v.regionId,
    district_id: v.districtId,
    about: v.about,
  };
  const { error: epErr } = await supabase.from("employer_profiles").upsert(profileRow, { onConflict: "profile_id" });
  if (epErr) return { ok: false, error: errorCode(epErr) };

  // 2) kompaniya: bor bo'lsa yangilash (qayta urinish), bo'lmasa yaratish
  let companyId = existingCompanyId;
  let slug: string;
  if (companyId) {
    const { data, error } = await supabase.from("companies").update(companyColumns(v)).eq("id", companyId).select("id, slug").maybeSingle();
    if (error) return { ok: false, error: errorCode(error) };
    if (!data) return { ok: false, error: "forbidden" };
    slug = data.slug;
  } else {
    const insert: TablesInsert<"companies"> = { ...companyColumns(v), name: v.name, slug: "", created_by: userId, is_government: v.employerType === "government" }; // slug: trigger yaratadi
    const { data, error } = await supabase.from("companies").insert(insert).select("id, slug").single();
    if (error) return { ok: false, error: errorCode(error) };
    companyId = data.id;
    slug = data.slug;
  }

  // 3) profilni yakunlash (trigger employer_type ni 'company' qiladi — YaTT ni qaytaramiz)
  const { error: doneErr } = await supabase
    .from("employer_profiles")
    .update({ employer_type: v.employerType, company_id: companyId, onboarding_completed_at: new Date().toISOString() })
    .eq("profile_id", userId);
  if (doneErr) return { ok: false, error: errorCode(doneErr) };

  const { error: roleErr } = await supabase.from("profiles").update({ active_role: "employer" }).eq("id", userId);
  if (roleErr) console.error("[employer] active_role", roleErr.message);

  revalidateEmployer(slug);
  revalidatePath("/");
  return { ok: true, data: { companyId, slug } };
}

/** 2b-qadam: oddiy shaxs — profilni yakunlash */
export async function completePersonOnboarding(input: unknown): Promise<ActionResult> {
  const parsed = personSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const auth = await requireActionSession();
  if ("ok" in auth) return auth;
  const { userId } = auth.session;
  const d = parsed.data;
  const supabase = await createClient();
  const row: TablesInsert<"employer_profiles"> = {
    profile_id: userId,
    employer_type: d.employerType ?? "person",
    display_name: d.displayName,
    contact_phone: d.contactPhone,
    region_id: d.regionId,
    district_id: d.districtId,
    about: d.about,
    onboarding_completed_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("employer_profiles").upsert(row, { onConflict: "profile_id" });
  if (error) return { ok: false, error: errorCode(error) };
  const { error: roleErr } = await supabase.from("profiles").update({ active_role: "employer" }).eq("id", userId);
  if (roleErr) console.error("[employer] active_role", roleErr.message);
  revalidateEmployer();
  revalidatePath("/");
  return { ok: true };
}

// ---------- kompaniya ----------

/** Logotip: client yuklagan yo'lni public URL ga aylantirib saqlash (null → o'chirish) */
export async function saveCompanyLogo(input: unknown): Promise<ActionResult<{ logoUrl: string | null }>> {
  const parsed = saveCompanyLogoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const auth = await requireActionSession();
  if ("ok" in auth) return auth;
  const { companyId, path } = parsed.data;
  if (path !== null && !isValidLogoPath(companyId, path)) return { ok: false, error: "invalid_path" };
  const supabase = await createClient();
  let logoUrl: string | null = null;
  if (path) {
    const { data } = supabase.storage.from("company-logos").getPublicUrl(path);
    logoUrl = `${data.publicUrl}?v=${Date.now()}`;
  }
  const { data, error } = await supabase.from("companies").update({ logo_url: logoUrl }).eq("id", companyId).select("slug").maybeSingle();
  if (error) return { ok: false, error: errorCode(error) };
  if (!data) return { ok: false, error: "forbidden" };
  if (!path) {
    // eski fayllarni tozalash (best-effort)
    const { data: files } = await supabase.storage.from("company-logos").list(companyId);
    if (files?.length) await supabase.storage.from("company-logos").remove(files.map((f) => `${companyId}/${f.name}`));
  }
  revalidateEmployer(data.slug);
  return { ok: true, data: { logoUrl } };
}

export async function updateCompany(input: unknown): Promise<ActionResult<{ slug: string }>> {
  const parsed = updateCompanySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const auth = await requireActionSession();
  if ("ok" in auth) return auth;
  const { companyId, ...values } = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.from("companies").update(companyColumns(values)).eq("id", companyId).select("slug").maybeSingle();
  if (error) return { ok: false, error: errorCode(error) };
  if (!data) return { ok: false, error: "not_admin" };
  revalidateEmployer(data.slug);
  return { ok: true, data: { slug: data.slug } };
}

/** Shaxs/YaTT profili (kompaniyasiz) */
export async function updateEmployerProfile(input: unknown): Promise<ActionResult> {
  const parsed = personSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const auth = await requireActionSession();
  if ("ok" in auth) return auth;
  const d = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("employer_profiles")
    .update({ display_name: d.displayName, contact_phone: d.contactPhone, region_id: d.regionId, district_id: d.districtId, about: d.about })
    .eq("profile_id", auth.session.userId)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: errorCode(error) };
  if (!data) return { ok: false, error: "forbidden" };
  revalidateEmployer();
  return { ok: true };
}

/** Mavjud ish beruvchi (shaxs/YaTT) uchun kompaniya yaratish — trigger owner qiladi va profilga bog'laydi */
export async function createCompanyForEmployer(input: unknown): Promise<ActionResult<{ companyId: string; slug: string }>> {
  const parsed = companySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const auth = await requireActionSession();
  if ("ok" in auth) return auth;
  const { userId, companyId: existing, employerId } = auth.session;
  if (existing) return { ok: false, error: "company_exists" };
  if (!employerId) return { ok: false, error: "forbidden" };
  const v = parsed.data;
  const supabase = await createClient();
  // Trigger employer_type ni 'company' qiladi; YaTT / davlat tashkiloti bo'lsa turini saqlab qolamiz
  const { data: ep } = await supabase.from("employer_profiles").select("employer_type").eq("profile_id", userId).maybeSingle();
  const keepType = ep?.employer_type === "individual_entrepreneur" || ep?.employer_type === "government" ? ep.employer_type : "company";
  const insert: TablesInsert<"companies"> = { ...companyColumns(v), name: v.name, slug: "", created_by: userId, is_government: keepType === "government" }; // slug: trigger yaratadi
  const { data, error } = await supabase.from("companies").insert(insert).select("id, slug").single();
  if (error) return { ok: false, error: errorCode(error) };
  const { error: epErr } = await supabase.from("employer_profiles").update({ company_id: data.id, employer_type: keepType }).eq("profile_id", userId);
  if (epErr) console.error("[employer] link company", epErr.message);
  revalidateEmployer(data.slug);
  return { ok: true, data: { companyId: data.id, slug: data.slug } };
}

// ---------- a'zolar va takliflar ----------

export async function setMemberRole(input: unknown): Promise<ActionResult> {
  const parsed = setMemberRoleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const auth = await requireActionSession();
  if ("ok" in auth) return auth;
  const { companyId, profileId, role } = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.from("company_members").update({ role }).eq("company_id", companyId).eq("profile_id", profileId).select("profile_id").maybeSingle();
  if (error) return { ok: false, error: errorCode(error) };
  if (!data) return { ok: false, error: "not_admin" };
  revalidatePath("/company/settings");
  return { ok: true };
}

export async function removeMember(input: unknown): Promise<ActionResult> {
  const parsed = removeMemberSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const auth = await requireActionSession();
  if ("ok" in auth) return auth;
  const { companyId, profileId } = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.from("company_members").delete().eq("company_id", companyId).eq("profile_id", profileId).select("profile_id").maybeSingle();
  if (error) return { ok: false, error: errorCode(error) };
  if (!data) return { ok: false, error: "not_admin" };
  revalidatePath("/company/settings");
  return { ok: true };
}

export async function createCompanyInvite(input: unknown): Promise<ActionResult<{ id: string; token: string; link: string; expiresAt: string }>> {
  const parsed = createInviteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const auth = await requireActionSession();
  if ("ok" in auth) return auth;
  const { companyId, role } = parsed.data;
  const supabase = await createClient();
  const insert: TablesInsert<"company_invites"> = { company_id: companyId, invited_by: auth.session.userId, role };
  const { data, error } = await supabase.from("company_invites").insert(insert).select("id, token, expires_at").single();
  if (error) return { ok: false, error: errorCode(error) === "forbidden" ? "not_admin" : errorCode(error) };
  revalidatePath("/company/settings");
  return { ok: true, data: { id: data.id, token: data.token, link: inviteLink(publicEnv.NEXT_PUBLIC_APP_URL, data.token), expiresAt: data.expires_at } };
}

export async function deleteCompanyInvite(input: unknown): Promise<ActionResult> {
  const parsed = deleteInviteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const auth = await requireActionSession();
  if ("ok" in auth) return auth;
  const { companyId, inviteId } = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.from("company_invites").delete().eq("company_id", companyId).eq("id", inviteId).select("id").maybeSingle();
  if (error) return { ok: false, error: errorCode(error) };
  if (!data) return { ok: false, error: "not_admin" };
  revalidatePath("/company/settings");
  return { ok: true };
}

/** Taklif havolasini qabul qilish (RPC a'zo + employer_profiles yaratadi) */
export async function acceptCompanyInvite(input: unknown): Promise<ActionResult<{ companyId: string }>> {
  const parsed = acceptInviteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invite_invalid" };
  const auth = await requireActionSession();
  if ("ok" in auth) return auth;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_company_invite", { p_token: parsed.data.token });
  if (error) return { ok: false, error: errorCode(error) };
  if (!data) return { ok: false, error: "invite_invalid" };
  const { error: roleErr } = await supabase.from("profiles").update({ active_role: "employer" }).eq("id", auth.session.userId);
  if (roleErr) console.error("[employer] active_role", roleErr.message);
  revalidateEmployer();
  revalidatePath("/");
  return { ok: true, data: { companyId: data } };
}

// ---------- tasdiqlash ----------

export async function submitVerificationRequest(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = verificationRequestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const auth = await requireActionSession();
  if ("ok" in auth) return auth;
  const { userId } = auth.session;
  const { companyId, type, note, documentPaths } = parsed.data;
  const isCompanyType = (COMPANY_VERIFICATION_TYPES as readonly string[]).includes(type);
  if ((companyId && !isCompanyType) || (!companyId && type !== "identity")) return { ok: false, error: "validation" };
  if (documentPaths.some((p) => !isValidDocumentPath(userId, p))) return { ok: false, error: "invalid_path" };

  const supabase = await createClient();
  let pendingQ = supabase.from("verification_requests").select("id", { count: "exact", head: true }).eq("profile_id", userId).eq("status", "pending");
  pendingQ = companyId ? pendingQ.eq("company_id", companyId) : pendingQ.is("company_id", null);
  const { count } = await pendingQ;
  if (count) return { ok: false, error: "already_pending" };

  const insert: TablesInsert<"verification_requests"> = { profile_id: userId, company_id: companyId, type, note, document_paths: documentPaths };
  const { data, error } = await supabase.from("verification_requests").insert(insert).select("id").single();
  if (error) return { ok: false, error: errorCode(error) === "forbidden" ? "not_admin" : errorCode(error) };
  revalidatePath("/company/settings");
  return { ok: true, data: { id: data.id } };
}
