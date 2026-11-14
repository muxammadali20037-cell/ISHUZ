import "server-only";

import { after } from "next/server";
import { sweepPublishedContent } from "./sweep";

/**
 * Eski e'lonlarni qayta tekshirishni (sweep.ts) sayt trafigi bilan ham ishga tushirish. Fon navbati (pg_cron → tick) faqat
 * navbatda ish bo'lsa chaqiriladi — yangi qoidalar chiqqach, bitta ham yangi e'lon bo'lmasa, eski taqiqlangan e'lonlar
 * ochiq qolib ketardi. Shu sabab tez-tez chaqiriladigan endpointlar (statistika hodisasi, holat tekshiruvi) javobdan KEYIN
 * (after) bir qadam tekshiradi. Foydalanuvchi kutmaydi.
 *
 * Har server nusxasida: bir vaqtda bitta; ish qolgan bo'lsa ~10 soniyada, xato bo'lsa 2 daqiqada, hammasi tekshirilgan
 * bo'lsa soatiga ko'pi bilan bir marta (tugagani bazadagi kursordan bitta so'rov bilan bilinadi).
 */
const BUSY_MS = 10_000;
const RETRY_MS = 2 * 60_000;
const IDLE_MS = 60 * 60_000;

let nextAt = 0;
let running = false;

export function sweepSoon(): void {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  const now = Date.now();
  if (running || now < nextAt) return;
  running = true;
  nextAt = now + RETRY_MS;
  try {
    after(async () => {
      try {
        const r = await sweepPublishedContent(100, 8_000);
        nextAt = Date.now() + (r.done ? IDLE_MS : BUSY_MS);
      } catch (e) {
        console.error("[moderation] sweep trigger", e instanceof Error ? e.message : e);
        nextAt = Date.now() + RETRY_MS;
      } finally {
        running = false;
      }
    });
  } catch (e) {
    // so'rov doirasidan tashqarida chaqirilgan — keyingi so'rovda qayta urinadi
    running = false;
    console.error("[moderation] sweep trigger", e instanceof Error ? e.message : e);
  }
}
