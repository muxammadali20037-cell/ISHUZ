import "server-only";

import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { reencodeImage } from "@/lib/security/image-reencode";
import { logSecurityEvent } from "@/lib/security/events";
import type { ActionResult } from "@/features/auth/actions";

const MAX_UPLOAD = 4 * 1024 * 1024;

/**
 * Admin yuklagan sayt rasmi (bosh sahifa oynalari, kirish ekranlari): mazmuni tekshiriladi (magic bytes, piksel),
 * metama'lumotsiz WebP (≤ maxSide px) qilib ommaviy site-media ga mazmun xeshi nomi bilan yoziladi (0060; mijoz bu bucket'ga
 * yoza olmaydi). Ruxsat tekshiruvi — chaqiruvchida (requirePerm). Natija — sozlamaga yoziladigan yo'l.
 */
export async function storeSiteImage(
  form: FormData,
  opts: { folder: "windows" | "entry"; actorId: string; reason: string; maxSide: number },
): Promise<ActionResult<{ path: string }>> {
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0 || file.size > MAX_UPLOAD) return { ok: false, error: "image_invalid" };
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return { ok: false, error: "image_unavailable" };
  const out = await reencodeImage(Buffer.from(await file.arrayBuffer()), file.type, { maxSide: opts.maxSide, quality: 84 });
  if (!out) {
    await logSecurityEvent({ type: "upload.content_rejected", severity: "low", reason: opts.reason, actorId: opts.actorId, action: "blocked" });
    return { ok: false, error: "image_invalid" };
  }
  const name = `${opts.folder}/v-${createHash("sha256").update(out).digest("hex")}.webp`;
  const { error } = await createAdminClient().storage.from("site-media").upload(name, out, { contentType: "image/webp", cacheControl: "31536000", upsert: true });
  if (error) return { ok: false, error: /not.?found/i.test(error.message) ? "needs_migration" : "image_unavailable" };
  return { ok: true, data: { path: `site-media/${name}` } };
}
