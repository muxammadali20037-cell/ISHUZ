import { expect, test } from "@playwright/test";
import { USERS, asGuest, asMode, loginAs } from "../support";

/**
 * "AI yordamchi" bo'limiga kirish (2026-11-12, egasi: "AI yordamchi bo'limi qani — qo'shib ber, bossa ChatGPT kabi ochilsin").
 * Sahifa (/ai) bor edi, lekin unga olib boradigan nomli tugma yo'q edi. Endi:
 *  - kompyuter, kirgan foydalanuvchi: chap yon menyuda "Bosh sahifa"dan keyin;
 *  - kompyuter/planshet, mehmon: yuqori menyuda; rejim tanlanmagan mehmon — sayt menyusida;
 *  - telefon: yuqori paneldagi belgi (har sahifadan) va bosh sahifadagi karta; pastki menyu o'zgarmagan (5 ta katak);
 *  - "Kabinetim"da karta. Hammasi /ai ni ochadi — suhbat oynasi (chap panel, so'nggi suhbatlar).
 */

test("mehmon (ish izlovchi rejimi), kompyuter: yuqori menyuda 'AI yordamchi' — bosilganda suhbat oynasi", async ({ page, context }) => {
  await asGuest(context);
  await asMode(context, "worker");
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  const nav = page.getByRole("banner").getByRole("navigation", { name: "Asosiy bo'limlar" });
  // nomlari bilan (faqat belgi emas): "AI yordamchi" birinchi bo'limdan keyin
  await expect(nav.getByRole("link").filter({ visible: true })).toHaveText(["Ishlar", "AI yordamchi", "Saqlangan", "Arizalar", "Profil"]);
  for (const name of ["Ishlar", "AI yordamchi", "Saqlangan", "Arizalar", "Profil"]) {
    const label = nav.getByRole("link", { name, exact: true }).getByText(name, { exact: true });
    expect(await label.evaluate((el) => el.getBoundingClientRect().width), `"${name}" nomi ko'rinadi`).toBeGreaterThan(10);
  }
  // planshetda (768): bo'limlar belgi bilan, "Universal ustalar" ham shu qatorda (turkuaz)
  await page.setViewportSize({ width: 800, height: 900 });
  await expect(nav.getByRole("link", { name: "Universal ustalar" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "AI yordamchi" })).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 900 });
  // bosh sahifada ikki bo'lim kartasi: AI yordamchi va Universal ustalar
  const cards = page.locator("main [data-home-sections] a");
  await expect(cards).toHaveCount(2);
  await expect(cards.nth(0)).toContainText("AI yordamchi");
  await expect(cards.nth(0)).toContainText("Suhbat orqali: ish topish, CV, karyera maslahati");
  await expect(cards.nth(1)).toContainText("Universal ustalar");

  await nav.getByRole("link", { name: "AI yordamchi" }).click();
  await page.waitForURL(/\/ai$/);
  await expect(page.locator("[data-ai-workspace]")).toBeVisible();
  await expect(page.locator("[data-ai-welcome]")).toBeVisible();
  // /ai da faqat "AI yordamchi" belgilangan ("Ishlar" emas)
  await expect(nav.getByRole("link", { name: "AI yordamchi" })).toHaveAttribute("aria-current", "page");
  await expect(nav.getByRole("link", { name: "Ishlar" })).not.toHaveAttribute("aria-current", "page");
});

test("kirgan ish izlovchi, kompyuter: yon menyuda 'AI yordamchi' ikkinchi; bosh sahifadagi karta ham ochadi", async ({ page, context }) => {
  await loginAs(context, USERS.workerA);
  await asMode(context, "worker");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const side = page.getByRole("navigation", { name: "Kabinet menyusi" });
  await expect(side.getByRole("link").nth(0)).toHaveText("Bosh sahifa");
  // AI yordamchi — to'q sariq rangda ajralib turadi, yonida "Yangi" belgisi
  await expect(side.getByRole("link").nth(1)).toHaveText("AI yordamchiYangi");
  await expect(side.getByRole("link").nth(1).locator("[data-new-badge=ai]")).toBeVisible();
  // "Yaqin atrofdagi ishlar" (xarita) — yangi bo'lim, ham yon menyuda
  await expect(side.getByRole("link", { name: /^Ishlar xaritada/ })).toHaveAttribute("href", "/jobs/xarita");
  await expect(side.locator("[data-masters-entry] [data-new-badge=masters]")).toBeVisible();
  await side.getByRole("link", { name: /^AI yordamchi/ }).click();
  await page.waitForURL(/\/ai$/);
  await expect(page.locator("[data-ai-workspace]")).toBeVisible();
  await expect(side.getByRole("link", { name: /^AI yordamchi/ })).toHaveAttribute("aria-current", "page");
  await expect(side.getByRole("link", { name: "Vakansiyalar" })).not.toHaveAttribute("aria-current", "page");

  await page.goto("/");
  await page.locator("main [data-ai-entry]").click();
  await page.waitForURL(/\/ai$/);
  await expect(page.locator("[data-ai-workspace]")).toBeVisible();
});

test("telefon: yuqori paneldagi belgi va bosh sahifadagi karta; pastki menyu o'zgarmagan", async ({ page, context }) => {
  await asGuest(context);
  await asMode(context, "worker");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const top = page.getByRole("banner").getByRole("link", { name: "AI yordamchi" });
  await expect(top).toBeVisible();
  await expect(page.locator("main [data-ai-entry]")).toContainText("AI yordamchi");
  // pastki menyu: 4 bo'lim + "E'lon" — oltinchi katak qo'shilmagan
  await expect(page.locator("nav.bottom-nav").getByRole("link")).toHaveText(["Ishlar", "Saqlangan", "E'lon", "Arizalar", "Profil"]);
  // boshqa sahifadan ham bir bosishda
  await page.goto("/saved");
  await page.getByRole("banner").getByRole("link", { name: "AI yordamchi" }).click();
  await page.waitForURL(/\/ai$/);
  await expect(page.locator("[data-ai-workspace]")).toBeVisible();
  // /ai ning o'zida belgi takrorlanmaydi
  await expect(page.getByRole("banner").getByRole("link", { name: "AI yordamchi" })).toHaveCount(0);

  // 320 px: sarlavha ekrandan chiqmaydi
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/");
  await expect(page.getByRole("banner").getByRole("link", { name: "AI yordamchi" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("ish beruvchi: yon menyu va 'Kabinetim'dagi karta (o'z matni bilan)", async ({ page, context }) => {
  await loginAs(context, USERS.employer);
  await asMode(context, "employer");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/cabinet");
  const side = page.getByRole("navigation", { name: "Kabinet menyusi" });
  await expect(side.getByRole("link").nth(1)).toHaveText("AI yordamchiYangi");
  // ish beruvchida xarita (ish izlovchi uchun) yo'q
  await expect(side.getByRole("link", { name: /^Ishlar xaritada/ })).toHaveCount(0);
  const card = page.locator("main [data-ai-entry]");
  await expect(card).toContainText("Suhbat orqali: nomzod topish, vakansiya matni, suhbat savollari");
  await card.click();
  await page.waitForURL(/\/ai$/);
  await expect(page.locator("[data-ai-workspace]")).toBeVisible();
  await expect(side.getByRole("link", { name: /^AI yordamchi/ })).toHaveAttribute("aria-current", "page");
  await expect(side.getByRole("link", { name: "Profil" })).not.toHaveAttribute("aria-current", "page");
});
