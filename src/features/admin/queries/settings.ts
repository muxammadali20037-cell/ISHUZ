import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database.types";

export type SettingRow = Tables<"app_settings">;

/** app_settings (RLS: admin hammasini o'qiydi) */
export async function listSettings(): Promise<{ rows: SettingRow[]; error: string | null }> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("app_settings").select("*").order("key");
  // moslik qoidalari alohida sahifada (versiya va audit bilan)
  const hidden = new Set(["match_weights", "match_notify_threshold", "match_rules_version"]);
  return { rows: (data ?? []).filter((r) => !hidden.has(r.key)), error: error?.message ?? null };
}

export type AdminUserRow = Tables<"admin_users"> & {
  profile: { id: string; first_name: string; last_name: string; avatar_url: string | null } | null;
  creator: { first_name: string; last_name: string } | null;
};

/** admin_users (RLS: admin hammasini o'qiydi; yozish faqat admins.manage) */
export async function listAdminUsers(): Promise<{ rows: AdminUserRow[]; error: string | null }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("admin_users")
    .select("*, profile:profiles!admin_users_profile_id_fkey(id, first_name, last_name, avatar_url), creator:profiles!admin_users_created_by_fkey(first_name, last_name)")
    .order("created_at");
  return { rows: (data ?? []) as AdminUserRow[], error: error?.message ?? null };
}
