"use server";

import { headers } from "next/headers";
import { z } from "zod";
import type { ActionResult } from "@/features/auth/actions";
import { getSession } from "@/features/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hitRate } from "@/lib/rate-limit";
import { clientIp, subjectHash } from "@/lib/security/request";

export interface RevealedPhones {
  phone: string;
  phone2: string | null;
}

/** mehmon: bitta IP dan soatiga 20, sutkasiga 60 ta turli raqam (OLX kabi — oddiy odamga yetadi, yig'uvchiga emas) */
const GUEST_PER_HOUR = 20;
const GUEST_PER_DAY = 60;

/**
 * "Raqamni ko'rsatish" (ega, 2026-11-18: "telefon raqam hammaga ko'rinsin" — tugma bosilganda).
 *  · kirgan foydalanuvchi — avvalgi yo'l (0074: simple_vacancy_phone / simple_worker_listing, shaxsiy limit bilan);
 *  · mehmon — IP bo'yicha limit (fail-closed), keyin 0084 listing_phones_public (server kaliti).
 * Xatolar: none — e'londa ochiq raqam yo'q; limit — juda ko'p so'rov; unavailable — vaqtincha ishlamayapti.
 */
export async function revealListingPhone(input: unknown): Promise<ActionResult<RevealedPhones>> {
  const parsed = z.object({ kind: z.enum(["vacancy", "worker"]), id: z.uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const { kind, id } = parsed.data;

  const session = await getSession().catch(() => null);
  if (session) {
    const supabase = await createClient();
    if (kind === "vacancy") {
      const { data, error } = await supabase.rpc("simple_vacancy_phone", { p_vacancy_id: id });
      if (error) return { ok: false, error: "unavailable" };
      return data ? { ok: true, data: { phone: data, phone2: null } } : { ok: false, error: "none" };
    }
    const { data, error } = await supabase.rpc("simple_worker_listing", { p_id: id });
    if (error) return { ok: false, error: "unavailable" };
    const row = data?.[0];
    return row?.phone ? { ok: true, data: { phone: row.phone, phone2: row.phone2 ?? null } } : { ok: false, error: "none" };
  }

  const ip = subjectHash("ip", clientIp(await headers()));
  const [hour, day] = await Promise.all([hitRate(`phone_reveal_h:${ip}`, GUEST_PER_HOUR, 3600), hitRate(`phone_reveal_d:${ip}`, GUEST_PER_DAY, 86_400)]);
  if ([hour, day].some((r) => !r.ok && r.reason === "unavailable")) return { ok: false, error: "unavailable" };
  if (!hour.ok || !day.ok) return { ok: false, error: "limit" };
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return { ok: false, error: "unavailable" };
  const { data, error } = await createAdminClient().rpc("listing_phones_public", { p_kind: kind, p_id: id });
  if (error) return { ok: false, error: "unavailable" };
  const row = data?.[0];
  return row?.phone ? { ok: true, data: { phone: row.phone, phone2: row.phone2 ?? null } } : { ok: false, error: "none" };
}
