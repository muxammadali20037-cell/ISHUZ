"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/features/auth/actions";
import { getSession } from "@/features/auth/session";
import { errorCode } from "@/lib/utils";
import { applySchema, toggleSaveSchema } from "./schema";

/**
 * Vakansiyani saqlash / saqlanganlardan olib tashlash (saved_vacancies, RLS: faqat o'z worker_id).
 * Xatolar: not_authenticated (→ /auth), worker_profile_required (→ /onboarding/worker), blocked.
 */
export async function toggleSaveVacancy(input: unknown): Promise<ActionResult<{ saved: boolean }>> {
  const parsed = toggleSaveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const session = await getSession();
  if (!session) return { ok: false, error: "not_authenticated" };
  if (session.profile.is_blocked) return { ok: false, error: "blocked" };
  if (!session.workerId) return { ok: false, error: "worker_profile_required" };

  const supabase = await createClient();
  const { vacancyId, save } = parsed.data;
  if (save) {
    const { error } = await supabase
      .from("saved_vacancies")
      .upsert({ worker_id: session.workerId, vacancy_id: vacancyId }, { onConflict: "worker_id,vacancy_id", ignoreDuplicates: true });
    if (error) return { ok: false, error: errorCode(error) };
  } else {
    const { error } = await supabase.from("saved_vacancies").delete().eq("worker_id", session.workerId).eq("vacancy_id", vacancyId);
    if (error) return { ok: false, error: errorCode(error) };
  }
  revalidatePath("/saved");
  return { ok: true, data: { saved: save } };
}

/**
 * Ariza yuborish → apply_to_vacancy RPC. Xatolar RPC dan: already_applied, rate_limited, own_vacancy,
 * vacancy_not_active, blocked, worker_profile_required, not_authenticated.
 */
export async function applyToVacancy(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = applySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const session = await getSession();
  if (!session) return { ok: false, error: "not_authenticated" };
  if (session.profile.is_blocked) return { ok: false, error: "blocked" };
  if (!session.workerId || !session.workerOnboarded) return { ok: false, error: "worker_profile_required" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("apply_to_vacancy", {
    p_vacancy_id: parsed.data.vacancyId,
    p_message: parsed.data.message || undefined,
  });
  if (error) return { ok: false, error: errorCode(error) };
  if (!data) return { ok: false, error: "unknown" };
  revalidatePath("/applications");
  revalidatePath("/");
  return { ok: true, data: { id: data } };
}
