import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isCronAuthorized } from "@/features/notifications/cron-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Kuniga 1 marta (Supabase pg_cron `ishuz-maintenance` to'g'ridan-to'g'ri SQL bilan bajaradi; bu endpoint qo'lda ishga tushirish uchun): muddati o'tgan vakansiya/takliflarni yopish va
 * 1–2 kun ichida tugaydigan vakansiyalar haqida ogohlantirish.
 */
async function handle(req: NextRequest) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const admin = createAdminClient();
    const [expired, expiredOffers, notified] = await Promise.all([admin.rpc("expire_vacancies"), admin.rpc("expire_offers"), admin.rpc("notify_expiring_vacancies")]);
    const errors = [expired.error, expiredOffers.error, notified.error].filter((e): e is NonNullable<typeof e> => !!e).map((e) => e.message);
    if (errors.length) console.error("[cron vacancies]", errors.join("; "));
    return NextResponse.json(
      {
        ok: errors.length === 0,
        expiredVacancies: expired.data ?? 0,
        expiredOffers: expiredOffers.data ?? 0,
        expiringNotified: notified.data ?? 0,
        errors,
        at: new Date().toISOString(),
      },
      { status: errors.length ? 500 : 200 },
    );
  } catch (e) {
    console.error("[cron vacancies]", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: "internal" }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
