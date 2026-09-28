"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/features/auth/actions";
import { getSession } from "@/features/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import { getJobsFilterRefs } from "@/features/jobs/queries";
import { DEFAULT_JOBS_PARAMS, countActiveFilters, parseJobsSearchParams, serializeJobsSearchParams, type JobsSearchParams } from "@/features/jobs/search-params";
import { savedSearchLabel } from "./label";

const idSchema = z.object({ id: z.string().uuid() });

/** Saqlash uchun kanonik ko'rinish: sahifa, saralash va "tushundim" belgisi hisobga olinmaydi */
function canonical(p: JobsSearchParams): string {
  return serializeJobsSearchParams({ ...p, page: 1, sort: DEFAULT_JOBS_PARAMS.sort, from: "", exact: false });
}

/** Joriy /jobs qidiruvini saqlaydi. Filtrlar serverda qayta tekshiriladi (mijozga ishonilmaydi). */
export async function saveJobsSearch(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = z.object({ query: z.string().max(2000) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const session = await getSession();
  if (!session) return { ok: false, error: "not_authenticated" };
  if (session.profile.is_blocked) return { ok: false, error: "blocked" };

  const p = parseJobsSearchParams(new URLSearchParams(parsed.data.query));
  if (!p.q && countActiveFilters(p) === 0) return { ok: false, error: "empty_search" };
  const refs = await getJobsFilterRefs();
  const category = p.category ? refs.categories.find((c) => c.slug === p.category) : undefined;
  const subcategory = category && p.subcategory ? refs.subcategories.find((s) => s.slug === p.subcategory && s.category_id === category.id) : undefined;
  const region = p.region ? refs.regions.find((r) => r.slug === p.region) : undefined;
  const { t, locale } = await getT();
  const label = savedSearchLabel(p, refs, locale, {
    salaryFrom: (a) => t("saved.searches.salary_from", { amount: a }),
    remote: t("jobs.filters.remote"),
    noExperience: t("jobs.filters.no_experience"),
  });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("saved_searches")
    .insert({
      profile_id: session.userId,
      label,
      query_string: canonical(p),
      q: p.q || null,
      category_id: category?.id ?? null,
      subcategory_id: subcategory?.id ?? null,
      region_id: region?.id ?? null,
      district_ids: p.district,
      salary_min: p.salaryMin,
      employment_types: p.employment,
      schedules: p.schedule,
      is_remote: p.remote,
      no_experience: p.noExperience,
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return { ok: false, error: "already_saved" };
    if (error.message.includes("saved_search_limit")) return { ok: false, error: "saved_search_limit" };
    console.error("[saved-searches] insert", error.message);
    return { ok: false, error: "generic" };
  }
  revalidatePath("/saved");
  return { ok: true, data: { id: data.id } };
}

export async function deleteSavedSearch(input: unknown): Promise<ActionResult> {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const session = await getSession();
  if (!session) return { ok: false, error: "not_authenticated" };
  const supabase = await createClient();
  const { error } = await supabase.from("saved_searches").delete().eq("id", parsed.data.id).eq("profile_id", session.userId);
  if (error) return { ok: false, error: "generic" };
  revalidatePath("/saved");
  return { ok: true };
}

export async function setSavedSearchNotify(input: unknown): Promise<ActionResult> {
  const parsed = idSchema.extend({ notify: z.boolean() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const session = await getSession();
  if (!session) return { ok: false, error: "not_authenticated" };
  const supabase = await createClient();
  const { error } = await supabase.from("saved_searches").update({ notify: parsed.data.notify }).eq("id", parsed.data.id).eq("profile_id", session.userId);
  if (error) return { ok: false, error: "generic" };
  revalidatePath("/saved");
  return { ok: true };
}

/** Qidiruv ochildi → "N ta yangi" nolga tushadi */
export async function markSavedSearchSeen(input: unknown): Promise<ActionResult> {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const supabase = await createClient();
  await supabase.rpc("mark_saved_search_seen", { p_search_id: parsed.data.id });
  return { ok: true };
}
