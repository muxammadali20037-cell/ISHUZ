import { NextResponse, type NextRequest } from "next/server";
import { isCronAuthorized } from "@/features/notifications/cron-auth";
import { runBackgroundTick } from "@/features/notifications/tick";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * pg_cron `ishuz-telegram` (0051) har daqiqada, navbatda ish bo'lsagina chaqiradi:
 * moderatsiya navbati → moslik hodisalari → Telegram outbox.
 * Auth: Authorization: Bearer CRON_SECRET yoki x-cron-secret.
 */
async function handle(req: NextRequest) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const result = await runBackgroundTick({ moderation: 8, matchJobs: 20, telegram: 200, budgetMs: 50_000 });
    return NextResponse.json({ ok: true, ...result, at: new Date().toISOString() });
  } catch (e) {
    console.error("[cron tick]", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: "internal" }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
