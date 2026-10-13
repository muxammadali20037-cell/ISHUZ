import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { SessionContext } from "@/features/auth/session";
import type { JobCardData, WorkerCardData } from "@/features/find/components/result-cards";
import { getProfessionImages } from "@/lib/profession-images/server";
import { isMissingRelation } from "./missing";

/** Ro'yxatdagi kartalardan qaysilari saqlangan (yangi saved_items + eski jadvallar) */
export async function savedIdSet(session: SessionContext | null, kind: "vacancy" | "worker", ids: string[]): Promise<Set<string>> {
  const out = new Set<string>();
  if (!session || !ids.length) return out;
  const supabase = await createClient();
  const col = kind === "vacancy" ? "vacancy_id" : "worker_id";
  const [items, legacy] = await Promise.all([
    supabase.from("saved_items").select(col).eq("profile_id", session.userId).in(col, ids),
    kind === "vacancy"
      ? session.workerId
        ? supabase.from("saved_vacancies").select("vacancy_id").eq("worker_id", session.workerId).in("vacancy_id", ids)
        : null
      : supabase.from("saved_workers").select("worker_id").eq("employer_profile_id", session.userId).in("worker_id", ids),
  ]);
  for (const r of (items.data ?? []) as Record<string, string | null>[]) if (r[col]) out.add(r[col]!);
  for (const r of (legacy?.data ?? []) as Record<string, string | null>[]) {
    const v = r.vacancy_id ?? r.worker_id;
    if (v) out.add(v);
  }
  return out;
}

/** legacy — 0061 bazada hali yo'q: sahifa eski ro'yxatni ko'rsatadi */
export interface SavedJobs {
  items: JobCardData[];
  images: Record<string, string | null>;
  legacy?: boolean;
}
export interface SavedWorkers {
  items: WorkerCardData[];
  images: Record<string, string | null>;
  legacy?: boolean;
}

/** Saqlangan vakansiyalar (faqat hozir faol e'lonlar), eng oxirgi saqlangan birinchi */
export async function listSavedJobs(): Promise<SavedJobs> {
  const supabase = await createClient();
  const { data, error, status } = await supabase.rpc("my_saved_vacancies", { p_limit: 200 });
  if (error) {
    if (isMissingRelation(error, status)) return { items: [], images: {}, legacy: true };
    console.error("[saved] vacancies", error.message);
    return { items: [], images: {} };
  }
  const items = (data ?? []) as JobCardData[];
  return { items, images: await getProfessionImages(items.map((r) => r.profession_node_id)) };
}

/** Saqlangan ishchilar (faqat hozir ko'rinadigan e'lonlar), eng oxirgi saqlangan birinchi */
export async function listSavedWorkers(): Promise<SavedWorkers> {
  const supabase = await createClient();
  const { data, error, status } = await supabase.rpc("my_saved_workers", { p_limit: 200 });
  if (error) {
    if (isMissingRelation(error, status)) return { items: [], images: {}, legacy: true };
    console.error("[saved] workers", error.message);
    return { items: [], images: {} };
  }
  const items = (data ?? []) as WorkerCardData[];
  return { items, images: await getProfessionImages(items.map((r) => r.profession_node_id)) };
}
