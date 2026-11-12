"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/features/auth/actions";
import { getAdminActor } from "@/features/admin/context";
import { errorCode } from "@/lib/utils";
import { DEMO_VACANCIES_TAG } from "./queries";

/**
 * Namuna (demo) vakansiyalarni bir bosishda olib tashlash yoki qaytarish (admin, huquq: vacancies.moderate).
 * Baza funksiyalari (0077) huquqni o'zi ham tekshiradi — bu yerdagi tekshiruv faqat erta va aniq javob uchun.
 */
export async function demoVacancies(input: unknown): Promise<ActionResult<{ count: number }>> {
  const parsed = z.object({ action: z.enum(["remove", "seed"]) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const ctx = await getAdminActor();
  if (!ctx?.can("vacancies.moderate")) return { ok: false, error: "forbidden" };
  const supabase = await createClient();
  const { data, error } = parsed.data.action === "remove" ? await supabase.rpc("demo_vacancies_remove") : await supabase.rpc("demo_vacancies_seed");
  if (error) return { ok: false, error: errorCode(error) };
  updateTag(DEMO_VACANCIES_TAG);
  revalidatePath("/");
  revalidatePath("/jobs/namuna");
  revalidatePath("/admin/namuna");
  return { ok: true, data: { count: Number(data ?? 0) } };
}
