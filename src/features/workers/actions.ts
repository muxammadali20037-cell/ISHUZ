"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { errorCode } from "@/lib/utils";
import { getSession, type SessionContext } from "@/features/auth/session";
import type { ActionResult } from "@/features/auth/actions";
import {
  moveSavedFolderSchema,
  saveWorkerSchema,
  sendOfferSchema,
  toggleSaveSchema,
  unsaveWorkerSchema,
  updateSavedNoteSchema,
} from "./schema";

type EmployerSession = SessionContext & { employerId: string };

async function requireEmployerSession(): Promise<{ ok: true; session: EmployerSession } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: "not_authenticated" };
  if (session.profile.is_blocked) return { ok: false, error: "blocked" };
  if (!session.employerId || !session.employerOnboarded) return { ok: false, error: "employer_profile_required" };
  return { ok: true, session: session as EmployerSession };
}

function revalidateWorkerPages(workerId?: string) {
  revalidatePath("/workers");
  revalidatePath("/employer/saved");
  revalidatePath("/employer");
  if (workerId) revalidatePath(`/workers/${workerId}`);
}

/** Kartadagi yulduzcha: saqlash / olib tashlash (papka va eslatmasiz) */
export async function toggleSaveWorker(input: unknown): Promise<ActionResult<{ saved: boolean }>> {
  const parsed = toggleSaveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const auth = await requireEmployerSession();
  if (!auth.ok) return auth;
  const supabase = await createClient();
  const { workerId, save } = parsed.data;
  if (save) {
    const { error } = await supabase
      .from("saved_workers")
      .upsert({ employer_profile_id: auth.session.userId, worker_id: workerId }, { onConflict: "employer_profile_id,worker_id", ignoreDuplicates: true });
    if (error) return { ok: false, error: errorCode(error) };
  } else {
    const { error } = await supabase.from("saved_workers").delete().eq("employer_profile_id", auth.session.userId).eq("worker_id", workerId);
    if (error) return { ok: false, error: errorCode(error) };
  }
  revalidateWorkerPages(workerId);
  return { ok: true, data: { saved: save } };
}

/** Nomzod sahifasidan: papka + eslatma bilan saqlash (mavjud bo'lsa yangilaydi) */
export async function saveWorker(input: unknown): Promise<ActionResult> {
  const parsed = saveWorkerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const auth = await requireEmployerSession();
  if (!auth.ok) return auth;
  const supabase = await createClient();
  const { workerId, folder, note } = parsed.data;
  const { error } = await supabase
    .from("saved_workers")
    .upsert({ employer_profile_id: auth.session.userId, worker_id: workerId, folder: folder ?? null, note: note ?? null }, { onConflict: "employer_profile_id,worker_id" });
  if (error) return { ok: false, error: errorCode(error) };
  revalidateWorkerPages(workerId);
  return { ok: true };
}

export async function unsaveWorker(input: unknown): Promise<ActionResult> {
  const parsed = unsaveWorkerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const auth = await requireEmployerSession();
  if (!auth.ok) return auth;
  const supabase = await createClient();
  const { error } = await supabase.from("saved_workers").delete().eq("employer_profile_id", auth.session.userId).eq("worker_id", parsed.data.workerId);
  if (error) return { ok: false, error: errorCode(error) };
  revalidateWorkerPages(parsed.data.workerId);
  return { ok: true };
}

export async function updateSavedNote(input: unknown): Promise<ActionResult> {
  const parsed = updateSavedNoteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const auth = await requireEmployerSession();
  if (!auth.ok) return auth;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("saved_workers")
    .update({ note: parsed.data.note ?? null })
    .eq("employer_profile_id", auth.session.userId)
    .eq("worker_id", parsed.data.workerId)
    .select("worker_id");
  if (error) return { ok: false, error: errorCode(error) };
  if (!data?.length) return { ok: false, error: "not_saved" };
  revalidateWorkerPages(parsed.data.workerId);
  return { ok: true };
}

export async function moveSavedFolder(input: unknown): Promise<ActionResult> {
  const parsed = moveSavedFolderSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const auth = await requireEmployerSession();
  if (!auth.ok) return auth;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("saved_workers")
    .update({ folder: parsed.data.folder ?? null })
    .eq("employer_profile_id", auth.session.userId)
    .eq("worker_id", parsed.data.workerId)
    .select("worker_id");
  if (error) return { ok: false, error: errorCode(error) };
  if (!data?.length) return { ok: false, error: "not_saved" };
  revalidateWorkerPages(parsed.data.workerId);
  return { ok: true };
}

/** Ish taklifi: send_offer RPC (vakansiya bo'yicha yoki erkin) */
export async function sendOffer(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = sendOfferSchema.safeParse(input);
  if (!parsed.success) {
    const custom = parsed.error.issues.find((i) => i.code === "custom")?.message;
    return { ok: false, error: custom === "title_required" || custom === "salary_range" ? custom : "validation" };
  }
  const auth = await requireEmployerSession();
  if (!auth.ok) return auth;
  const supabase = await createClient();
  const { workerId, vacancyId, title, message, salaryFrom, salaryTo } = parsed.data;
  const { data, error } = await supabase.rpc("send_offer", {
    p_worker_id: workerId,
    p_vacancy_id: vacancyId ?? undefined,
    p_title: title || undefined,
    p_message: message || undefined,
    p_salary_from: salaryFrom ?? undefined,
    p_salary_to: salaryTo ?? undefined,
  });
  if (error) return { ok: false, error: errorCode(error) };
  revalidatePath(`/workers/${workerId}`);
  revalidatePath("/employer");
  return { ok: true, data: { id: data } };
}
