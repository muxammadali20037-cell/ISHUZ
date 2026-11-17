import { expect, test } from "@playwright/test";
import { USERS, asGuest, asMode, loginAs } from "../support";

/**
 * "Mening dunyom" olib tashlandi (2026-11-17, ega: "profil juda chalkash — Mening dunyom kerak emas").
 * Eski /dunyo havolalari buzilmaydi — Profilga olib boradi; Profilda "Mening dunyom" bo'limi yo'q.
 * Bazadagi tanlangan qiziqishlar (profile_interests) o'chirilmadi.
 */
test("mehmon: eski /dunyo — Profilga (kirish taklifi bilan)", async ({ page, context }) => {
  await asGuest(context);
  await page.goto("/dunyo");
  await expect(page).toHaveURL(/\/cabinet$/);
  await expect(page.getByRole("link", { name: "Hisobga kirish" })).toBeVisible();
});

test("kirgan: /dunyo — Profilga; Profilda va bosh sahifada «Mening dunyom» yo'q", async ({ page, context }) => {
  await loginAs(context, USERS.workerB);
  await asMode(context, "worker");
  await page.goto("/dunyo");
  await expect(page).toHaveURL(/\/cabinet$/);
  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { level: 1, name: "Profil" })).toBeVisible();
  await expect(main.locator('[data-fold="world"]')).toHaveCount(0);
  await expect(main).not.toContainText("Mening dunyom");
  await page.goto("/");
  await expect(page.getByRole("main")).not.toContainText("Mening dunyom");
});
