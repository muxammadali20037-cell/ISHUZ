"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/features/auth/actions";
import { getSession } from "@/features/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getLocale, getT } from "@/lib/i18n/server";
import { aiEnabled } from "@/lib/ai/client";
import { getCategories, getDistricts, getRegions } from "@/lib/reference";
import { loadAiCatalog } from "@/features/ai/catalog";
import { extractAlert, type AlertExtract } from "@/features/ai/extract";
import { resolveCategory, resolvePlace } from "@/features/ai/mapping";
import { resolveProfessionNode, searchProfessions } from "@/features/professions/queries";
import { getSearchDictionary } from "@/features/search/dictionary";
import { understandQuery } from "@/features/search/understand";
import { monthlyEquivalent } from "@/features/search/apply";
import type { Database } from "@/types/database.types";

type Insert = Database["public"]["Tables"]["ai_job_alerts"]["Insert"];
const PATH = "/ai-alerts";

/** AI chaqiruvi — foydalanuvchi boshiga soatiga 10 ta (pullik xizmat) */
async function allowAi(userId: string): Promise<boolean> {
  try {
    const { data } = await createAdminClient().rpc("check_rate_limit", { p_key: `ai_alert:${userId}`, p_limit: 10, p_window_seconds: 3600 });
    return data !== false;
  } catch {
    return true;
  }
}

async function aiExtract(userId: string, text: string): Promise<AlertExtract | null> {
  if (!aiEnabled() || !(await allowAi(userId))) return null;
  try {
    const [catalog, locale] = await Promise.all([loadAiCatalog(), getLocale()]);
    const x = await extractAlert(catalog, text, locale);
    if (!x) return null;
    const { categoryId } = resolveCategory(catalog, x.category, x.subcategory);
    const { regionId, districtId } = resolvePlace(catalog, x.region, x.district);
    const extra = x.extra_districts.map((c) => catalog.district.get(c)).filter((d) => d && d.regionId === regionId).map((d) => d!.id);
    return { ...x, category: categoryId, region: regionId, district: districtId, extra_districts: extra };
  } catch (e) {
    console.error("[ai-alerts] extract", e instanceof Error ? e.message : e);
    return null;
  }
}

/**
 * Kuzatuv uchun kasb: aniq mos kelgan nom (guruh ham bo'lishi mumkin — "shifokor" → barcha shifokorlar).
 * Avval AI aytgan nom, keyin matndagi 2 va 1 so'zli bo'laklar; faqat aniq moslik (score ≥ 4) olinadi.
 */
