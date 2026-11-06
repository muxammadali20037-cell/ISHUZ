import { expect, test } from "@playwright/test";
import { USERS, asGuest, loginAs, sql } from "../support";

/**
 * Admin → "Telegram kanal": bot holati, tayyor materiallar (video / albom) va matn tahriri.
 * Sinov muhitida bot tokeni yo'q — sahifa buni aniq aytadi va yuborish tugmasi o'chiq turadi (hech narsa Telegramga ketmaydi).
 */

test.beforeEach(async () => {
  await sql(
    `insert into public.admin_users (profile_id, role, permissions, is_active) values ($1, 'super_admin', '{}', true)
     on conflict (profile_id) do update set is_active = true, role = 'super_admin'`,
    [USERS.workerB],
  );
});
test.afterEach(async () => {
  await sql("delete from public.admin_users where profile_id = $1", [USERS.workerB]);
});

test("admin: kanal sahifasi — holat, tayyor izoh, belgilar chegarasi, ko'rinish", async ({ page, context }) => {
  await loginAs(context, USERS.workerB, "aal2");
  await page.goto("/admin/telegram");
  await expect(page.getByRole("heading", { level: 1, name: "Telegram kanal" })).toBeVisible();
  await expect(page.getByText("Telegram bot ulanmagan (TELEGRAM_BOT_TOKEN sozlanmagan)")).toBeVisible();
  const send = page.getByRole("button", { name: "Kanalga yuborish" });
  await expect(send).toBeDisabled();
  await expect(page.getByText("Yuborish uchun avval botni kanalga admin qiling.")).toBeVisible();

  // standart — «Telegramda — bepul» reklamasi, matn uning tayyor izohi bilan
  const text = page.getByRole("textbox", { name: "Post matni" });
  await expect(page.getByRole("radio", { name: /«Telegramda — bepul» reklamasi/ })).toBeChecked();
  await expect(text).toHaveValue(/^📲 Endi hammasi — Telegramda\. Hozircha bepul!/);
  const preview = page.getByRole("region", { name: "Ko'rinishi" });
  await expect(preview.getByText("Endi hammasi — Telegramda.", { exact: false })).toBeVisible();
  await expect(preview.getByText("0:59")).toBeVisible();

  // manifest video
  await page.getByRole("radio", { name: /«Birgalikda quramiz» videosi/ }).click();
  await expect(text).toHaveValue(/^🇺🇿 O‘ZBEKISTON, KELING, BIRGALIKDA QURAMIZ!/);
  await expect(preview.getByText("1:24")).toBeVisible();

  // «Qanday ishlaydi» videosi — o'z izohi va davomiyligi bilan
  await page.getByRole("radio", { name: /«Qanday ishlaydi» videosi/ }).click();
  await expect(text).toHaveValue(/^ISH TOPDIM qanday ishlaydi\? — 1 daqiqada/);
  await expect(preview.getByText("0:57")).toBeVisible();

  // albomga o'tilsa — izoh ham almashadi (admin matnni o'zgartirmagan)
  await page.getByRole("radio", { name: /«Qanday ishlaydi» rasmlari/ }).click();
  await expect(text).toHaveValue(/^ISH TOPDIM qanday ishlaydi\?/);
  await expect(preview.getByText("1/4")).toBeVisible();

  // admin o'z matnini yozsa — material almashganda matn saqlanadi
  await text.fill("Yangi vakansiyalar har kuni qo'shilmoqda");
  await page.getByRole("radio", { name: /«Birgalikda» rasmlari/ }).click();
  await expect(text).toHaveValue("Yangi vakansiyalar har kuni qo'shilmoqda");
  await expect(preview.getByText("1/3")).toBeVisible();

  // izoh chegarasi — 1024; faqat matnda — 4096
  await text.fill("a".repeat(1030));
  await expect(page.getByText("Matn juda uzun: ko'pi bilan 1024 belgi")).toBeVisible();
  await expect(page.getByText("1030 / 1024")).toBeVisible();
  await page.getByRole("radio", { name: "Faqat matn" }).click();
  await expect(page.getByText("Matn juda uzun", { exact: false })).toHaveCount(0);
  await expect(page.getByText("1030 / 4096")).toBeVisible();

  // qadash — bot huquqi yo'q: o'chiq
  await expect(page.getByRole("checkbox", { name: /Kanalda qadab qo'yish/ })).toBeDisabled();
});

test("kanal materiallari saytdan ochiq beriladi (Telegram ularni URL bo'yicha oladi)", async ({ page, context }) => {
  await asGuest(context);
  const video = await page.request.get("/media/kanal/birgalikda-quramiz.mp4", { maxRedirects: 0, headers: { range: "bytes=0-1023" } });
  expect([200, 206]).toContain(video.status());
  expect(video.headers()["content-type"]).toContain("video/mp4");
  const photo = await page.request.get("/media/kanal/qanday-ishlaydi-1.jpg", { maxRedirects: 0 });
  expect(photo.status()).toBe(200);
  expect(photo.headers()["content-type"]).toContain("image/jpeg");
});

test("oddiy foydalanuvchi kanal sahifasini ochmaydi", async ({ page, context }) => {
  await sql("delete from public.admin_users where profile_id = $1", [USERS.workerB]);
  await loginAs(context, USERS.workerB, "aal2");
  const res = await page.goto("/admin/telegram");
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("button", { name: "Kanalga yuborish" })).toHaveCount(0);
});
