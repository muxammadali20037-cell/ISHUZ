import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { makeT } from "@/lib/i18n/translate";
import { formatSalaryWithPeriod } from "@/lib/format";
import { sanitizeLine } from "@/features/telegram-channel/autopost-format";
import type { PostCardData } from "./post-card";

const one = <T,>(x: T | T[] | null | undefined): T | null => (Array.isArray(x) ? (x[0] ?? null) : (x ?? null));

/**
 * Ishchi e'loni rasmi uchun ma'lumot (kanal posti va egasiga bot xabari): FAQAT kasbi, tajribasi, joyi va kutilayotgan maosh.
 * Ism, telefon, rasm va erkin matn ("o'zim haqimda") YO'Q. Ko'rsatiladi faqat ommaviy e'lon — kanalga avtomatik e'lon
 * qoidasi bilan bir xil: is_public, ro'yxatdan o'tib bo'lgan, muallifi bloklanmagan, kasbi ma'lum. Aks holda — null (404).
 * Telegram rasmni anonim yuklaydi, RLS esa ishchi profilini faqat kirganlarga ko'rsatadi — shuning uchun server kaliti bilan,
 * faqat shu ustunlar o'qiladi.
 */
export async function getWorkerPostCard(id: string): Promise<PostCardData | null> {
  const db = createAdminClient();
  const { data: w, error } = await db
    .from("worker_profiles")
    .select(
      "id, is_public, onboarding_completed_at, custom_profession, experience_level, profession:profession_nodes!worker_profiles_profession_node_id_fkey(name_uz), region:regions!worker_profiles_region_id_fkey(name_uz), district:districts!worker_profiles_district_id_fkey(name_uz), prefs:worker_preferences(salary_expected, salary_min, salary_type), owner:profiles!worker_profiles_profile_id_fkey(is_blocked)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("[promo] worker", error.message);
    return null;
  }
  if (!w || !w.is_public || !w.onboarding_completed_at || one(w.owner)?.is_blocked) return null;
  const profession = sanitizeLine(w.custom_profession ?? one(w.profession)?.name_uz ?? null, 70);
  if (!profession) return null;
  const t = makeT("uz");
  const prefs = one(w.prefs);
  const amount = prefs?.salary_expected ?? prefs?.salary_min ?? null;
  const salary = amount
    ? formatSalaryWithPeriod(
        { from: amount, to: null, type: prefs?.salary_type ?? null, negotiable: false },
        "uz",
        { negotiable: t("bot.channel.negotiable"), from: t("common.labels.salary_from"), to: t("common.labels.salary_to") },
        (type) => t(`enums.salary_type_suffix.${type}`),
      )
    : t("bot.channel.salary_negotiable");
  const place = [one(w.district)?.name_uz, one(w.region)?.name_uz].filter(Boolean).join(", ") || null;
  return {
    title: profession,
    company: null,
    experience: w.experience_level ? t("bot.channel.experience", { value: t(`enums.experience_level.${w.experience_level}`) }) : null,
    place,
    salary,
    badge: t("bot.channel.worker_badge"),
  };
}
