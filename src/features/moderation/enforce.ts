import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { logSecurityEvent } from "@/lib/security/events";
import { banReason, shouldBan } from "./policy";

export interface Violation {
  profileId: string;
  category: string;
  /** qoida yoki AI sabab kodi (masalan rule_strict_massage, erotic_services) */
  code: string;
  source: "rules" | "ai";
  /** qayerda topildi: vacancy | worker | master_listing | master_request | master_review | listing_chat | ai_post */
  entity: string;
}

/**
 * Og'ir qoidabuzarlik uchun jazo (faqat server, service role):
 *  1) hisob bloklanadi (profiles.is_blocked + sabab + vaqt) — kira olmaydi, e'lon bera olmaydi, xabar yoza olmaydi;
 *  2) barcha ochiq e'lonlari darhol yashiriladi: vakansiyalar → "hidden", ishchi e'loni → ommaviy emas, ustalar e'lonlari → "rejected";
 *  3) xavfsizlik hodisasi (admin ogohlantirishi bilan) yoziladi.
 * O'chirish yumshoq: hech narsa bazadan o'chmaydi — admin noto'g'ri bloklashni "Blokdan chiqarish" bilan qaytaradi.
 * Faol adminlar bloklanmaydi (sinov va moderatsiya ishi) — hodisa baribir yoziladi.
 * Hech qachon xato tashlamaydi: asosiy oqim (e'lonni rad etish) baribir ishlaydi.
 */
export async function banForViolation(v: Violation): Promise<boolean> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !v.profileId) return false;
  try {
    const db = createAdminClient();
    const { data: admin } = await db.from("admin_users").select("is_active").eq("profile_id", v.profileId).maybeSingle();
    const exempt = !!admin?.is_active;
    let newly = false;
    if (!exempt) {
      const { data: changed } = await db
        .from("profiles")
        .update({ is_blocked: true, blocked_reason: banReason(v.category, v.code), blocked_at: new Date().toISOString() })
        .eq("id", v.profileId)
        .eq("is_blocked", false)
        .select("id");
      newly = (changed?.length ?? 0) > 0;
      await Promise.all([
        db.from("vacancies").update({ status: "hidden" }).eq("owner_profile_id", v.profileId).in("status", ["active", "pending_review", "paused"]),
        db.from("worker_profiles").update({ is_public: false }).eq("profile_id", v.profileId),
        db
          .from("master_listings")
          .update({ status: "rejected", reject_reason: "prohibited_content" })
          .eq("owner_profile_id", v.profileId)
          .in("status", ["active", "pending_review", "hidden"]),
      ]);
    }
    // allaqachon bloklangan muallifning yana bir e'loni topilsa — e'lonlari yana yashiriladi, hodisa qayta yozilmaydi
    if (!exempt && !newly) return true;
    await logSecurityEvent({
      type: "moderation.auto_ban",
      severity: "high",
      reason: v.category,
      actorId: v.profileId,
      action: exempt ? "observed" : "blocked",
      details: { entity: v.entity, code: v.code.slice(0, 60), source: v.source, admin_exempt: exempt },
    });
    return !exempt;
  } catch (e) {
    console.error("[moderation] ban failed", e instanceof Error ? e.message : e);
    return false;
  }
}

/** Qoidalar natijasi bo'yicha (darhol, AI'gacha): "block" topilmasi og'ir toifada bo'lsa — bloklash */
export async function banIfRuleBlock(
  profileId: string | null | undefined,
  block: { rule: string; category: string } | null,
  entity: string,
): Promise<boolean> {
  if (!profileId || !block || !shouldBan({ decision: "reject", category: block.category })) return false;
  return banForViolation({ profileId, category: block.category, code: `rule_${block.rule}`, source: "rules", entity });
}
