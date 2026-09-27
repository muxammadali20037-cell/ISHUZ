import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerEnv } from "@/lib/env";
import { verifyTelegramInitData } from "@/lib/telegram/verify";
import { ensureTelegramProfile, startSessionForProfile } from "@/features/auth/telegram-session";

/**
 * Telegram Mini App orqali kirish.
 * 1) initData imzosi tekshiriladi (server, bot token bilan).
 * 2) telegram_accounts orqali profil topiladi; bo'lmasa yangi auth.users yaratiladi.
 * 3) Admin API bilan magic-link token yaratilib, serverda verifyOtp → sessiya cookie'lari.
 */
export async function POST(req: NextRequest) {
  const { TELEGRAM_BOT_TOKEN } = getServerEnv();
  if (!TELEGRAM_BOT_TOKEN) return NextResponse.json({ error: "telegram_not_configured" }, { status: 503 });

  const body = z.object({ initData: z.string().min(10), locale: z.enum(["uz", "ru"]).optional() }).safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const tgUser = verifyTelegramInitData(body.data.initData, TELEGRAM_BOT_TOKEN);
  if (!tgUser) return NextResponse.json({ error: "invalid_init_data" }, { status: 401 });

  try {
    const admin = createAdminClient();
    const userId = await ensureTelegramProfile(admin, tgUser, body.data.locale);
    await startSessionForProfile(admin, userId, tgUser.id);
    return NextResponse.json({ ok: true, userId });
  } catch (e) {
    console.error("[telegram auth]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "auth_failed" }, { status: 500 });
  }
}
