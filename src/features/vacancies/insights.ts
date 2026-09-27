"use server";

import { z } from "zod";
import { Constants } from "@/types/database.types";
import type { ActionResult } from "@/features/auth/actions";
import { getSession } from "@/features/auth/session";
import { createClient } from "@/lib/supabase/server";

const uuid = z.string().uuid();

export interface SalaryInsight {
  /** Nechta haqiqiy faol e'londan hisoblangan */
  sample: number;
  p25: number;
  p50: number;
  p75: number;
  /** region — shu viloyat bo'yicha; country — butun mamlakat (viloyatda kam bo'lsa) */
  scope: "region" | "country";
}

const salaryInput = z.object({
  subcategoryId: uuid,
  regionId: uuid.nullable(),
  salaryType: z.enum(Constants.public.Enums.salary_type),
});

/**
 * Shu lavozimdagi faol e'lonlardagi maosh oralig'i. Ma'lumot yetarli bo'lmasa (5 tadan kam) — null:
 * statistika o'ylab topilmaydi.
 */
export async function getSalaryInsight(input: unknown): Promise<ActionResult<SalaryInsight | null>> {
  const parsed = salaryInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const { subcategoryId, regionId, salaryType } = parsed.data;
  if (salaryType === "negotiable") return { ok: true, data: null };
  const supabase = await createClient();
  for (const scope of regionId ? (["region", "country"] as const) : (["country"] as const)) {
    const { data, error } = await supabase
      .rpc("salary_insight", { p_subcategory_id: subcategoryId, p_region_id: scope === "region" && regionId ? regionId : undefined, p_salary_type: salaryType })
      .maybeSingle();
    if (error) return { ok: false, error: "generic" };
    if (data?.p50 != null && data.p25 != null && data.p75 != null) return { ok: true, data: { sample: data.sample_size, p25: data.p25, p50: data.p50, p75: data.p75, scope } };
  }
  return { ok: true, data: null };
}

export interface SimilarVacancy {
  id: string;
  title: string;
  status: string;
}

/** Ish beruvchining o'ziga o'xshash faol e'lonlari (takroriy e'lon ogohlantirishi). Faqat boshqaruvchi so'raydi (RPC tekshiradi). */
export async function getSimilarVacancies(input: unknown): Promise<ActionResult<SimilarVacancy[]>> {
  const parsed = z.object({ vacancyId: uuid }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const session = await getSession();
  if (!session) return { ok: false, error: "not_authenticated" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("similar_vacancies", { p_vacancy_id: parsed.data.vacancyId });
  if (error) return { ok: false, error: error.code === "42501" ? "forbidden" : "generic" };
  return { ok: true, data: (data ?? []).map((r) => ({ id: r.id, title: r.title, status: r.status })) };
}
