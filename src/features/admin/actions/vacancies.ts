"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { errorCode } from "@/lib/utils";
import type { ActionResult } from "@/features/auth/actions";
import { vacancyStatusSchema } from "../schema";
import { requirePerm } from "./guard";

/** Vakansiya moderatsiyasi → rpc admin_set_vacancy_status (active/hidden/rejected/closed; audit yozadi) */
export async function setVacancyStatus(input: unknown): Promise<ActionResult> {
  const parsed = vacancyStatusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const guard = await requirePerm("vacancies.moderate");
  if (!guard.ok) return guard;
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_vacancy_status", {
    p_vacancy_id: parsed.data.vacancyId,
    p_status: parsed.data.status,
    p_note: parsed.data.note || undefined,
  });
  if (error) return { ok: false, error: errorCode(error) };
  revalidatePath("/admin/vacancies");
  revalidatePath("/admin/reports");
  revalidatePath("/admin");
  return { ok: true };
}
