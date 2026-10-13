import { expect, test } from "@playwright/test";
import { USERS, asGuest, asMode, formReady, loginAs, sql } from "../support";

// E: e'lon berish va qidiruv — shu rejimda (rejim tanlanmasa, avval tasdiq so'raladi)
test.beforeEach(async ({ context }) => {
  await asMode(context, "worker");
});

/**
 * Qabul #25: tugma, karta, navigatsiya va ro'yxat chiqishida UI ovozi yo'q; ovoz sozlamasi tugmasi ham yo'q.
 * Sahifaga oldindan hisoblagich qo'yiladi: AudioContext yaratilishi va ossillyator ishga tushishi sanaladi.
 * (Chatdagi ovozli xabar — foydalanuvchi o'zi bosib eshitadigan <audio> — bu talabga kirmaydi.)
 */

async function instrument(page: import("@playwright/test").Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __audio: { contexts: number; tones: number } } & Record<string, unknown>;
    w.__audio = { contexts: 0, tones: 0 };
    for (const name of ["AudioContext", "webkitAudioContext"]) {
      const Orig = w[name] as (new (...a: unknown[]) => AudioContext) | undefined;
      if (!Orig) continue;
      w[name] = class extends Orig {
        constructor(...args: unknown[]) {
          super(...args);
          w.__audio.contexts++;
        }
      };
    }
    const start = OscillatorNode.prototype.start;
    OscillatorNode.prototype.start = function (...args: Parameters<typeof start>) {
      w.__audio.tones++;
      return start.apply(this, args);
    };
  });
}

const counts = (page: import("@playwright/test").Page) => page.evaluate(() => (window as unknown as { __audio: { contexts: number; tones: number } }).__audio);

test("mehmon: bosh sahifa → qidiruv → hudud → natija — ovoz yo'q", async ({ page, context }) => {
  await asGuest(context);
  await instrument(page);
  await page.goto("/");
  await expect(page.getByRole("button", { name: /Ovozni (o'chirish|yoqish)/ })).toHaveCount(0);
  // bosh sahifadan to'g'ridan-to'g'ri "Ish e'lonlari" (qidiruvning birinchi savoli o'tkazib yuboriladi)
  await page.locator("main a[data-track='direction_select'][href='/search?mode=jobs']").click();
  await page.waitForURL(/mode=jobs/);
  await page.waitForLoadState("networkidle");
  const [n] = await sql<{ id: string }>("select id from public.profession_nodes where name_uz = 'Buxgalter' and selectable limit 1");
  await page.goto(`/search?mode=jobs&p=${n!.id}&region=all`);
  await page.waitForLoadState("networkidle");
  await page.keyboard.press("Tab");
  expect(await counts(page)).toEqual({ contexts: 0, tones: 0 });
});

test("e'lon formasi: kasb qidirish, sohalar ro'yxati, tanlash — ovoz yo'q", async ({ page, context }) => {
  await sql("delete from public.worker_profiles where profile_id = $1", [USERS.workerB]); // bo'sh forma
  await loginAs(context, USERS.workerB);
  await instrument(page);
  await page.goto("/post/worker");
  await formReady(page);
  await page.getByLabel("Kasb yoki sohani qidiring").fill("Buxgalter");
  await page.getByRole("button").filter({ hasText: "Tanlash" }).first().waitFor();
  await page.getByRole("button", { name: /^Davom etish/ }).click();
  await page.waitForTimeout(500);
  expect(await counts(page)).toEqual({ contexts: 0, tones: 0 });
});
