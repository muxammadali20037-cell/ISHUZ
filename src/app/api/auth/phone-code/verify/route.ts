import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizePhone } from "@/lib/format";
import { LOGIN_CODE_MAX_ATTEMPTS, loginCodeMatches, startSessionForProfile } from "@/features/auth/telegram-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Telegram orqali yuborilgan kodni tekshiradi va sessiya ochadi (cookie). */
export async function POST(req: NextRequest) {
  const body = z.object({ phone: z.string().max(32), code: z.string().regex(/^\d{6}$/) }).safeParse(await req.json().catch(() => null));
  const phone = body.success ? normalizePhone(body.data.phone) : null;
  if (!body.success || !phone) return NextResponse.json({ error: "invalid_code" }, { status: 400 });

  try {
    const admin = createAdminClient();
    const limited = await admin.rpc("check_rate_limit", { p_key: `tgcode:verify:${phone}`, p_limit: 15, p_window_seconds: 3600 });
    if (limited.data === false) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

    const { data: row } = await admin
      .from("login_codes")
      .select("id, telegram_user_id, code_hash, attempts, expires_at")
      .eq("phone", phone)
      .is("consumed_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!row || new Date(row.expires_at).getTime() < Date.now() || row.attempts >= LOGIN_CODE_MAX_ATTEMPTS) {
      return NextResponse.json({ error: "code_expired" }, { status: 400 });
    }

    if (!loginCodeMatches(phone, body.data.code, row.code_hash)) {
      const attempts = row.attempts + 1;
      await admin
        .from("login_codes")
        .update({ attempts, ...(attempts >= LOGIN_CODE_MAX_ATTEMPTS ? { consumed_at: new Date().toISOString() } : {}) })
        .eq("id", row.id);
      return NextResponse.json({ error: attempts >= LOGIN_CODE_MAX_ATTEMPTS ? "code_expired" : "invalid_code" }, { status: 400 });
    }

    // bir marta ishlatish: parallel so'rovlardan faqat bittasi o'tadi
    const { data: consumed } = await admin
      .from("login_codes")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", row.id)
      .is("consumed_at", null)
      .select("id");
    if (!consumed?.length) return NextResponse.json({ error: "code_expired" }, { status: 400 });

    const { data: account } = await admin
      .from("telegram_accounts")
      .select("profile_id, phone")
      .eq("telegram_user_id", row.telegram_user_id)
      .maybeSingle();
    if (!account || account.phone !== phone) return NextResponse.json({ error: "code_expired" }, { status: 400 });

    await startSessionForProfile(admin, account.profile_id, row.telegram_user_id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[phone-code verify]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "auth_failed" }, { status: 500 });
  }
}
