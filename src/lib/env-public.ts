/**
 * Ochiq muhit o'zgaruvchilari (faqat NEXT_PUBLIC_*) — mijozda ham ishlatiladi, shuning uchun zod'siz: zod (~90 KB siqilgan)
 * shu uch qatorni tekshirish uchun natija kartalari bor har bir sahifa JS'iga tushardi. Server o'zgaruvchilari — `@/lib/env`.
 * Tekshiruv avvalgi zod sxemasi bilan bir xil: ikki manzil to'g'ri URL, kalit kamida 10 belgi, APP_URL bo'lmasa — localhost.
 */
export interface PublicEnv {
  NEXT_PUBLIC_SUPABASE_URL: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
  NEXT_PUBLIC_APP_URL: string;
}

function isUrl(value: string | undefined): value is string {
  if (!value) return false;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

/** Qiymatlar argument sifatida — test uchun; ilovada `publicEnv` ishlatiladi */
export function readPublicEnv(env: { url: string | undefined; anonKey: string | undefined; appUrl: string | undefined }): PublicEnv {
  if (!isUrl(env.url) || !env.anonKey || env.anonKey.length < 10 || (env.appUrl !== undefined && !isUrl(env.appUrl))) {
    // Build vaqtida (masalan CI) env bo'lmasligi mumkin — aniq xabar beramiz
    throw new Error(
      "Supabase muhit o'zgaruvchilari yo'q: NEXT_PUBLIC_SUPABASE_URL va NEXT_PUBLIC_SUPABASE_ANON_KEY ni .env.local ga yozing (.env.example ga qarang); " +
        "Vercel'da — Settings → Environment Variables, shu build muhiti uchun (Production yoki Preview) belgilangan bo'lsin",
    );
  }
  return { NEXT_PUBLIC_SUPABASE_URL: env.url, NEXT_PUBLIC_SUPABASE_ANON_KEY: env.anonKey, NEXT_PUBLIC_APP_URL: env.appUrl ?? "http://localhost:3000" };
}

// process.env.NEXT_PUBLIC_* — to'liq nomi bilan (Next.js mijoz bundle'iga shu ko'rinishda qo'yadi)
export const publicEnv: PublicEnv = readPublicEnv({
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  appUrl: process.env.NEXT_PUBLIC_APP_URL,
});
