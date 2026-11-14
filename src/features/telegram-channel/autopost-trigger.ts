import "server-only";

import { after } from "next/server";
import { getServerEnv } from "@/lib/env";
import { runChannelAutopost } from "./autopost";

/**
 * Kanalga avtomatik e'lonni sayt trafigi bilan yurgizish (fon navbati faqat navbatda ish bo'lsa chaqiriladi — tasdiqlangan
 * e'lon kanalga kechikib qolmasin). Javobdan KEYIN (after), har server nusxasida bir vaqtda bitta va daqiqasiga ko'pi bilan
 * bir marta; kanal sozlanmagan bo'lsa (bot huquqi yo'q) — 10 daqiqada bir.
 */
const EVERY_MS = 60_000;
const BACKOFF_MS = 10 * 60_000;

let nextAt = 0;
let running = false;

export function autopostSoon(): void {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !getServerEnv().TELEGRAM_BOT_TOKEN) return;
  const now = Date.now();
  if (running || now < nextAt) return;
  running = true;
  nextAt = now + EVERY_MS;
  try {
    after(async () => {
      try {
        const r = await runChannelAutopost();
        if (r.stopped) nextAt = Date.now() + BACKOFF_MS;
      } finally {
        running = false;
      }
    });
  } catch (e) {
    running = false;
    console.error("[channel-autopost] trigger", e instanceof Error ? e.message : e);
  }
}
