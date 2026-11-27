"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateProfessionImage } from "@/lib/profession-images/server";
import type { ActionResult } from "@/features/auth/actions";
import { logAdmin, requirePerm } from "./guard";

/*
 * Kasb rasmlari — admin (ega, 2026-11-27: "Kerak bo'lganda + tugma"). Oddiy holatda rasm kasbga birinchi marta kerak
 * bo'lganda yaratiladi (e'lon tekshiruvi, joylashdan keyin fonda, soatlik fon vazifasi). Bu yerda ega ommabop kasblarga
 * OLDINDAN yaratadi (har bosishda bir nechta; har biri ~$0.05) yoki yoqmagan rasmni almashtiradi. Chegaralar bazada
 * (claim_profession_image_by: faqat faol admin, profession_images_admin_daily). Har amal — audit jurnalida.
 */

/** bir bosishda: har rasm 20–60 s, sahifa maxDuration = 300 */
const BATCH = 4;
const STOP = new Set(["daily_limit", "not_configured", "disabled", "forbidden", "provider_unavailable"]);

/** Rasmi yo'q kasblar — faol e'lonlarda ko'p ishlatilgani birinchi, keyin "ommabop" belgilanganlar */
async function professionImageCandidates(limit: number): Promise<string[]> {
  const admin = createAdminClient();
  const [{ data: vac }, { data: wrk }, { data: popular }, { data: done }] = await Promise.all([
    admin.from("vacancies").select("profession_node_id").eq("status", "active").not("profession_node_id", "is", null).limit(2000),
    admin.from("worker_profiles").select("profession_node_id").eq("is_public", true).not("profession_node_id", "is", null).limit(2000),
    admin.from("profession_nodes").select("id").eq("is_popular", true).eq("is_active", true).order("sort_order").limit(500),
    admin.from("profession_images").select("node_id, status, updated_at").limit(5000),
  ]);
  const busy = new Set(
    (done ?? []).filter((r) => r.status === "ready" || (r.status === "pending" && Date.parse(r.updated_at) > Date.now() - 5 * 60_000)).map((r) => r.node_id),
  );
  const uses = new Map<string, number>();
  for (const r of [...(vac ?? []), ...(wrk ?? [])]) if (r.profession_node_id) uses.set(r.profession_node_id, (uses.get(r.profession_node_id) ?? 0) + 1);
  const used = [...uses.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
  const ordered = [...new Set([...used, ...(popular ?? []).map((p) => p.id)])];
  return ordered.filter((id) => !busy.has(id)).slice(0, limit);
}

export async function generateProfessionImagesBatch(): Promise<ActionResult<{ generated: number; failed: number; error: string | null }>> {
  const guard = await requirePerm("categories.manage");
  if (!guard.ok) return guard;
  const ids = await professionImageCandidates(BATCH);
  let generated = 0;
  let failed = 0;
  let stop: string | null = null;
  for (const id of ids) {
    const res = await generateProfessionImage(id, guard.ctx.session.userId, { batch: true });
    if (res.ok) generated++;
    else if (res.error !== "busy" && res.error !== "exists") {
      failed++;
      if (STOP.has(res.error)) {
        stop = res.error;
        break;
      }
    }
  }
  const supabase = await createClient();
  await logAdmin(supabase, "profession_images.generate", "profession_images", null, null, { nodes: ids, generated, failed, stop });
  revalidatePath("/admin/professions");
  if (!generated && stop) return { ok: false, error: stop };
  return { ok: true, data: { generated, failed, error: stop } };
}

export async function regenerateProfessionImage(input: unknown): Promise<ActionResult<{ url: string }>> {
  const parsed = z.object({ nodeId: z.uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const guard = await requirePerm("categories.manage");
  if (!guard.ok) return guard;
  const res = await generateProfessionImage(parsed.data.nodeId, guard.ctx.session.userId, { force: true });
  const supabase = await createClient();
  await logAdmin(supabase, "profession_images.regenerate", "profession_node", parsed.data.nodeId, null, { ok: res.ok, error: res.ok ? null : res.error });
  revalidatePath("/admin/professions");
  return res.ok ? { ok: true, data: { url: res.url } } : { ok: false, error: res.error };
}
