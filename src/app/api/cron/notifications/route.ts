import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isCronAuthorized } from "@/features/notifications/cron-auth";
import { dispatchTelegramNotifications } from "@/features/notifications/telegram-dispatch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Supabase pg_cron `ishuz-telegram` (0015) har daqiqada, kutayotgan xabar bo'lsa chaqiradi: yuborilmagan bildirishnomalarni Telegram bot orqali yuboradi.
 * Auth: Authorization: Bearer CRON_SECRET (Vercel avtomatik yuboradi) yoki x-cron-secret.
 */
async function handle(req: NextRequest) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const admin = createAdminClient();
    const counts = await dispatchTelegramNotifications(admin, { limit: 200 });
    return NextResponse.json({ ok: true, ...counts, at: new Date().toISOString() });
  } catch (e) {
    console.error("[cron notifications]", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: "internal" }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
