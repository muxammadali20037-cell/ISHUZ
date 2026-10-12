"use server";

import { createHash } from "node:crypto";
import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { errorCode } from "@/lib/utils";
import { reencodeImage } from "@/lib/security/image-reencode";
import { logSecurityEvent } from "@/lib/security/events";
import type { ActionResult } from "@/features/auth/actions";
import type { Json } from "@/types/database.types";
import { DEFAULT_WINDOWS, homeWindowsSchema } from "@/features/home-windows/model";
import { HOME_TAG } from "@/features/home-windows/queries";
import { logAdmin, requirePerm, snapshot } from "./guard";

/*
 * Bosh sahifa (admin → "Bosh sahifa"): tepadagi rasmli oynalar va o'ng pastdagi lupa tugmasi.
 * Yozuv: app_settings (RLS: settings.manage) + audit (admin_log); sayt keshi darhol yangilanadi (updateTag).
 */

async function writeSetting(key: "home_banners" | "ai_search_button", value: NonNullable<Json>): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: before } = await supabase.from("app_settings").select("key, value, is_public").eq("key", key).maybeSingle();
  if (!before) return { ok: false, error: "needs_migration" };
  const { data, error } = await supabase.from("app_settings").update({ value, is_public: true }).eq("key", key).select("key, value, is_public").maybeSingle();
  if (error) return { ok: false, error: errorCode(error) };
  if (!data) return { ok: false, error: "forbidden" };
  await logAdmin(supabase, "settings.update", "app_setting", key, snapshot(before), snapshot(data));
  updateTag(HOME_TAG);
  revalidatePath("/", "layout");
  revalidatePath("/admin/home");
  revalidatePath("/admin/audit");
  return { ok: true };
}

/** Oynalar ro'yxati (tartib, matnlar, havola, rasm); null — standart uchta oynaga qaytarish */
export async function saveHomeWindows(input: unknown): Promise<ActionResult> {
  const parsed = z.object({ windows: homeWindowsSchema.nullable() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const guard = await requirePerm("settings.manage");
  if (!guard.ok) return guard;
  const ids = parsed.data.windows?.map((w) => w.id) ?? [];
  if (new Set(ids).size !== ids.length) return { ok: false, error: "validation" };
  return writeSetting("home_banners", (parsed.data.windows ?? DEFAULT_WINDOWS) as unknown as NonNullable<Json>);
}

/** "O'zingizga mosini toping" lupa tugmasi */
export async function setAiSearchButton(input: unknown): Promise<ActionResult> {
  const parsed = z.object({ enabled: z.boolean() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const guard = await requirePerm("settings.manage");
  if (!guard.ok) return guard;
  return writeSetting("ai_search_button", parsed.data.enabled);
}

const MAX_UPLOAD = 4 * 1024 * 1024;

/**
 * Oyna rasmi: mazmuni tekshiriladi (magic bytes, piksel), metama'lumotsiz WebP (≤1280 px) qilib ommaviy site-media ga
 * mazmun xeshi nomi bilan yoziladi (0060; mijoz bu bucket'ga yoza olmaydi). Natija — oynaga yoziladigan yo'l.
 */
export async function uploadWindowImage(form: FormData): Promise<ActionResult<{ path: string }>> {
  const guard = await requirePerm("settings.manage");
  if (!guard.ok) return guard;
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0 || file.size > MAX_UPLOAD) return { ok: false, error: "image_invalid" };
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return { ok: false, error: "image_unavailable" };
  const out = await reencodeImage(Buffer.from(await file.arrayBuffer()), file.type, { maxSide: 1280, quality: 84 });
  if (!out) {
    await logSecurityEvent({ type: "upload.content_rejected", severity: "low", reason: "home_window", actorId: guard.ctx.session.userId, action: "blocked" });
    return { ok: false, error: "image_invalid" };
  }
  const name = `windows/v-${createHash("sha256").update(out).digest("hex")}.webp`;
  const { error } = await createAdminClient().storage.from("site-media").upload(name, out, { contentType: "image/webp", cacheControl: "31536000", upsert: true });
  if (error) return { ok: false, error: /not.?found/i.test(error.message) ? "needs_migration" : "image_unavailable" };
  return { ok: true, data: { path: `site-media/${name}` } };
}
