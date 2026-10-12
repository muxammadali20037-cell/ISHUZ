import { createClient } from "@/lib/supabase/client";
import { DOC_MIME, LOGO_MIME, validateDocumentFile, validateLogoFile } from "./schema";
import { legacyMediaPath, MEDIA_BUCKET, MEDIA_QUARANTINE, rawMediaPath } from "@/features/media/paths";

/** Client tomonida Storage'ga yuklash (RLS: company-logos → kompaniya admini, documents → egasi). */

export type UploadResult = { ok: true; path: string } | { ok: false; error: string };

export async function uploadCompanyLogo(companyId: string, file: File): Promise<UploadResult> {
  const invalid = validateLogoFile(file);
  if (invalid) return { ok: false, error: invalid };
  const ext = LOGO_MIME[file.type];
  if (!ext) return { ok: false, error: "employer.form.errors.logo_type" };
  // xom fayl yopiq karantinga (faqat kompaniya admini); 0059 qo'llanmagan bo'lsa — eski nom bilan. Server qayta kodlaydi.
  const supabase = createClient();
  let path = rawMediaPath("logo", companyId, ext);
  let { error } = await supabase.storage.from(MEDIA_QUARANTINE).upload(path, file, { upsert: false, contentType: file.type });
  if (error) {
    path = legacyMediaPath("logo", companyId, ext);
    ({ error } = await supabase.storage.from(MEDIA_BUCKET.logo).upload(path, file, { upsert: true, contentType: file.type, cacheControl: "3600" }));
  }
  if (error) {
    console.error("[employer] uploadCompanyLogo", error.message);
    return { ok: false, error: "employer.form.errors.upload_failed" };
  }
  return { ok: true, path };
}

export async function uploadVerificationDocument(userId: string, file: File): Promise<UploadResult> {
  const invalid = validateDocumentFile(file);
  if (invalid) return { ok: false, error: invalid };
  const ext = DOC_MIME[file.type];
  if (!ext) return { ok: false, error: "employer.verification.errors.doc_type" };
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const supabase = createClient();
  const { error } = await supabase.storage.from("documents").upload(path, file, { upsert: false, contentType: file.type });
  if (error) {
    console.error("[employer] uploadVerificationDocument", error.message);
    return { ok: false, error: "employer.form.errors.upload_failed" };
  }
  return { ok: true, path };
}

/** Yuborilmagan hujjatni o'chirish (best-effort) */
export async function removeVerificationDocument(path: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.storage.from("documents").remove([path]);
  if (error) console.error("[employer] removeVerificationDocument", error.message);
}
