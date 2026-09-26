"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/features/auth/actions";
import { getSession } from "@/features/auth/session";
import { errorCode } from "@/lib/utils";

const schema = z.object({ ids: z.array(z.number().int().positive()).max(500).optional() });

/** O'qilgan deb belgilash: ids berilsa — shular, bo'lmasa — hammasi. Qaytaradi: yangilangan qatorlar soni */
export async function markNotificationsRead(input: unknown = {}): Promise<ActionResult<{ count: number }>> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const session = await getSession();
  if (!session) return { ok: false, error: "not_authenticated" };
  const supabase = await createClient();
  const ids = parsed.data.ids;
  const { data, error } = await supabase.rpc("mark_notifications_read", ids && ids.length ? { p_ids: ids } : {});
  if (error) return { ok: false, error: errorCode(error) };
  revalidatePath("/notifications");
  return { ok: true, data: { count: data ?? 0 } };
}
