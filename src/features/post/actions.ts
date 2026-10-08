"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/features/auth/session";
import type { ActionResult } from "@/features/auth/actions";
import { errorCode } from "@/lib/utils";
import { ensureProfessionImagesSafe } from "@/lib/profession-images/server";
import { experienceToLevel, type VacancyPublishState, type WorkerPublishState } from "./types";
import { vacancyListingSchema, workerListingSchema } from "./schema";

/**
 * Ishchi e'lonini saqlash va joylash (bitta tranzaksiya — `save_simple_worker_listing`).
 * Natija haqiqiy holat bilan qaytadi: "listed" (qidiruvda), "payment_required" (saqlandi, to'lov kerak).
 */
export async function publishWorkerListing(input: unknown): Promise<ActionResult<{ state: WorkerPublishState; workerId: string }>> {
  const parsed = workerListingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const session = await getSession();
  if (!session) return { ok: false, error: "not_authenticated" };
  if (session.profile.is_blocked) return { ok: false, error: "blocked" };
  const v = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_simple_worker_listing", {
    p: {
      profession_node_id: v.professionNodeId,
      headline: v.headline ?? null,
      region_id: v.regionId,
      district_id: v.districtId,
      remote: v.remoteOk,
      first_name: v.firstName,
      last_name: v.lastName,
      about: v.about,
      experience_level: experienceToLevel(v.experience),
      salary_expected: v.salary,
      schedule: v.schedule,
      show_phone: v.showPhone,
    },
  });
  if (error || !data) return { ok: false, error: errorCode(error) };
  const res = data as { worker_id: string; state: WorkerPublishState };
  after(() => ensureProfessionImagesSafe([v.professionNodeId], 1));
  revalidatePath("/", "layout");
  return { ok: true, data: { state: res.state, workerId: res.worker_id } };
}

/**
 * Ish beruvchi e'lonini saqlash va joylash (`save_simple_vacancy`). clientRef bir xil bo'lsa — o'sha e'lon yangilanadi
 * (ikki marta bosish yoki tarmoqda qayta yuborish ikkinchi e'lon yaratmaydi).
 */
export async function publishVacancyListing(input: unknown): Promise<ActionResult<{ state: VacancyPublishState; vacancyId: string; slug: string }>> {
  const parsed = vacancyListingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const session = await getSession();
  if (!session) return { ok: false, error: "not_authenticated" };
  if (session.profile.is_blocked) return { ok: false, error: "blocked" };
  const v = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_simple_vacancy", {
    p: {
      vacancy_id: v.vacancyId,
      client_ref: v.clientRef,
      profession_node_id: v.professionNodeId,
      title: v.title,
      region_id: v.regionId,
      district_id: v.districtId,
      remote: v.remote,
      employer_type: v.employerType,
      org_name: v.orgName,
      contact_phone: v.phone,
      show_phone: v.showPhone,
      description: v.description,
      salary_negotiable: v.negotiable,
      salary_from: v.salaryFrom,
      salary_to: v.salaryTo,
      schedule: v.schedule,
      experience_min_months: v.experienceMonths,
    },
  });
  if (error || !data) return { ok: false, error: errorCode(error) };
  const res = data as { vacancy_id: string; slug: string; state: VacancyPublishState };
  after(() => ensureProfessionImagesSafe([v.professionNodeId], 1));
  revalidatePath("/", "layout");
  return { ok: true, data: { state: res.state, vacancyId: res.vacancy_id, slug: res.slug } };
}

/** "Ish topdim": e'lon qidiruvdan olinadi (keyin qayta joylash mumkin) */
export async function markFoundJob(): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "not_authenticated" };
  if (!session.workerId) return { ok: false, error: "forbidden" };
  const supabase = await createClient();
  const { error } = await supabase.from("worker_profiles").update({ status: "not_looking", is_public: false }).eq("id", session.workerId);
  if (error) return { ok: false, error: errorCode(error) };
  revalidatePath("/", "layout");
  return { ok: true };
}

/** "Ishchi topdim": vakansiya yopiladi va qidiruvdan chiqadi */
export async function markFoundWorker(input: unknown): Promise<ActionResult> {
  const parsed = z.object({ vacancyId: z.uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const session = await getSession();
  if (!session) return { ok: false, error: "not_authenticated" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_vacancy_status", { p_vacancy_id: parsed.data.vacancyId, p_status: "closed" });
  if (error) return { ok: false, error: errorCode(error) };
  revalidatePath("/", "layout");
  return { ok: true };
}
