import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { SessionContext } from "@/features/auth/session";
import { getProfessionTrail } from "@/features/professions/queries";
import type { PickedProfession } from "@/features/professions/types";
import { levelToExperience, toSimpleEmployerType, type PostViewer, type VacancyDraft, type WorkerDraft, type VacancyExperience } from "./types";

async function picked(nodeId: string | null, categoryId: string | null): Promise<PickedProfession | null> {
  if (!nodeId || !categoryId) return null;
  const trail = await getProfessionTrail(nodeId);
  return trail.length ? { id: nodeId, categoryId, trail } : null;
}

export async function getPostViewer(session: SessionContext | null): Promise<PostViewer> {
  if (!session) return { loggedIn: false, phone: null, phoneVerified: false, firstName: "", lastName: "" };
  const supabase = await createClient();
  const { data } = await supabase.from("profile_contacts").select("phone, phone_verified_at").eq("profile_id", session.userId).maybeSingle();
  return {
    loggedIn: true,
    phone: data?.phone ?? null,
    phoneVerified: !!data?.phone_verified_at,
    firstName: session.profile.first_name ?? "",
    lastName: session.profile.last_name ?? "",
  };
}

/** Mavjud ishchi e'loni (bo'lsa) — formani oldindan to'ldirish uchun */
export async function getWorkerPrefill(session: SessionContext | null): Promise<{ draft: Partial<WorkerDraft>; existing: boolean }> {
  if (!session) return { draft: {}, existing: false };
  const base: Partial<WorkerDraft> = { firstName: session.profile.first_name ?? "", lastName: session.profile.last_name ?? "" };
  if (!session.workerId) return { draft: base, existing: false };
  const supabase = await createClient();
  const [{ data: w }, { data: pref }, { data: contact }] = await Promise.all([
    supabase
      .from("worker_profiles")
      .select("profession_node_id, category_id, region_id, district_id, about, experience_level, remote_preference, onboarding_completed_at")
      .eq("id", session.workerId)
      .maybeSingle(),
    supabase.from("worker_preferences").select("salary_expected, schedules").eq("worker_id", session.workerId).maybeSingle(),
    supabase.from("profile_contacts").select("phone_visibility").eq("profile_id", session.userId).maybeSingle(),
  ]);
  if (!w) return { draft: base, existing: false };
  const profession = await picked(w.profession_node_id, w.category_id);
  const schedule = pref?.schedules?.[0];
  return {
    existing: !!w.onboarding_completed_at,
    draft: {
      ...base,
      profession,
      place: { regionId: w.region_id, districtId: w.district_id, districtChosen: !!w.region_id, remote: false },
      remoteOk: w.remote_preference === "yes",
      about: w.about ?? "",
      experience: w.onboarding_completed_at ? levelToExperience(w.experience_level) : null,
      salary: pref?.salary_expected ? String(pref.salary_expected) : "",
      schedule: schedule && schedule !== "negotiable" ? schedule : "",
      showPhone: contact?.phone_visibility === "everyone",
    },
  };
}

/** Ish beruvchi sifatida avval kiritilgan ma'lumotlar (nom, tur, telefon) */
export async function getEmployerDefaults(session: SessionContext | null): Promise<Partial<VacancyDraft>> {
  if (!session) return {};
  const supabase = await createClient();
  const [{ data: ep }, { data: contact }] = await Promise.all([
    supabase.from("employer_profiles").select("employer_type, display_name, contact_phone, company_id, companies(name, phone)").eq("profile_id", session.userId).maybeSingle(),
    supabase.from("profile_contacts").select("phone").eq("profile_id", session.userId).maybeSingle(),
  ]);
  const company = ep?.companies as { name: string; phone: string | null } | null | undefined;
  const type = toSimpleEmployerType(ep?.employer_type);
  return {
    employerType: type,
    orgName: (type === "person" ? ep?.display_name : company?.name ?? ep?.display_name) ?? "",
    phone: ep?.contact_phone ?? company?.phone ?? contact?.phone ?? "",
  };
}

/** Tahrirlash uchun vakansiya (faqat tahrirlash huquqi bor foydalanuvchiga) */
export async function getVacancyPrefill(session: SessionContext, vacancyId: string): Promise<Partial<VacancyDraft> | null> {
  const supabase = await createClient();
  const { data: canEdit } = await supabase.rpc("can_edit_vacancy", { p_vacancy_id: vacancyId });
  if (!canEdit) return null;
  const [{ data: v }, { data: contact }, defaults] = await Promise.all([
    supabase
      .from("vacancies")
      .select("id, title, profession_node_id, category_id, region_id, district_id, is_remote, description, salary_from, salary_to, salary_negotiable, schedule, experience_min_months, status, client_ref")
      .eq("id", vacancyId)
      .maybeSingle(),
    supabase.from("vacancy_contacts").select("phone, show_phone").eq("vacancy_id", vacancyId).maybeSingle(),
    getEmployerDefaults(session),
  ]);
  if (!v || v.status === "hidden") return null;
  const profession = await picked(v.profession_node_id, v.category_id);
  const exp: VacancyExperience = v.experience_min_months >= 36 ? 36 : v.experience_min_months >= 12 ? 12 : 0;
  return {
    ...defaults,
    editId: v.id,
    clientRef: v.client_ref ?? crypto.randomUUID(),
    profession,
    title: profession && profession.trail.at(-1)?.name_uz === v.title ? "" : v.title,
    place: { regionId: v.region_id, districtId: v.district_id, districtChosen: v.is_remote || !!v.region_id, remote: v.is_remote },
    description: v.description ?? "",
    negotiable: v.salary_negotiable,
    salaryFrom: v.salary_from ? String(v.salary_from) : "",
    salaryTo: v.salary_to ? String(v.salary_to) : "",
    schedule: v.schedule !== "negotiable" ? v.schedule : "",
    experienceMonths: exp,
    phone: contact?.phone ?? defaults.phone ?? "",
    showPhone: contact?.show_phone ?? false,
  };
}

/** E'lon muddati (kun) — natija ekranidagi matn uchun */
export async function getListingDays(): Promise<{ worker: number; vacancy: number }> {
  const supabase = await createClient();
  const { data } = await supabase.from("app_settings").select("key, value").in("key", ["listing_days", "vacancy_lifetime_days"]);
  const get = (k: string, d: number) => Number(data?.find((r) => r.key === k)?.value ?? d) || d;
  return { worker: get("listing_days", 10), vacancy: get("vacancy_lifetime_days", 10) };
}