async function resolveAlertNode(texts: Array<string | null | undefined>, categoryId: string | null): Promise<string | null> {
  const phrases = texts.map((t) => (t ?? "").trim()).filter((t) => t.length >= 3);
  const words = phrases
    .slice(-1)
    .join(" ")
    .toLowerCase()
    .split(/[^\p{L}\p{N}'’ʻ-]+/u)
    .filter((w) => w.length >= 3);
  const grams = [...phrases.slice(0, -1), ...words.slice(0, -1).map((w, i) => `${w} ${words[i + 1]}`), ...words];
  const supabase = await createClient();
  let best: { id: string; score: number } | null = null;
  for (const q of [...new Set(grams)].slice(0, 16)) {
    const { data } = await supabase.rpc("search_profession_nodes", { p_query: q.slice(0, 80), p_category_id: categoryId ?? undefined, p_limit: 1 });
    const h = data?.[0];
    if (!h || h.score < 4) continue;
    const score = h.score + q.split(" ").length * 0.5;
    if (!best || score > best.score) best = { id: h.id, score };
  }
  return best?.id ?? null;
}

/**
 * Matn → kuzatish mezonlari. Avval AI (bo'lsa), keyin deterministik tushunish bo'sh joylarni to'ldiradi;
 * aniq kasb katalogdan topiladi (ota yo'nalish ham bo'lishi mumkin — trigger avlodlarini ham qamraydi).
 */
async function understandAlert(userId: string, text: string): Promise<Omit<Insert, "profile_id" | "prompt" | "label"> & { professionName: string | null }> {
  const [x, dict] = await Promise.all([aiExtract(userId, text), getSearchDictionary()]);
  const u = understandQuery(text, dict);

  let categoryId: string | null = x?.category ?? u.category?.id ?? null;
  const regionId: string | null = x?.region ?? u.region?.id ?? null;
  const districtIds = [...new Set([...(x?.district ? [x.district] : []), ...(x?.extra_districts ?? []), ...u.districts.map((d) => d.id)])].slice(0, 30);
  const salaryMin = x?.salary_min && x.salary_min > 0 ? x.salary_min : u.salaryMin ? monthlyEquivalent(u.salaryMin, u.salaryKind) : null;

  // Kasb: AI aytgan nom yoki butun matn bo'yicha katalogdan
  let professionNodeId = (await resolveAlertNode([x?.profession, text], categoryId)) ?? (await resolveProfessionNode([x?.profession, text], categoryId));
  let professionName: string | null = null;
  if (!professionNodeId) {
    const query = (x?.profession ?? u.rest ?? "").trim();
    if (query.length >= 3) {
      const hit = (await searchProfessions(query, categoryId, 5))[0];
      if (hit) {
        professionNodeId = hit.id;
        categoryId = categoryId ?? hit.category_id;
      }
    }
  }
  if (professionNodeId) {
    const supabase = await createClient();
    const { data } = await supabase.from("profession_nodes").select("name_uz, category_id").eq("id", professionNodeId).maybeSingle();
    professionName = data?.name_uz ?? null;
    categoryId = categoryId ?? data?.category_id ?? null;
  }
  const keywords = (x?.keywords ?? u.rest ?? "").trim().slice(0, 60);
  const q = !professionNodeId && !categoryId && keywords.length >= 2 ? keywords : null;

  return {
    profession_node_id: professionNodeId,
    category_id: categoryId,
    region_id: regionId,
    district_ids: regionId ? districtIds : [],
    salary_min: salaryMin,
    employment_types: x?.employment_types?.length ? x.employment_types : u.employment,
    schedules: x?.schedules?.length ? x.schedules : u.schedules,
    is_remote: x?.is_remote ?? u.remote,
    no_experience: x?.no_experience ?? u.noExperience,
    q,
    professionName,
  };
}

const createSchema = z.object({ text: z.string().trim().min(3).max(500) });

export async function createAiAlert(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "ai_alert_text" };
  const session = await getSession();
  if (!session) return { ok: false, error: "not_authenticated" };
  if (session.profile.is_blocked) return { ok: false, error: "blocked" };

  const c = await understandAlert(session.userId, parsed.data.text);
  if (!c.profession_node_id && !c.category_id && !c.q) return { ok: false, error: "ai_alert_unclear" };

  const { t } = await getT();
  const [categories, regions] = await Promise.all([getCategories(), getRegions()]);
  const parts = [
    c.professionName ?? categories.find((x) => x.id === c.category_id)?.name_uz ?? c.q,
    c.district_ids?.length ? (await getDistricts(c.region_id ?? undefined)).filter((d) => c.district_ids!.includes(d.id)).map((d) => d.name_uz).join(", ") : null,
    !c.district_ids?.length ? regions.find((r) => r.id === c.region_id)?.name_uz : null,
    c.salary_min ? t("saved.searches.salary_from", { amount: new Intl.NumberFormat("ru-RU").format(c.salary_min) }) : null,
  ].filter(Boolean);
  const label = parts.join(" · ").slice(0, 160) || parsed.data.text.slice(0, 160);

  const { professionName: _unused, ...criteria } = c;
  void _unused;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ai_job_alerts")
    .insert({ ...criteria, profile_id: session.userId, prompt: parsed.data.text, label })
    .select("id")
    .single();
  if (error) {
    if (error.message.includes("ai_alert_limit")) return { ok: false, error: "ai_alert_limit" };
    console.error("[ai-alerts] insert", error.message);
    return { ok: false, error: "generic" };
  }
  revalidatePath(PATH);
  return { ok: true, data: { id: data.id } };
}

const idSchema = z.object({ id: z.uuid() });

export async function toggleAiAlert(input: unknown): Promise<ActionResult> {
  const parsed = idSchema.extend({ active: z.boolean() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const session = await getSession();
  if (!session) return { ok: false, error: "not_authenticated" };
  const supabase = await createClient();
  const { error } = await supabase.from("ai_job_alerts").update({ is_active: parsed.data.active }).eq("id", parsed.data.id).eq("profile_id", session.userId);
  if (error) return { ok: false, error: "generic" };
  revalidatePath(PATH);
  return { ok: true };
}

export async function deleteAiAlert(input: unknown): Promise<ActionResult> {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const session = await getSession();
  if (!session) return { ok: false, error: "not_authenticated" };
  const supabase = await createClient();
  const { error } = await supabase.from("ai_job_alerts").delete().eq("id", parsed.data.id).eq("profile_id", session.userId);
  if (error) return { ok: false, error: "generic" };
  revalidatePath(PATH);
  return { ok: true };
}
