import { z } from "zod";

/**
 * Muhit o'zgaruvchilari. Client'ga faqat NEXT_PUBLIC_* chiqadi.
 * Server o'zgaruvchilari `serverEnv` orqali, faqat server kodida ishlatiladi.
 */
const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(10),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
});

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(10).optional(),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_BOT_USERNAME: z.string().optional(),
  TELEGRAM_WEBHOOK_SECRET: z.string().optional(),
  CRON_SECRET: z.string().optional(),
  /** Google Play (TWA): paket nomi va imzo sertifikati SHA-256 barmoq izlari (vergul bilan) */
  ANDROID_PACKAGE_NAME: z.string().default("uz.ishberuvchi.app"),
  ANDROID_SHA256_CERT_FINGERPRINTS: z.string().optional(),
  APP_URL: z.string().url().default("http://localhost:3000"),
  /** Google Search Console / Yandex Webmaster: sayt egaligini tasdiqlash kodi (meta teg "content" qiymati) */
  GOOGLE_SITE_VERIFICATION: z.string().optional(),
  YANDEX_VERIFICATION: z.string().optional(),
  /** Maxfiylik siyosati va do'kon sahifasidagi aloqa uchun email (ixtiyoriy) */
  SUPPORT_EMAIL: z.string().email().optional(),
  /** Huquqiy sahifalardagi operator rekvizitlari, masalan: «"Topdim" MChJ, STIR 123456789, Toshkent sh., ...» (ixtiyoriy) */
  LEGAL_OPERATOR: z.string().optional(),
  /** AI yordamchi (Claude). Bo'lmasa AI tugmalari ko'rinmaydi */
  ANTHROPIC_API_KEY: z.string().optional(),
  /** Google Gemini (bepul limit): bo'lsa AI uchun birinchi navbatda shu ishlatiladi */
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().optional(),
  /** Faqat sinov uchun: Gemini API o'rniga boshqa manzil (lokal soxta server) */
  GEMINI_BASE_URL: z.string().url().optional(),
  /** Admin panel alohida domeni, masalan admin.ishtopdim.uz (bo'lmasa /admin asosiy domenda) */
  ADMIN_HOST: z.string().optional(),
  /** Kasb rasmlari generatsiyasi — matnli AI dan ALOHIDA kalit (alohida vakolat va xarajat nazorati). Bo'lmasa rasm yaratilmaydi, ikonka chiqadi */
  IMAGE_GEN_API_KEY: z.string().optional(),
  /** Google Gemini rasm modeli (standart: gemini-2.5-flash-image) */
  IMAGE_GEN_MODEL: z.string().optional(),
  /** Faqat sinov uchun: boshqa manzil (masalan lokal soxta server) */
  IMAGE_GEN_BASE_URL: z.string().url().optional(),
  /** Payme (Paycom) merchant: kassa ID va kalit; PAYME_TEST=1 — test kassa */
  PAYME_MERCHANT_ID: z.string().optional(),
  PAYME_KEY: z.string().optional(),
  PAYME_TEST: z.string().optional(),
  /** Click SHOP API */
  CLICK_SERVICE_ID: z.string().optional(),
  CLICK_MERCHANT_ID: z.string().optional(),
  CLICK_SECRET_KEY: z.string().optional(),
});

function readPublic() {
  const parsed = publicSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  });
  if (!parsed.success) {
    // Build vaqtida (masalan CI) env bo'lmasligi mumkin — aniq xabar beramiz
    throw new Error(
      "Supabase muhit o'zgaruvchilari yo'q: NEXT_PUBLIC_SUPABASE_URL va NEXT_PUBLIC_SUPABASE_ANON_KEY ni .env.local ga yozing (.env.example ga qarang)",
    );
  }
  return parsed.data;
}

export const publicEnv = readPublic();

export function getServerEnv() {
  return serverSchema.parse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
    TELEGRAM_BOT_USERNAME: process.env.TELEGRAM_BOT_USERNAME,
    TELEGRAM_WEBHOOK_SECRET: process.env.TELEGRAM_WEBHOOK_SECRET,
    CRON_SECRET: process.env.CRON_SECRET,
    ANDROID_PACKAGE_NAME: process.env.ANDROID_PACKAGE_NAME || undefined,
    ANDROID_SHA256_CERT_FINGERPRINTS: process.env.ANDROID_SHA256_CERT_FINGERPRINTS,
    APP_URL: process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL,
    GOOGLE_SITE_VERIFICATION: process.env.GOOGLE_SITE_VERIFICATION || undefined,
    YANDEX_VERIFICATION: process.env.YANDEX_VERIFICATION || undefined,
    SUPPORT_EMAIL: process.env.SUPPORT_EMAIL || undefined,
    LEGAL_OPERATOR: process.env.LEGAL_OPERATOR || undefined,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || undefined,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY || undefined,
    GEMINI_MODEL: process.env.GEMINI_MODEL || undefined,
    GEMINI_BASE_URL: process.env.GEMINI_BASE_URL || undefined,
    ADMIN_HOST: process.env.ADMIN_HOST || undefined,
    IMAGE_GEN_API_KEY: process.env.IMAGE_GEN_API_KEY || undefined,
    IMAGE_GEN_MODEL: process.env.IMAGE_GEN_MODEL || undefined,
    IMAGE_GEN_BASE_URL: process.env.IMAGE_GEN_BASE_URL || undefined,
    PAYME_MERCHANT_ID: process.env.PAYME_MERCHANT_ID || undefined,
    PAYME_KEY: process.env.PAYME_KEY || undefined,
    PAYME_TEST: process.env.PAYME_TEST || undefined,
    CLICK_SERVICE_ID: process.env.CLICK_SERVICE_ID || undefined,
    CLICK_MERCHANT_ID: process.env.CLICK_MERCHANT_ID || undefined,
    CLICK_SECRET_KEY: process.env.CLICK_SECRET_KEY || undefined,
  });
}
