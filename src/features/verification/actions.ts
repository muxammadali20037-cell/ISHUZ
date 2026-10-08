"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/features/auth/session";
import type { ActionResult } from "@/features/auth/actions";
import { errorCode } from "@/lib/utils";
import { reviewVerificationRequest } from "./ai-review";

const schema = z.object({
  identityNumber: z.string().trim().max(20).optional(),
  note: z.string().trim().max(1000).optional(),
  documentPaths: z.array(z.string().max(300)).max(5).default([]),
});

/** Ish beruvchi tasdiqlash ma'lumotlarini yuboradi (STIR / JShShIR, izoh, ixtiyoriy hujjatlar — maxfiy bucket) */
export async function submitEmployerVerification(input: unknown): Promise<ActionResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const session = await getSession();
  if (!session) return { ok: false, error: "not_authenticated" };
  const v = parsed.data;
  if (v.documentPaths.some((p) => !p.startsWith(`${session.userId}/`) || p.includes(".."))) return { ok: false, error: "invalid_documents" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_employer_verification", {
    p_identity_number: v.identityNumber || undefined,
    p_note: v.note || undefined,
    p_document_paths: v.documentPaths,
  });
  if (error) return { ok: false, error: errorCode(error) };
  // adminga yordamchi eslatma (nomuvofiqliklar) — fon rejimida; qaror baribir adminniki
  const { data: req } = await supabase.from("verification_requests").select("id").eq("profile_id", session.userId).eq("status", "pending").order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (req) after(() => reviewVerificationRequest(req.id));
  revalidatePath("/cabinet/verification");
  return { ok: true };
}
