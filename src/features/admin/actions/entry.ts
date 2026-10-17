"use server";

import { revalidatePath, updateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { errorCode } from "@/lib/utils";
import type { ActionResult } from "@/features/auth/actions";
import type { Json } from "@/types/database.types";
import { ENTRY_MEDIA_KEY, entryMediaSchema } from "@/features/entry/media";
import { ENTRY_TAG } from "@/features/entry/queries";
import { logAdmin, requirePerm, snapshot } from "./guard";
import { storeSiteImage } from "./site-image";

/*
 * Kirish ekranlari (admin → "Kirish ekranlari"): tanishtiruv va rol kartalari rasmlari.
 * Yozuv: app_settings.entry_media (RLS: settings.manage; ochiq o'qiladi) + audit; sayt keshi darhol yangilanadi.
 * Sozlama qatori bo'lmasa — yaratiladi (migratsiya shart emas).
 */

/** Barcha joylar birga: { slot: yo'l | null }. Faqat o'z storage'imizdagi qayta kodlangan rasm yo'li qabul qilinadi */
export async function saveEntryMedia(input: unknown): Promise<ActionResult> {
  const parsed = entryMediaSchema.strict().safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const guard = await requirePerm("settings.manage");
  if (!guard.ok) return guard;
  const value = Object.fromEntries(Object.entries(parsed.data).filter(([, v]) => typeof v === "string")) as NonNullable<Json>;
  const supabase = await createClient();
  const { data: before } = await supabase.from("app_settings").select("key, value, is_public").eq("key", ENTRY_MEDIA_KEY).maybeSingle();
  const { data, error } = before
    ? await supabase.from("app_settings").update({ value, is_public: true }).eq("key", ENTRY_MEDIA_KEY).select("key, value, is_public").maybeSingle()
    : await supabase.from("app_settings").insert({ key: ENTRY_MEDIA_KEY, value, is_public: true }).select("key, value, is_public").maybeSingle();
  if (error) return { ok: false, error: errorCode(error) };
  if (!data) return { ok: false, error: "forbidden" };
  await logAdmin(supabase, "settings.update", "app_setting", ENTRY_MEDIA_KEY, snapshot(before), snapshot(data));
  updateTag(ENTRY_TAG);
  revalidatePath("/start", "layout");
  revalidatePath("/admin/entry");
  revalidatePath("/admin/audit");
  return { ok: true };
}

/** Bitta rasm: tekshirilib, metama'lumotsiz WebP (≤1600 px) qilib site-media/entry ga yoziladi; yo'li qaytadi */
export async function uploadEntryImage(form: FormData): Promise<ActionResult<{ path: string }>> {
  const guard = await requirePerm("settings.manage");
  if (!guard.ok) return guard;
  return storeSiteImage(form, { folder: "entry", actorId: guard.ctx.session.userId, reason: "entry_media", maxSide: 1600 });
}
