import { expect, test } from "@playwright/test";
import { asGuest, next, pickProfession, pickWholeRegion } from "../support";

/**
 * C8.5 · e'lon formalari: maydon tuzatilgan zahoti uning qizil xatosi yo'qoladi
 * (avval "Davom etish" qayta bosilguncha "Nomini yozing" kabi xatolar to'ldirilgan maydon ostida qolib ketardi).
 */

test("vakansiya: bo'sh 3-qadam xatolari maydon to'ldirilgach birma-bir yo'qoladi", async ({ page, context }) => {
  await asGuest(context);
  await page.goto("/post/vacancy");
  await pickProfession(page, "Buxgalter", "Buxgalter");
  await next(page);
  await pickWholeRegion(page);
  await next(page);
  await next(page); // bo'sh — xatolar
  const alerts = page.locator("main [role=alert]");
  await expect(page.getByText("Kim e'lon berayotganini tanlang")).toBeVisible();
  const before = await alerts.count();
  expect(before).toBeGreaterThanOrEqual(5);

  await page.getByRole("radio", { name: "O'zim uchun" }).click();
  await expect(page.getByText("Kim e'lon berayotganini tanlang")).toHaveCount(0);
  await page.locator("#org").fill("Dilnoza opa");
  await expect(page.getByText(/Nomini yozing/)).toHaveCount(0);
  await page.locator("#phone").fill("90 111 00 03");
  await page.locator("#desc").fill("Kichik do'konga buxgalter kerak, haftasiga 5 kun");
  await expect(page.getByText(/kamida 10 ta harf/)).toHaveCount(0);
  await page.locator("#salary-from").fill("4000000");
  // hammasi tuzatildi — umumiy "yuqoridagini tuzating" ham qolmaydi; maydonlar qizil emas
  await expect(alerts).toHaveCount(0);
  await expect(page.locator("main [aria-invalid=true]")).toHaveCount(0);
  await next(page);
  await expect(page.getByRole("heading", { name: "E'loningizni tekshiring" })).toBeVisible();
});

test("ishchi: ism va tajriba xatosi tuzatilgach yo'qoladi", async ({ page, context }) => {
  await asGuest(context);
  await page.goto("/post/worker");
  await pickProfession(page, "Buxgalter", "Buxgalter");
  await next(page);
  await pickWholeRegion(page);
  await next(page);
  await next(page);
  await expect(page.getByText(/Ismingizni yozing/)).toBeVisible();
  await page.getByLabel("Ismingiz").fill("Botir");
  await expect(page.getByText(/Ismingizni yozing/)).toHaveCount(0);
  await page.getByRole("radio", { name: "3 yildan ko'p" }).click();
  await page.locator("#about").fill("Buxgalteriya, 1C, soliq hisobotlari");
  await page.locator("#phone").fill("901234567");
  await expect(page.locator("main [role=alert]")).toHaveCount(0);
});
