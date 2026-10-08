"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/features/auth/session";
import type { ActionResult } from "@/features/auth/actions";
import { errorCode } from "@/lib/utils";
import { ensureProfessionImagesSafe } from "@/lib/profession-images/server";
import { allowRate } from "@/lib/rate-limit";
import { moderateNow } from "@/features/moderation/service";
import { runBackgroundTickSafe } from "@/features/notifications/tick";
import { trackServer } from "@/features/analytics/server";
import { experienceToLevel, toListingStateInfo, type ListingStateInfo } from "./types";
import { vacancyListingSchema, workerListingSchema } from "./schema";

type Entity = "vacancy" | "worker";

/**
 * Joylashdan keyin: tekshiruv kutilayotgan bo'lsa — darhol (vaqt cheklangan) moderatsiya, so'ng haqiqiy holat.
 * Ulgurmasa e'lon "tekshiruvda" qoladi va fon navbati davom ettiradi. Matching va Telegram — fonda (after).
 */
async function settle(entity: Entity, id: string, state: string): Promise<ListingStateInfo> {
  const supabase = await createClient();
  if (state === "moderation_pending" && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    await moderateNow(entity, id, 12_000).catch(() => null);
  }
  const { data } = await supabase.rpc("my_listing_state", { p_entity: entity, p_id: id });
  return data ? toListingStateInfo(data) : toListingStateInfo({ state });
}

/**
 * Ishchi e'lonini saqlash va joylash (bitta tranzaksiya — `save_simple_worker_listing`), so'ng majburiy moderatsiya.
 * Natija haqiqiy holat bilan qaytadi: listed / moderation_pending / review / rejected (sabab va maydon) / payment_required.
 */
export async function publishWorkerListing(input: unknown): Promise<ActionResult<ListingStateInfo & { workerId: string }>> {
  const parsed = workerListingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const session = await getSession();
  if (!session) return { ok: false, error: "not_authenticated" };
  if (session.profile.is_blocked) return { ok: false, error: "blocked" };
  if (!(await allowRate(`publish:${session.userId}`, 20, 3600))) return { ok: false, error: "rate_limited" };
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
  const res = data as { worker_id: string; state: string };
  const info = await settle("worker", res.worker_id, res.state);
  after(async () => {
    await trackServer("post_publish", session.userId, { entity: "worker", source: v.source ?? "manual", state: info.state });
    await ensureProfessionImagesSafe([v.professionNodeId], 1);
    await runBackgroundTickSafe({ moderation: 3, matchJobs: 10, telegram: 50, budgetMs: 25_000 });
  });
  revalidatePath("/", "layout");
  return { ok: true, data: { ...info, workerId: res.worker_id } };
}

/**
 * Ish beruvchi e'lonini saqlash va joylash (`save_simple_vacancy`). clientRef bir xil bo'lsa — o'sha e'lon yangilanadi
 * (ikki marta bosish yoki tarmoqda qayta yuborish ikkinchi e'lon yaratmaydi). So'ng majburiy moderatsiya va
 * ish beruvchi darvozasi (birinchi vakansiya admin tasdig'idan keyin chiqadi).
 */
export async function publishVacancyListing(input: unknown): Promise<ActionResult<ListingStateInfo & { vacancyId: string; slug: string }>> {
  const parsed = vacancyListingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const session = await getSession();
  if (!session) return { ok: false, error: "not_authenticated" };
  if (session.profile.is_blocked) return { ok: false, error: "blocked" };
  if (!(await allowRate(`publish:${session.userId}`, 20, 3600))) return { ok: false, error: "rate_limited" };
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
      photo_path: v.photoPath ?? null,
    },
  });
  if (error || !data) return { ok: false, error: errorCode(error) };
  const res = data as { vacancy_id: string; slug: string; state: string };
  const info = await settle("vacancy", res.vacancy_id, res.state);
  after(async () => {
    await trackServer("post_publish", session.userId, { entity: "vacancy", source: v.source ?? "manual", state: info.state });
    await ensureProfessionImagesSafe([v.professionNodeId], 1);
    await runBackgroundTickSafe({ moderation: 3, matchJobs: 10, telegram: 50, budgetMs: 25_000 });
  });
  revalidatePath("/", "layout");
  return { ok: true, data: { ...info, vacancyId: res.vacancy_id, slug: res.slug } };
}

/** "Qayta ko'rib chiqishni so'rash" — xato rad etilgan e'lon moderator navbatiga */
export async function requestAppeal(input: unknown): Promise<ActionResult<ListingStateInfo>> {
  const parsed = z.object({ entity: z.enum(["vacancy", "worker"]), id: z.uuid(), note: z.string().max(500).optional() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const session = await getSession();
  if (!session) return { ok: false, error: "not_authenticated" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("request_moderation_appeal", { p_entity: parsed.data.entity, p_id: parsed.data.id, p_note: parsed.data.note ?? undefined });
  if (error) return { ok: false, error: errorCode(error) };
  const { data } = await supabase.rpc("my_listing_state", { p_entity: parsed.data.entity, p_id: parsed.data.id });
  revalidatePath("/cabinet");
  return { ok: true, data: toListingStateInfo(data) };
}

/** "Ish topdim": e'lon qidiruvdan olinadi (keyin qayta joylash mumkin) */
export async function markFoundJob(): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "not_authenticated" };
  if (!session.workerId) return { ok: false, error: "forbidden" };
  const supabase = await createClient();
  const { error } = await supabase.from("worker_profiles").update({ status: "not_looking", is_public: false }).eq("id", session.workerId);
  if (error) return { ok: false, error: errorCode(error) };
  after(() => trackServer("outcome_found_job", session.userId));
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
  after(() => trackServer("outcome_found_worker", session.userId));
  revalidatePath("/", "layout");
  return { ok: true };
}
