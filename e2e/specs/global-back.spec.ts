import { expect, test } from "@playwright/test";
import { USERS, asMode, loginAs } from "../support";

/**
 * Har bir sahifa tepasida kichik "‹ Orqaga" (ega, 2026-11-13: "orqaga qaytish topolmayapti — har bir oynaning tepasida
 * kichkina orqaga chiqib tursin"). Bosh sahifada yo'q; sahifaning o'z "Orqaga"si bo'lsa — bittasi qoladi.
 */

test("kabinetdan 'Orqaga' — oldingi sahifaga; bosh sahifada yo'q", async ({ page, context }) => {
  await loginAs(context, USERS.workerA);
  await asMode(context, "worker");
  await page.goto("/");
  await expect(page.locator("[data-global-back]")).toHaveCount(0);
  await page.goto("/saved");
  // sayt ichida o'tish (pastki menyu) — "Orqaga" aynan oldingi sahifaga qaytaradi
  await page.locator("nav.bottom-nav").getByRole("link", { name: "Profil" }).click();
  await page.waitForURL(/\/cabinet$/);
  // telefonda — yuqori panelda (birinchi ekrandagi joyni olmaydi)
  const back = page.getByRole("banner").getByRole("link", { name: "Orqaga" });
  await expect(back).toBeVisible();
  await expect(page.getByRole("link", { name: "Orqaga" })).toHaveCount(1);
  await back.click();
  await page.waitForURL(/\/saved$/);

  // kompyuterda — sahifa tepasida alohida qator (yon menyu bor, yuqori panel yo'q)
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("navigation", { name: "Kabinet menyusi" }).getByRole("link", { name: "Profil" }).click();
  await page.waitForURL(/\/cabinet$/);
  const row = page.locator("[data-global-back]:not(header [data-global-back])").getByRole("link", { name: "Orqaga" });
  await expect(row).toBeVisible();
  await expect(page.getByRole("link", { name: "Orqaga" })).toHaveCount(1);
  await row.click();
  await page.waitForURL(/\/saved$/);
});

test("havola orqali ochilgan sahifa: 'Orqaga' — bo'lim sahifasiga; sarlavha yonidagi '‹' takrorlanmaydi", async ({ page, context }) => {
  await loginAs(context, USERS.workerA);
  await asMode(context, "worker");
  await page.goto("/settings");
  await expect(page.getByRole("link", { name: "Orqaga" })).toHaveCount(1);
  await expect(page.locator("main [data-header-back]")).toBeHidden();
  await page.goto("/messages/00000000-0000-4000-8000-000000000000");
  // chat xonasi (yoki topilmadi sahifasi) — bitta "Orqaga"
  expect(await page.locator("[data-global-back]:visible, [data-page-back]:visible").count()).toBeLessThanOrEqual(1);
});

test("o'z 'Orqaga'si bor sahifa (qidiruv qadami) — umumiy 'Orqaga' ko'rinmaydi", async ({ page, context }) => {
  await loginAs(context, USERS.workerA);
  await asMode(context, "worker");
  await page.goto("/search?mode=jobs");
  await expect(page.locator("[data-page-back]").first()).toBeVisible();
  await expect(page.locator("[data-global-back]:visible")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Orqaga" })).toHaveCount(1);
});
