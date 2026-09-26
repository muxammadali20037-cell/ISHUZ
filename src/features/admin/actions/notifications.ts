"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { errorCode } from "@/lib/utils";
import type { ActionResult } from "@/features/auth/actions";
import { broadcastSchema } from "../schema";
import { requirePerm } from "./guard";

/** Ommaviy bildirishnoma → rpc admin_broadcast (qabul qiluvchilar sonini qaytaradi; audit yozadi) */
export async function sendBroadcast(input: unknown): Promise<ActionResult<{ count: number }>> {
  const parsed = broadcastSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const guard = await requirePerm("notifications.broadcast");
  if (!guard.ok) return guard;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_broadcast", {
    p_title: parsed.data.title,
    p_body: parsed.data.body,
    p_role: parsed.data.role === "all" ? undefined : parsed.data.role,
    p_link: parsed.data.link || undefined,
  });
  if (error) return { ok: false, error: errorCode(error) };
  revalidatePath("/admin/notifications");
  return { ok: true, data: { count: Number(data ?? 0) } };
}
