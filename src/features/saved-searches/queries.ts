import "server-only";

import { createClient } from "@/lib/supabase/server";
import { DEFAULT_JOBS_PARAMS, serializeJobsSearchParams, type JobsSearchParams } from "@/features/jobs/search-params";

export interface SavedSearchItem {
  id: string;
  label: string;
  queryString: string;
  notify: boolean;
  newCount: number;
}

export async function listSavedSearches(): Promise<SavedSearchItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_saved_searches");
  if (error) {
    console.error("[saved-searches] list", error.message);
    return [];
  }
  return (data ?? []).map((r) => ({ id: r.id, label: r.label, queryString: r.query_string, notify: r.notify, newCount: r.new_count }));
}

/** Joriy qidiruv saqlanganmi (tugma holati uchun) */
export async function findSavedSearchId(p: JobsSearchParams): Promise<string | null> {
  const qs = serializeJobsSearchParams({ ...p, page: 1, sort: DEFAULT_JOBS_PARAMS.sort, from: "", exact: false });
  if (!qs) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("saved_searches").select("id").eq("query_string", qs).maybeSingle();
  return data?.id ?? null;
}
