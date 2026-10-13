"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/features/auth/actions";
import { getSession } from "@/features/auth/session";
import { errorCode } from "@/lib/utils";
import { applySchema, toggleSaveSchema } from "./schema";
import { toggleSaved } from "@/features/saved/actions";

/**
 * Vakansiyani saqlash / saqlanganlardan olib tashlash — "Saqlanganlar" (saved_items, 0061: ishchi profili shart emas;
 * 0061 dan oldingi bazada — saved_vacancies, ishchi profili bilan). Xatolar: not_authenticated (→ /auth),
 * worker_profile_required (faqat 0061 siz), blocked, saved_limit.
 */
export async function toggleSaveVacancy(input: unknown): Promise<ActionResult<{ saved: boolean }>> {
  const parsed = toggleSaveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const res = await toggleSaved({ kind: "vacancy", id: parsed.data.vacancyId, save: parsed.data.save });
  if (res.ok) revalidatePath("/jobs");
  return res;
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
