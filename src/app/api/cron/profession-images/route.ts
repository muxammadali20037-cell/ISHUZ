import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isCronAuthorized } from "@/features/notifications/cron-auth";
import { ensureProfessionImages, imageGenConfig } from "@/lib/profession-images/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Faol e'lonlarda ishlatilayotgan, lekin hali rasmi yo'q kasblar uchun rasm yaratadi (bir chaqiruvda ko'pi bilan 5 ta).
 * Auth: Authorization: Bearer CRON_SECRET. Kalit (IMAGE_GEN_API_KEY) yo'q bo'lsa hech narsa qilmaydi.
 * Kunlik limit bazada: app_settings.profession_images_daily_limit.
 */
async function handle(req: NextRequest) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!imageGenConfig()) return NextResponse.json({ ok: true, configured: false });
  try {
    const admin = createAdminClient();
    const [{ data: vac }, { data: wrk }, { data: done }] = await Promise.all([
      admin.from("vacancies").select("profession_node_id").eq("status", "active").not("profession_node_id", "is", null).order("published_at", { ascending: false }).limit(300),
      admin.from("worker_profiles").select("profession_node_id").eq("is_public", true).not("profession_node_id", "is", null).order("last_active_at", { ascending: false }).limit(300),
      admin.from("profession_images").select("node_id").in("status", ["ready", "pending"]).limit(5000),
    ]);
    const have = new Set((done ?? []).map((r) => r.node_id));
    const wanted = [...new Set([...(vac ?? []), ...(wrk ?? [])].map((r) => r.profession_node_id).filter((x): x is string => !!x && !have.has(x)))];
    const stats = await ensureProfessionImages(wanted, 5);
    return NextResponse.json({ ok: true, configured: true, candidates: wanted.length, ...stats });
  } catch (e) {
    console.error("[cron profession-images]", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: "internal" }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
