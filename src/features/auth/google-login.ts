import "server-only";

import { unstable_cache } from "next/cache";
import { publicEnv } from "@/lib/env-public";

/**
 * Google orqali kirish yoqilganmi: Supabase → Authentication → Providers → Google yoqilgan bo'lsa (Client ID va Secret
 * kiritilgan). Kod alohida sozlamasiz: ega Supabase'da yoqishi bilan (5 daqiqagacha) tugma chiqadi, o'chirsa — yo'qoladi.
 * Supabase javob bermasa — tugma ko'rsatilmaydi (Telegram va telefon orqali kirish ishlayveradi).
 */
const googleEnabledCached = unstable_cache(
  async (): Promise<boolean> => {
    const res = await fetch(`${publicEnv.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY },
      signal: AbortSignal.timeout(3000),
    });
    // xato keshlanmaydi — keyingi so'rovda qayta tekshiriladi
    if (!res.ok) throw new Error(`auth_settings:${res.status}`);
    const json = (await res.json()) as { external?: Record<string, unknown> };
    return json.external?.google === true;
  },
  ["auth-google-enabled-v1"],
  { revalidate: 300 },
);

export async function googleLoginEnabled(): Promise<boolean> {
  try {
    return await googleEnabledCached();
  } catch (error) {
    console.warn("[auth] google settings", error instanceof Error ? error.message : error);
    return false;
  }
}
