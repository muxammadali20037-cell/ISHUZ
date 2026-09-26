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
  APP_URL: z.string().url().default("http://localhost:3000"),
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
    APP_URL: process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL,
  });
}
