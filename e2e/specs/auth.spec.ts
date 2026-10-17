import { expect, test, type Page } from "@playwright/test";
import { USERS, asGuest, loginAs } from "../support";

/**
 * C8.6 · kirish va hisob. Stendda Telegram bot yo'q — shuning uchun:
 *  · "bot sozlanmagan" holati haqiqiy server bilan (soxta "kod yuborildi" yo'q);
 *  · kod yuborilgan/noto'g'ri/eskirgan/qayta yuborish holatlari server javobi page.route bilan beriladi (UI tekshiruvi);
 *  · haqiqiy Telegram orqali kod yetkazish — BLOCKED (staging + real bot kerak).
 */

/** 8-ekran (telefon raqam); kirish usuli ekranidan keyin — entry-flow.spec.ts */
async function openAuth(page: Page) {
  await page.goto("/auth/telefon?next=%2Fcabinet");
  const phone = page.locator("#phone");
  await phone.fill("90 123 45 67");
  await expect(phone).toHaveValue("+998 90 123 45 67");
}

test("bot sozlanmagan: tushunarli xabar, soxta 'kod yuborildi' yo'q, forma joyida", async ({ page, context }) => {
  await asGuest(context);
  await openAuth(page);
  // sarlavha haqiqatni aytadi: veb'da kod Telegram orqali keladi (avval "kod ham kerak emas" deyilardi)
  await expect(page.getByText("Tasdiqlash kodini Telegram orqali yuboramiz (SMS emas).")).toBeVisible();
  await page.getByRole("button", { name: "Kod yuborish" }).click();
  await expect(page.getByText("Telegram orqali kirish hozircha o'chirilgan")).toBeVisible();
  await expect(page.getByText(/yuborildi/)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Kod yuborish" })).toBeEnabled();
});

test("internet yo'q: 'Internet aloqasi yo'q', umumiy xato emas", async ({ page, context }) => {
  await asGuest(context);
  await openAuth(page);
  await context.setOffline(true);
  await page.getByRole("button", { name: "Kod yuborish" }).click();
  await expect(page.getByText(/Internet aloqasi yo'q/)).toBeVisible();
  await context.setOffline(false);
});

test("server vaqtincha ishlamayapti (503): aniq sabab ko'rsatiladi", async ({ page, context }) => {
  await asGuest(context);
  await page.route("**/api/auth/phone-code/send", (r) => r.fulfill({ status: 503, json: { error: "temporarily_unavailable" } }));
  await openAuth(page);
  await page.getByRole("button", { name: "Kod yuborish" }).click();
  await expect(page.getByText("Xizmat vaqtincha ishlamayapti. Birozdan keyin qayta urinib ko'ring.")).toBeVisible();
  await expect(page.getByText("Kirib bo'lmadi. Qayta urinib ko'ring.")).toHaveCount(0);
});

test("raqam Telegram'ga ulanmagan: ulash yo'riqnomasi", async ({ page, context }) => {
  await asGuest(context);
  await page.route("**/api/auth/phone-code/send", (r) => r.fulfill({ status: 404, json: { error: "telegram_not_linked" } }));
  await openAuth(page);
  await page.getByRole("button", { name: "Kod yuborish" }).click();
  await expect(page.getByRole("heading", { name: "Raqamni Telegram'ga ulang" })).toBeVisible();
  await expect(page.locator("ol li")).toHaveCount(3);
});

test("kod: noto'g'ri, eskirgan, 60 s dan keyin qayta yuborish", async ({ page, context }) => {
  await asGuest(context);
  await page.clock.install();
  let sends = 0;
  await page.route("**/api/auth/phone-code/send", (r) => {
    sends++;
    return r.fulfill({ status: 200, json: { ok: true } });
  });
  const verify: { error: string }[] = [{ error: "invalid_code" }, { error: "code_expired" }];
  await page.route("**/api/auth/phone-code/verify", (r) => r.fulfill({ status: 400, json: verify.shift() ?? { error: "invalid_code" } }));
  await openAuth(page);
  await page.getByRole("button", { name: "Kod yuborish" }).click();

  const code = page.getByLabel("6 xonali kod");
  await expect(code).toBeAttached();
  await expect(page.getByText(/Qayta yuborish: \d+ s/)).toBeVisible();
  // 6 raqam kiritilganda o'zi tekshiriladi
  await code.fill("123456");
  await expect(page.getByText("Kod noto'g'ri")).toBeVisible();
  await code.fill("654321");
  await expect(page.getByText("Kod muddati tugagan. Yangi kod so'rang.")).toBeVisible();

  // hisoblagich har soniyada qayta rejalashtiriladi — vaqtni soniyama-soniya o'tkazamiz (React har qadamda chizadi)
  for (let i = 0; i < 61; i++) await page.clock.runFor(1000);
  await page.getByRole("button", { name: "Kodni qayta yuborish" }).click();
  await expect.poll(() => sends).toBe(2);
  await expect(page.getByText(/Qayta yuborish: \d+ s/)).toBeVisible();
});

test("chiqish: sarlavhada yana 'Kirish', kabinet kirishni taklif qiladi", async ({ page, context }) => {
  await loginAs(context, USERS.workerA);
  await page.goto("/");
  await page.getByRole("banner").getByRole("button").last().click();
  await page.getByRole("menuitem", { name: "Chiqish" }).click();
  await expect(page.getByRole("banner").getByRole("link", { name: "Kirish" })).toBeVisible();
  await page.goto("/cabinet");
  await expect(page.getByRole("heading", { name: "Hisobga kiring" })).toBeVisible();
  await expect(page.getByRole("main").getByRole("link", { name: "Hisobga kirish" })).toHaveAttribute("href", "/auth?next=%2Fcabinet");
});
