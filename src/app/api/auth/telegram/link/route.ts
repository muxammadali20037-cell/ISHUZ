import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerEnv } from "@/lib/env";
import { verifyTelegramInitData } from "@/lib/telegram/verify";
import { getSession } from "@/features/auth/session";

/**
 * Kirgan foydalanuvchi (telefon orqali) Telegram hisobini bog'laydi.
 * Mini App ichida sessiya bor holda chaqiriladi.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  const { TELEGRAM_BOT_TOKEN } = getServerEnv();
  if (!TELEGRAM_BOT_TOKEN) return NextResponse.json({ error: "telegram_not_configured" }, { status: 503 });

  const body = z.object({ initData: z.string().min(10) }).safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const tgUser = verifyTelegramInitData(body.data.initData, TELEGRAM_BOT_TOKEN);
  if (!tgUser) return NextResponse.json({ error: "invalid_init_data" }, { status: 401 });

  const admin = createAdminClient();
  const { data: existing } = await admin.from("telegram_accounts").select("profile_id").eq("telegram_user_id", tgUser.id).maybeSingle();
  if (existing && existing.profile_id !== session.userId) {
    return NextResponse.json({ error: "telegram_linked_to_other_account" }, { status: 409 });
  }
  const { error } = await admin.from("telegram_accounts").upsert(
    {
      telegram_user_id: tgUser.id,
      profile_id: session.userId,
      username: tgUser.username ?? null,
      first_name: tgUser.first_name,
      last_name: tgUser.last_name ?? null,
      photo_url: tgUser.photo_url ?? null,
      language_code: tgUser.language_code ?? null,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "telegram_user_id" },
  );
  if (error) return NextResponse.json({ error: "generic" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
