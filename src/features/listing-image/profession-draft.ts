import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { generateProfessionImage, readyProfessionImage } from "@/lib/profession-images/server";
import { draftAllowed, type ListingEntity, type ListingImageResult } from "./server";

/**
 * Kasb rasmi → e'lon qoralamasi (ega, 2026-11-27: "har bitta kasbga rasm yaratib olsak, birinchi qo'yib chiqsin — oddiy
 * rasmni tanlab «Joylash» bossa buzilmasin"). Kasbning tayyor rasmi qoralamaga yoziladi (listing_images, holati "ready",
 * fayl nusxalanmaydi — profession-images bucket'idagi o'sha manzil); joylanganda attachDraftImage uni e'longa o'tkazadi —
 * mavjud yo'l, hech narsa o'zgarmaydi. Usta e'lonida kasb daraxti yo'q — kasb rasmi ham yo'q.
 */
async function copyToDraft(entity: ListingEntity, draftId: string, userId: string, url: string, nodeId: string): Promise<ListingImageResult> {
  const { error } = await createAdminClient()
    .from("listing_images")
    .upsert(
      {
        entity,
        entity_id: draftId,
        owner_profile_id: userId,
        status: "ready",
        image_url: url,
        storage_path: null,
        prompt: `profession:${nodeId}`,
        model: "profession",
        attempts: 0,
        last_error: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "entity,entity_id" },
    );
  return error ? { ok: false, error: "unavailable" } : { ok: true, url };
}

/** Faqat tayyor kasb rasmi (xarajatsiz). Yo'q bo'lsa — "no_preset" (tekshiruvda "Rasm yaratish" tugmasi chiqadi) */
export async function presetDraftImage(entity: ListingEntity, draftId: string, userId: string, professionId: string): Promise<ListingImageResult> {
  if (entity === "master") return { ok: false, error: "no_preset" };
  const url = await readyProfessionImage(professionId);
  if (!url) return { ok: false, error: "no_preset" };
  if (!(await draftAllowed(entity, draftId, userId))) return { ok: false, error: "forbidden" };
  return copyToDraft(entity, draftId, userId, url, professionId);
}

/**
 * "Rasm yaratish" (kasb tanlangan): kasb rasmi bor bo'lsa — o'sha (xarajatsiz); yo'q bo'lsa — kasb rasmi yaratiladi
 * (keyingi odamlar uchun ham) va qoralamaga yoziladi. `null` — kasb rasmi yo'lidan foydalanib bo'lmadi (hozir boshqa
 * birov shu kasbga yaratyapti, o'chirilgan, 3 marta xato bo'lgan) — chaqiruvchi oddiy e'lon rasmini yaratadi.
 */
export async function professionDraftImage(entity: ListingEntity, draftId: string, userId: string, professionId: string): Promise<ListingImageResult | null> {
  if (entity === "master") return null;
  if (!(await draftAllowed(entity, draftId, userId))) return { ok: false, error: "forbidden" };
  const ready = await readyProfessionImage(professionId);
  if (ready) return copyToDraft(entity, draftId, userId, ready, professionId);
  const res = await generateProfessionImage(professionId, userId);
  if (res.ok) return copyToDraft(entity, draftId, userId, res.url, professionId);
  if (res.error === "exists") {
    const url = await readyProfessionImage(professionId);
    return url ? copyToDraft(entity, draftId, userId, url, professionId) : null;
  }
  // xarajat chegarasi, moderatsiya, provayder ishlamayapti, yaratib bo'lmadi — foydalanuvchiga o'sha javob (qayta urinsin)
  if (["user_limit", "daily_limit", "moderation", "provider_unavailable", "generation_failed", "not_configured"].includes(res.error)) return res;
  return null;
}
