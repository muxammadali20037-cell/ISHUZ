"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath, updateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logSecurityEvent } from "@/lib/security/events";
import { errorCode } from "@/lib/utils";
import type { ActionResult } from "@/features/auth/actions";
import { MAX_VIDEO_BYTES, storyInputSchema, storyMediaUrl, VIDEO_PATH_RE, VIDEO_TYPES, videoSignatureOk, type VideoExt } from "@/features/stories/model";
import { STORIES_TAG } from "@/features/stories/queries";
import { logAdmin, requirePerm, snapshot } from "./guard";
import { storeSiteImage } from "./site-image";

/*
 * Admin → "Hikoyalar" (0079): "Ish Topdim" nomidan bosh sahifa tepasidagi rasm/video hikoyalar.
 * Huquq — settings.manage. Yozuv admin sessiyasi bilan (RLS) + audit; sayt keshi darhol yangilanadi.
 * Rasm — server qayta kodlaydi (WebP, metama'lumotsiz). Video — brauzer bir martalik imzolangan havola bilan Storage'ga
 * to'g'ridan-to'g'ri yuklaydi (server funksiyasi orqali 50 MB o'tmaydi); saqlashdan oldin server fayl boshidagi baytlardan
 * haqiqatan video ekanini tekshiradi.
 */

function refresh() {
  updateTag(STORIES_TAG);
  revalidatePath("/admin/hikoyalar");
  revalidatePath("/admin/audit");
}

/** Rasm (hikoyaning o'zi yoki video muqovasi): tekshirilib, WebP (≤ 1920 px) qilib site-media/stories ga yoziladi */
export async function uploadStoryImage(form: FormData): Promise<ActionResult<{ path: string }>> {
  const guard = await requirePerm("settings.manage");
  if (!guard.ok) return guard;
  return storeSiteImage(form, { folder: "stories", actorId: guard.ctx.session.userId, reason: "story_media", maxSide: 1920 });
}

/** Video yuklash uchun bir martalik havola (2 soat): nom serverda tanlanadi — brauzer boshqa joyga yoza olmaydi */
export async function startStoryVideoUpload(input: { type: string; size: number }): Promise<ActionResult<{ path: string; name: string; token: string }>> {
  const guard = await requirePerm("settings.manage");
  if (!guard.ok) return guard;
  const ext = (VIDEO_TYPES as Record<string, VideoExt | undefined>)[input?.type];
  if (!ext) return { ok: false, error: "video_type" };
  if (!(input.size > 0) || input.size > MAX_VIDEO_BYTES) return { ok: false, error: "video_size" };
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return { ok: false, error: "image_unavailable" };
  const name = `v/${randomUUID()}.${ext}`;
  const { data, error } = await createAdminClient().storage.from("story-videos").createSignedUploadUrl(name);
  if (error || !data?.token) return { ok: false, error: error && /not.?found/i.test(error.message) ? "needs_migration" : "image_unavailable" };
  return { ok: true, data: { path: `story-videos/${name}`, name, token: data.token } };
}

