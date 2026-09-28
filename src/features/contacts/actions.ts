"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/features/auth/actions";
import { getSession } from "@/features/auth/session";
import { createClient } from "@/lib/supabase/server";

const KNOWN = ["contact_hidden", "declined_recently", "rate_limited", "blocked", "forbidden", "not_authenticated"] as const;

function code(message: string): string {
  return KNOWN.find((k) => message.includes(k)) ?? "generic";
}

/** Telefon raqamini so'rash (egasiga bildirishnoma boradi). Holat: allowed | pending */
export async function requestContact(input: unknown): Promise<ActionResult<{ status: string }>> {
  const parsed = z.object({ profileId: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const session = await getSession();
  if (!session) return { ok: false, error: "not_authenticated" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("request_contact", { p_owner: parsed.data.profileId });
  if (error) return { ok: false, error: code(error.message) };
  return { ok: true, data: { status: data ?? "pending" } };
}

/** Egasi: so'rovga ruxsat berish yoki rad etish */
export async function respondContactRequest(input: unknown): Promise<ActionResult> {
  const parsed = z.object({ id: z.string().uuid(), approve: z.boolean() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const session = await getSession();
  if (!session) return { ok: false, error: "not_authenticated" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("respond_contact_request", { p_request_id: parsed.data.id, p_approve: parsed.data.approve });
  if (error) return { ok: false, error: code(error.message) };
  revalidatePath("/settings");
  return { ok: true };
}
