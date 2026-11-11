import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isCronAuthorized } from "@/features/notifications/cron-auth";
import { checkSchema } from "@/features/health/schema-probes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

const DB_TIMEOUT_MS = 4000;

function withTimeout<T>(p: PromiseLike<T>, ms: number): Promise<T> {
  return Promise.race([Promise.resolve(p), new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms))]);
}

/**
 * Holat tekshiruvi (uptime monitor uchun): GET /api/health
 *   200 {status:"ok"} — ilova ishlayapti va bazaga ulanadi; 503 {status:"down"} — baza javob bermadi.
 * Ochiq javobda faqat holat, baza kechikishi va reliz (commit) — maxfiy ma'lumot yo'q.
 * Chuqur tekshiruv: GET /api/health?deep=1 + `Authorization: Bearer CRON_SECRET` — qaysi migratsiya prod bazada yo'qligi
 * (kod bilan baza nomuvofiqligi). Migratsiya yetishmasa — 503 {status:"degraded"}.
 */
export async function GET(req: NextRequest) {
  const started = Date.now();
  const release = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null;
  const headers = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" };

  let dbOk = false;
  let dbMs: number | null = null;
  try {
    const db = createAdminClient();
    const t0 = Date.now();
    const { error } = await withTimeout(db.from("app_settings").select("key").limit(1), DB_TIMEOUT_MS);
    dbMs = Date.now() - t0;
    dbOk = !error;
    if (error) console.error("[health] db:", error.code, error.message);
  } catch (e) {
    console.error("[health] db:", e instanceof Error ? e.message : e);
  }

  const body: Record<string, unknown> = { status: dbOk ? "ok" : "down", db: { ok: dbOk, ms: dbMs }, release, at: new Date().toISOString() };
  let status = dbOk ? 200 : 503;

  if (req.nextUrl.searchParams.get("deep") === "1") {
    if (!isCronAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers });
    if (dbOk) {
      const schema = await checkSchema(createAdminClient());
      body.schema = schema;
      if (!schema.ok) {
        body.status = "degraded";
        status = 503;
      }
    }
  }

  body.ms = Date.now() - started;
  return NextResponse.json(body, { status, headers });
}
