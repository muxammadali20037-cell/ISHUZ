import { NextResponse, type NextRequest } from "next/server";
import { isCronAuthorized } from "@/features/notifications/cron-auth";
import { sendWeeklyReport } from "@/features/admin/weekly.server";
import { reportError } from "@/lib/monitoring";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Haftalik raqamlar hisoboti adminlarga (saytdagi bildirishnoma + Telegram, outbox orqali).
 * Vercel Cron (vercel.json) har dushanba 04:00 UTC = 09:00 Toshkent chaqiradi; boshqa paytda hech narsa qilmaydi.
 * Qo'lda sinash: ?force=1 (oxirgi tugagan hafta; takror yubormaydi — dedupe_key).
 * Auth: Authorization: Bearer CRON_SECRET (Vercel Cron o'zi yuboradi) yoki x-cron-secret.
 */
async function handle(req: NextRequest) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const force = req.nextUrl.searchParams.get("force") === "1";
    const result = await sendWeeklyReport(new Date(), { force });
    return NextResponse.json({ ok: true, ...result, at: new Date().toISOString() });
  } catch (e) {
    await reportError(e, { where: "cron-weekly-report" });
    return NextResponse.json({ ok: false, error: "internal" }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
