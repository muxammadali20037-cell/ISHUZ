"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { errorCode } from "@/lib/utils";
import { getSession, type SessionContext } from "@/features/auth/session";
import type { ActionResult } from "@/features/auth/actions";
import { isMissingRelation } from "./missing";

const schema = z.object({ kind: z.enum(["vacancy", "worker"]), id: z.uuid(), save: z.boolean() });

/**
 * "Saqlanganlar": vakansiya (ish izlovchi) yoki ishchi (ish beruvchi) — profil to'ldirish shart emas (saved_items, 0061).
 * Olib tashlashda eski jadvallardagi yozuv ham o'chadi (bir joyda saqlangan — bir joyda yo'qoladi).
 * 0061 hali qo'llanmagan bazada — eski yo'l (saved_vacancies / saved_workers; ularga profil kerak).
 * Xatolar: not_authenticated (→ kirish), blocked, saved_limit, not_found, worker_profile_required, employer_profile_required.
 */
export async function toggleSaved(input: unknown): Promise<ActionResult<{ saved: boolean }>> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const session = await getSession();
  if (!session) return { ok: false, error: "not_authenticated" };
  if (session.profile.is_blocked) return { ok: false, error: "blocked" };
  const { kind, id, save } = parsed.data;
  const supabase = await createClient();

  if (save) {
    const { error, status } =
      kind === "vacancy"
        ? await supabase.from("saved_items").insert({ profile_id: session.userId, vacancy_id: id })
        : await supabase.from("saved_items").insert({ profile_id: session.userId, worker_id: id });
    if (error && error.code !== "23505") {
      if (isMissingRelation(error, status)) return legacy(session, kind, id, true);
      if (/saved_limit/.test(error.message)) return { ok: false, error: "saved_limit" };
      if (error.code === "23503") return { ok: false, error: "not_found" };
      return { ok: false, error: errorCode(error) };
    }
  } else {
    const { error, status } = await supabase.from("saved_items").delete().eq("profile_id", session.userId).eq(kind === "vacancy" ? "vacancy_id" : "worker_id", id);
    if (error && !isMissingRelation(error, status)) return { ok: false, error: errorCode(error) };
    const res = await legacy(session, kind, id, false);
    if (!res.ok && error) return res;
  }
  revalidatePath("/saved");
  return { ok: true, data: { saved: save } };
}

/** Eski jadvallar: vakansiya — ishchi profili bilan, ishchi — ish beruvchi profili bilan */
async function legacy(session: SessionContext, kind: "vacancy" | "worker", id: string, save: boolean): Promise<ActionResult<{ saved: boolean }>> {
  const supabase = await createClient();
  if (kind === "vacancy") {
    if (!session.workerId) return save ? { ok: false, error: "worker_profile_required" } : { ok: true, data: { saved: false } };
    const { error } = save
      ? await supabase.from("saved_vacancies").upsert({ worker_id: session.workerId, vacancy_id: id }, { onConflict: "worker_id,vacancy_id", ignoreDuplicates: true })
      : await supabase.from("saved_vacancies").delete().eq("worker_id", session.workerId).eq("vacancy_id", id);
    if (error) return { ok: false, error: errorCode(error) };
  } else {
    if (!session.employerId || !session.employerOnboarded) return save ? { ok: false, error: "employer_profile_required" } : { ok: true, data: { saved: false } };
    const { error } = save
      ? await supabase.from("saved_workers").upsert({ employer_profile_id: session.userId, worker_id: id }, { onConflict: "employer_profile_id,worker_id", ignoreDuplicates: true })
      : await supabase.from("saved_workers").delete().eq("employer_profile_id", session.userId).eq("worker_id", id);
    if (error) return { ok: false, error: errorCode(error) };
  }
  revalidatePath("/saved");
  return { ok: true, data: { saved: save } };
}
