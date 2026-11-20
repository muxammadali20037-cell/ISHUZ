import { expect, test } from "@playwright/test";
import { USERS, asGuest, asMode, loginAs, stack } from "../support";

/**
 * Har bir sahifa tepasida kichik "‹ Orqaga" (ega, 2026-11-13: "orqaga qaytish topolmayapti — har bir oynaning tepasida
 * kichkina orqaga chiqib tursin"). Bosh sahifada yo'q; sahifaning o'z "Orqaga"si bo'lsa — bittasi qoladi.
 */

test("'Orqaga' — oldingi sahifaga; bosh sahifada va pastki menyu bo'limlarida yo'q", async ({ page, context }) => {
  await loginAs(context, USERS.workerA);
  await asMode(context, "worker");
  await page.goto("/");
  await expect(page.locator("[data-global-back]")).toHaveCount(0);
  // Profil — pastki menyu bo'limi (2026-11-20): "Orqaga" yo'q
  await page.goto("/cabinet");
  await expect(page.getByRole("link", { name: "Orqaga" })).toHaveCount(0);
  const saved = () => page.locator("main [data-cabinet-links]").getByRole("link", { name: "Saqlanganlar", exact: true });
  // sayt ichida o'tish — "Orqaga" aynan oldingi sahifaga qaytaradi
  await saved().click();
  await page.waitForURL(/\/saved$/);
  // telefonda — yuqori panelda (birinchi ekrandagi joyni olmaydi)
  const back = page.getByRole("banner").getByRole("link", { name: "Orqaga" });
  await expect(back).toBeVisible();
  await expect(page.getByRole("link", { name: "Orqaga" })).toHaveCount(1);
  await back.click();
  await page.waitForURL(/\/cabinet$/);

  // kompyuterda — sahifa tepasida alohida qator (yon menyu bor, yuqori panel yo'q)
  await page.setViewportSize({ width: 1440, height: 900 });
  await saved().click();
  await page.waitForURL(/\/saved$/);
  const row = page.locator("[data-global-back]:not(header [data-global-back])").getByRole("link", { name: "Orqaga" });
  await expect(row).toBeVisible();
  await expect(page.getByRole("link", { name: "Orqaga" })).toHaveCount(1);
  await row.click();
  await page.waitForURL(/\/cabinet$/);
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

test("telefonda 'Orqaga' va logotip ustma-ust tushmaydi (360–430 px va planshet)", async ({ browser }) => {
  // audit 2026-11-14: 390–430 px da logotip nomi bilan markazdan toshib "Orqaga" ustiga chiqib "Orqa…" bo'lib qolardi
  for (const width of [360, 390, 412, 430, 768]) {
    const ctx = await browser.newContext({ baseURL: stack.app, viewport: { width, height: 800 } });
    await asGuest(ctx);
    const page = await ctx.newPage();
    await page.goto("/pricing");
    const back = page.locator("header [data-global-back]");
    await expect(back.getByRole("link", { name: "Orqaga" })).toBeVisible();
    const box = await back.boundingBox();
    const logo = await page.locator("header [data-bar-logo]").boundingBox(); // ko'rinmasa — null
    if (box && logo && logo.width > 0) expect(logo.x, `${width}px`).toBeGreaterThanOrEqual(box.x + box.width);
    // "Orqaga" yozuvi to'liq, kesilmagan
    const label = back.locator("span").first();
    expect(await label.evaluate((el) => el.scrollWidth <= el.clientWidth), `${width}px`).toBe(true);
    await ctx.close();
  }
});
