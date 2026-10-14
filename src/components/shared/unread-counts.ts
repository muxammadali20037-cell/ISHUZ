import "server-only";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

/** Yuqori panel va pastki menyudagi o'qilmaganlar soni */
export async function unreadCounts() {
  // sessiya bilan parallel chaqirish uchun: kirish cookie'si bo'lmasa — so'rov yo'q
  const jar = await cookies();
  if (!jar.getAll().some((c) => /^sb-.+-auth-token/.test(c.name))) return undefined;
  const supabase = await createClient();
  const { data } = await supabase.rpc("unread_counts").maybeSingle();
  if (!data) return undefined;
  return {
    notifications: Number(data.notifications ?? 0),
    messages: Number(data.messages ?? 0),
    applications: Number(data.applications ?? 0),
    offers: Number(data.offers ?? 0),
  };
}
