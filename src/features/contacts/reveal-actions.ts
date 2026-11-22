"use server";

import { headers } from "next/headers";
import { z } from "zod";
import type { ActionResult } from "@/features/auth/actions";
import { getSession } from "@/features/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hitRate } from "@/lib/rate-limit";
import { clientIp, subjectHash } from "@/lib/security/request";
import { isMissingRelation } from "@/features/saved/missing";
import { getContactUnlockConfig } from "./unlock-config";

export interface RevealedPhones {
  phone: string;
  phone2: string | null;
  /** 0088: shu ishchining raqami shu foydalanuvchi uchun ochilgan — "Chatda yozish" ham bor */
  unlocked?: boolean;
}

/**
 * Raqamni ochish natijasi:
 *  · shown — raqam(lar);
 *  · pay — ishchi raqami pullik (0088, admin yoqqan): narx (kirgan — to'lov oynasi, mehmon — avval kirish);
 *  · error — none (ochiq raqam yo'q) / limit (juda ko'p) / unavailable (vaqtincha ishlamayapti).
 */
export type RevealOutcome =
  | { phase: "shown"; phones: RevealedPhones }
  | { phase: "pay"; price: number }
  | { phase: "error"; error: "none" | "limit" | "unavailable" };

/** mehmon: bitta IP dan soatiga 20, sutkasiga 60 ta turli raqam (OLX kabi — oddiy odamga yetadi, yig'uvchiga emas) */
const GUEST_PER_HOUR = 20;
const GUEST_PER_DAY = 60;

const inputSchema = z.object({ kind: z.enum(["vacancy", "worker"]), id: z.uuid() });

/**
 * "Raqamni ko'rsatish / ochish" (ega, 2026-11-18: raqam hammaga — tugma bosilganda; 2026-11-22: ishchi raqami — ish
 * beruvchiga 5 000 so'm, Payme/Click ulanmaguncha bepul):
 *  · vakansiya (ish izlovchi uchun — doim bepul): kirgan — 0074 limiti bilan, mehmon — IP limiti (0084);
 *  · ishchi e'loni, kirgan — unlock_worker_contact (0088): bepul rejimda limit bilan ochiladi va juftlik yoziladi
 *    (chat ham ochiladi), pullik rejimda — narx; 0088 hali qo'llanmagan bazada — avvalgi yo'l;
 *  · ishchi e'loni, mehmon — pullik rejimda narx (avval kirish), bepul rejimda IP limiti bilan.
 */
export async function revealPhone(input: unknown): Promise<RevealOutcome> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { phase: "error", error: "none" };
  const { kind, id } = parsed.data;

  const session = await getSession().catch(() => null);
  if (session) {
    const supabase = await createClient();
    if (kind === "vacancy") {
      const { data, error } = await supabase.rpc("simple_vacancy_phone", { p_vacancy_id: id });
      if (error) return { phase: "error", error: "unavailable" };
      return data ? { phase: "shown", phones: { phone: data, phone2: null } } : { phase: "error", error: "none" };
    }
    const { data, error, status } = await supabase.rpc("unlock_worker_contact", { p_worker_id: id });
    if (error && isMissingRelation(error, status)) return legacyWorkerPhone(id);
    if (error || !data) return { phase: "error", error: "unavailable" };
    return fromUnlock(data as Record<string, unknown>);
  }

  if (kind === "worker") {
    const config = await getContactUnlockConfig();
    if (config.paid) return { phase: "pay", price: config.price };
  }
  const ip = subjectHash("ip", clientIp(await headers()));
  const [hour, day] = await Promise.all([hitRate(`phone_reveal_h:${ip}`, GUEST_PER_HOUR, 3600), hitRate(`phone_reveal_d:${ip}`, GUEST_PER_DAY, 86_400)]);
  if ([hour, day].some((r) => !r.ok && r.reason === "unavailable")) return { phase: "error", error: "unavailable" };
  if (!hour.ok || !day.ok) return { phase: "error", error: "limit" };
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return { phase: "error", error: "unavailable" };
  const { data, error } = await createAdminClient().rpc("listing_phones_public", { p_kind: kind, p_id: id });
  if (error) return { phase: "error", error: "unavailable" };
  const row = data?.[0];
  return row?.phone ? { phase: "shown", phones: { phone: row.phone, phone2: row.phone2 ?? null } } : { phase: "error", error: "none" };
}

function fromUnlock(d: Record<string, unknown>): RevealOutcome {
  const status = String(d.status ?? "");
  if (status === "shown" && typeof d.phone === "string") {
    return { phase: "shown", phones: { phone: d.phone, phone2: typeof d.phone2 === "string" ? d.phone2 : null, unlocked: d.unlocked === true } };
  }
  if (status === "payment_required") return { phase: "pay", price: Number(d.price) || 0 };
  if (status === "limit") return { phase: "error", error: "limit" };
  return { phase: "error", error: "none" };
}

/** 0088 qo'llanmagan baza: kirgan foydalanuvchiga avvalgi yo'l (0074 / 0081 — rozilik va shaxsiy limit) */
async function legacyWorkerPhone(id: string): Promise<RevealOutcome> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("simple_worker_listing", { p_id: id });
  if (error) return { phase: "error", error: "unavailable" };
  const row = data?.[0];
  return row?.phone ? { phase: "shown", phones: { phone: row.phone, phone2: row.phone2 ?? null } } : { phase: "error", error: "none" };
}

/**
 * "Chatda yozish" (0088): raqami ochilgan ishchi bilan suhbat — topiladi yoki yaratiladi; boshqa holatda chat yo'q
 * (ega: odamlar o'rtasida xabar faqat raqam ochilgandan keyin).
 */
export async function openContactChat(input: unknown): Promise<ActionResult<{ conversationId: string }>> {
  const parsed = z.object({ workerId: z.uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const session = await getSession().catch(() => null);
  if (!session) return { ok: false, error: "not_authenticated" };
  const supabase = await createClient();
  const { data: wp } = await supabase.from("worker_profiles").select("profile_id").eq("id", parsed.data.workerId).maybeSingle();
  if (!wp?.profile_id) return { ok: false, error: "not_found" };
  const { data, error } = await supabase.rpc("open_contact_chat", { p_other: wp.profile_id });
  if (error || !data) return { ok: false, error: error?.message?.includes("chat_requires_unlock") ? "chat_requires_unlock" : "unavailable" };
  return { ok: true, data: { conversationId: data } };
}
