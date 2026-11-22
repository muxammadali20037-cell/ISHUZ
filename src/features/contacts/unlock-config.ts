import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export interface ContactUnlockConfig {
  /** ishchi raqami pullik (admin yoqadi — Payme/Click ulangandan keyin) */
  paid: boolean;
  /** narx, so'm */
  price: number;
}

const DEFAULT: ContactUnlockConfig = { paid: false, price: 5000 };

/**
 * Raqam ochish sozlamasi (0088): app_settings.contact_unlock_paid / price_contact_unlock — ochiq sozlamalar (RLS: is_public).
 * Sozlama yo'q (0088 qo'llanmagan) yoki o'qib bo'lmasa — bepul (avvalgi holat).
 */
export const getContactUnlockConfig = cache(async (): Promise<ContactUnlockConfig> => {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("app_settings").select("key, value").in("key", ["contact_unlock_paid", "price_contact_unlock"]);
    if (error || !data) return DEFAULT;
    const paid = data.find((r) => r.key === "contact_unlock_paid")?.value === true;
    const raw = Number(data.find((r) => r.key === "price_contact_unlock")?.value);
    const price = Number.isFinite(raw) && raw >= 100 ? Math.round(raw) : DEFAULT.price;
    return { paid, price };
  } catch {
    return DEFAULT;
  }
});
