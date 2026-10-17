"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { errorCode } from "@/lib/utils";
import type { ActionResult } from "@/features/auth/actions";
import type { Json } from "@/types/database.types";
import { DEFAULT_WINDOWS, homeWindowsSchema } from "@/features/home-windows/model";
import { HOME_TAG } from "@/features/home-windows/queries";
import { logAdmin, requirePerm, snapshot } from "./guard";
import { storeSiteImage } from "./site-image";

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

/** Oyna rasmi: tekshirilib, metama'lumotsiz WebP (≤1280 px) qilib site-media ga yoziladi (site-image.ts) */
export async function uploadWindowImage(form: FormData): Promise<ActionResult<{ path: string }>> {
  const guard = await requirePerm("settings.manage");
  if (!guard.ok) return guard;
  return storeSiteImage(form, { folder: "windows", actorId: guard.ctx.session.userId, reason: "home_window", maxSide: 1280 });
}