/** Yuklangan video haqiqatan video ekanini tekshirish (birinchi baytlar); bo'lmasa — fayl o'chiriladi */
async function verifyVideo(path: string, actorId: string): Promise<boolean> {
  const url = storyMediaUrl(path);
  const ext = path.split(".").pop() as VideoExt;
  if (!url || !VIDEO_PATH_RE.test(path)) return false;
  try {
    const res = await fetch(url, { headers: { range: "bytes=0-63" }, cache: "no-store", signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return false;
    const reader = res.body?.getReader();
    const first = reader ? (await reader.read()).value : undefined;
    await reader?.cancel().catch(() => undefined);
    if (first && videoSignatureOk(first.subarray(0, 64), ext)) return true;
  } catch {
    return false;
  }
  await createAdminClient().storage.from("story-videos").remove([path.replace(/^story-videos\//, "")]).catch(() => undefined);
  await logSecurityEvent({ type: "upload.content_rejected", severity: "low", reason: "story_video", actorId, action: "blocked" });
  return false;
}

/** Yangi hikoya yoki tahrirlash */
export async function saveStory(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = storyInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const guard = await requirePerm("settings.manage");
  if (!guard.ok) return guard;
  const v = parsed.data;
  const supabase = await createClient();
  const before = v.id ? (await supabase.from("stories").select("*").eq("id", v.id).maybeSingle()).data : null;
  if (v.id && !before) return { ok: false, error: "not_found" };
  // yangi video (yoki almashtirilgan) — mazmuni tekshiriladi
  if (v.kind === "video" && before?.media_path !== v.mediaPath && !(await verifyVideo(v.mediaPath, guard.ctx.session.userId))) {
    return { ok: false, error: "video_invalid" };
  }
  const now = new Date();
  const startsAt = before ? new Date(before.starts_at) : now;
  const row = {
    title: v.title,
    caption: v.caption || null,
    media_kind: v.kind,
    media_path: v.mediaPath,
    poster_path: v.kind === "video" ? (v.posterPath ?? null) : null,
    cta_label: v.ctaLabel || null,
    cta_url: v.ctaUrl || null,
    audience: v.audience,
    duration_sec: v.durationSec,
    is_active: v.isActive,
    // muddat — hozirdan (tahrirda ham: "yana 7 kun tursin")
    ends_at: v.days ? new Date(Math.max(now.getTime(), startsAt.getTime()) + v.days * 86_400_000).toISOString() : null,
  };
  const { data, error } = v.id
    ? await supabase.from("stories").update(row).eq("id", v.id).select("*").maybeSingle()
    : await supabase
        .from("stories")
        .insert({ ...row, starts_at: now.toISOString(), created_by: guard.ctx.session.userId, sort_order: await nextOrder(supabase) })
        .select("*")
        .maybeSingle();
  if (error) return { ok: false, error: /stories/.test(error.message) && /does not exist|schema cache/i.test(error.message) ? "needs_migration" : errorCode(error) };
  if (!data) return { ok: false, error: "forbidden" };
  // almashtirilgan eski video — o'chiriladi (rasmlar mazmun xeshi bilan saqlanadi, boshqa joyda ham ishlatilishi mumkin)
  if (before && before.media_path !== data.media_path && VIDEO_PATH_RE.test(before.media_path)) await removeVideo(before.media_path);
  await logAdmin(supabase, v.id ? "story.update" : "story.create", "story", data.id, snapshot(before), snapshot(data));
  refresh();
  return { ok: true, data: { id: data.id } };
}

async function nextOrder(supabase: Awaited<ReturnType<typeof createClient>>): Promise<number> {
  const { data } = await supabase.from("stories").select("sort_order").order("sort_order", { ascending: true }).limit(1).maybeSingle();
  // yangisi — eng boshida
  return (data?.sort_order ?? 0) - 1;
}

async function removeVideo(path: string) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !VIDEO_PATH_RE.test(path)) return;
  await createAdminClient().storage.from("story-videos").remove([path.replace(/^story-videos\//, "")]).catch(() => undefined);
}

/** Yoqish / o'chirish (o'chirilgani saytda ko'rinmaydi, lekin admin ro'yxatida qoladi) */
export async function setStoryActive(id: string, active: boolean): Promise<ActionResult> {
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/.test(id)) return { ok: false, error: "validation" };
  const guard = await requirePerm("settings.manage");
  if (!guard.ok) return guard;
  const supabase = await createClient();
  const { data, error } = await supabase.from("stories").update({ is_active: !!active }).eq("id", id).select("id, is_active").maybeSingle();
  if (error) return { ok: false, error: errorCode(error) };
  if (!data) return { ok: false, error: "not_found" };
  await logAdmin(supabase, "story.toggle", "story", id, null, snapshot(data));
  refresh();
  return { ok: true };
}

/** Tartib: ro'yxatdagi ketma-ketlik (birinchisi — eng chapda) */
export async function reorderStories(ids: string[]): Promise<ActionResult> {
  if (!Array.isArray(ids) || ids.length > 100 || ids.some((x) => typeof x !== "string" || !/^[0-9a-f-]{36}$/.test(x))) return { ok: false, error: "validation" };
  const guard = await requirePerm("settings.manage");
  if (!guard.ok) return guard;
  const supabase = await createClient();
  for (const [i, id] of ids.entries()) {
    const { error } = await supabase.from("stories").update({ sort_order: i }).eq("id", id);
    if (error) return { ok: false, error: errorCode(error) };
  }
  await logAdmin(supabase, "story.reorder", "story", null, null, ids);
  refresh();
  return { ok: true };
}

/** O'chirish: qator va video fayli (qaytarib bo'lmaydi — admin tasdiqlaydi) */
export async function deleteStory(id: string): Promise<ActionResult> {
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/.test(id)) return { ok: false, error: "validation" };
  const guard = await requirePerm("settings.manage");
  if (!guard.ok) return guard;
  const supabase = await createClient();
  const { data, error } = await supabase.from("stories").delete().eq("id", id).select("*").maybeSingle();
  if (error) return { ok: false, error: errorCode(error) };
  if (!data) return { ok: false, error: "not_found" };
  if (VIDEO_PATH_RE.test(data.media_path)) await removeVideo(data.media_path);
  await logAdmin(supabase, "story.delete", "story", id, snapshot(data), null);
  refresh();
  return { ok: true };
}
