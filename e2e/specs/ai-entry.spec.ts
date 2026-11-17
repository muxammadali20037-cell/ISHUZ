import { expect, test } from "@playwright/test";
import { USERS, asGuest, asMode, loginAs } from "../support";

/**
 * "Yordamchi" bo'limiga kirish (2026-11-12, egasi: "AI yordamchi bo'limi qani — qo'shib ber, bossa ChatGPT kabi ochilsin").
 * Sahifa (/ai) bor edi, lekin unga olib boradigan nomli tugma yo'q edi. Endi:
 *  - kompyuter, kirgan foydalanuvchi: chap yon menyuda "Bosh sahifa"dan keyin;
 *  - kompyuter/planshet, mehmon: yuqori menyuda; rejim tanlanmagan mehmon — sayt menyusida;
 *  - telefon: yuqori paneldagi belgi (har sahifadan) va bosh sahifadagi karta; pastki menyu o'zgarmagan (5 ta katak);
 *  - 2026-11-17 (ega, "profil juda chalkash"): Profildagi karta olib tashlandi; bosh sahifada — "Bo'limlar" qatori (mehmonda
 *    kompyuterda ham). Hammasi /ai ni ochadi — suhbat oynasi (chap panel, so'nggi suhbatlar).
 *  - 2026-11-15: nomi "Yordamchi"; /ai — alohida to'liq ekran (sayt menyulari yo'q), "‹" bilan qaytiladi.
 */

test("mehmon (ish izlovchi rejimi), kompyuter: yuqori menyuda 'Yordamchi' — bosilganda suhbat oynasi", async ({ page, context }) => {
  await asGuest(context);
  await asMode(context, "worker");
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  const nav = page.getByRole("banner").getByRole("navigation", { name: "Asosiy bo'limlar" });
  // nomlari bilan (faqat belgi emas): "Yordamchi" birinchi bo'limdan keyin
  await expect(nav.getByRole("link").filter({ visible: true })).toHaveText(["Bosh sahifa", "Yordamchi", "Ishlar", "Arizalar", "Profil"]);
  for (const name of ["Bosh sahifa", "Yordamchi", "Ishlar", "Arizalar", "Profil"]) {
    const label = nav.getByRole("link", { name, exact: true }).getByText(name, { exact: true });
    expect(await label.evaluate((el) => el.getBoundingClientRect().width), `"${name}" nomi ko'rinadi`).toBeGreaterThan(10);
  }
  // planshetda (768): bo'limlar belgi bilan, "Universal ustalar" ham shu qatorda (turkuaz)
  await page.setViewportSize({ width: 800, height: 900 });
  await expect(nav.getByRole("link", { name: "Universal ustalar" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Yordamchi" })).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 900 });
  // bosh sahifada katta AI kartasi yo'q — faqat "Bo'limlar" qatori (2026-11-17: mehmonda tez yo'llar ham shu yerda);
  // "Universal ustalar" — alohida yashil bo'lim
  await expect(page.locator("main [data-ai-entry]")).toHaveCount(1);
  await expect(page.locator("main [data-home-menu] [data-ai-entry]")).toHaveCount(1);
  await expect(page.locator("main [data-masters-home]")).toContainText("Universal ustalar");

  await nav.getByRole("link", { name: "Yordamchi" }).click();
  await page.waitForURL(/\/ai$/);
  await expect(page.locator("[data-ai-workspace]")).toBeVisible();
  await expect(page.locator("[data-ai-welcome]")).toBeVisible();
  // 2026-11-15: "Yordamchi" — alohida to'liq ekran: sayt menyusi va pastki menyu yo'q; "‹" bilan oldingi sahifaga
  await expect(page.getByRole("navigation", { name: "Asosiy bo'limlar" })).toHaveCount(0);
  await expect(page.locator("nav.bottom-nav")).toHaveCount(0);
  await page.locator("[data-ai-header]").getByRole("link", { name: "Orqaga" }).click();
  await page.waitForURL((u) => new URL(u).pathname === "/");
});

test("kirgan ish izlovchi, kompyuter: yon menyuda 'Yordamchi' ikkinchi; Profildagi karta ham ochadi", async ({ page, context }) => {
  await loginAs(context, USERS.workerA);
  await asMode(context, "worker");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const side = page.getByRole("navigation", { name: "Kabinet menyusi" });
  await expect(side.getByRole("link").nth(0)).toHaveText("Bosh sahifa");
  // AI yordamchi — to'q sariq rangda ajralib turadi, yonida yozuvsiz yonib-o'chuvchi nuqta ("Yangi" faqat ekran o'quvchiga)
  await expect(side.getByRole("link").nth(1)).toHaveText(/^Yordamchi/);
  const aiDot = side.getByRole("link").nth(1).locator("[data-new-dot=ai]");
  await expect(aiDot).toBeVisible();
  // yozuvli belgi emas — kichik nuqta
  expect((await aiDot.boundingBox())?.width ?? 99).toBeLessThanOrEqual(12);
  // "Yaqin atrofdagi ishlar" (xarita) — yangi bo'lim, ham yon menyuda
  await expect(side.getByRole("link", { name: /^Ishlar xaritada/ })).toHaveAttribute("href", "/jobs/xarita");
  await expect(side.locator("[data-masters-entry] [data-new-dot=masters]")).toBeVisible();
  await expect(side.locator("[data-new-dot=map]")).toBeVisible();
  await side.getByRole("link", { name: /^Yordamchi/ }).click();
  await page.waitForURL(/\/ai$/);
  await expect(page.locator("[data-ai-workspace]")).toBeVisible();
  // alohida to'liq ekran: chap yon menyu yo'q
  await expect(side).toHaveCount(0);

  // Profilda AI kartasi yo'q (2026-11-17, ega: "profil juda chalkash — Yordamchi kerak emas")
  await page.goto("/cabinet");
  await expect(page.locator("main [data-cabinet-links]")).toBeVisible();
  await expect(page.locator("main [data-ai-entry]")).toHaveCount(0);
});

test("telefon: yuqori paneldagi belgi va «Bo'limlar» qatori (alohida karta yo'q); pastki menyu — 5 ta katak", async ({ page, context }) => {
  await asGuest(context);
  await asMode(context, "worker");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const top = page.getByRole("banner").getByRole("link", { name: "Yordamchi" });
  await expect(top).toBeVisible();
  await expect(page.locator("main [data-ai-entry]")).toHaveCount(1);
  await expect(page.locator("main [data-home-menu] [data-ai-entry]")).toContainText("Yordamchi");
  // pastki menyu (4.0): beshta bo'lim — oltinchi katak qo'shilmagan (mehmonda "Xabarlar" o'rnida "Sohalar", 2026-11-17)
  await expect(page.locator("nav.bottom-nav").getByRole("link")).toHaveText(["Bosh sahifa", "Ishlar", "Arizalar", "Sohalar", "Profil"]);
  // boshqa sahifadan ham bir bosishda
  await page.goto("/saved");
  await page.getByRole("banner").getByRole("link", { name: "Yordamchi" }).click();
  await page.waitForURL(/\/ai$/);
  await expect(page.locator("[data-ai-workspace]")).toBeVisible();
  // /ai — alohida to'liq ekran: yuqori panel va pastki menyu yo'q (ega, 2026-11-15)
  await expect(page.getByRole("banner").getByRole("link", { name: "Yordamchi" })).toHaveCount(0);
  await expect(page.locator("nav.bottom-nav")).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1, name: "Yordamchi" })).toBeVisible();

  // 320 px: sarlavha ekrandan chiqmaydi
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/");
  await expect(page.getByRole("banner").getByRole("link", { name: "Yordamchi" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("ish beruvchi: yon menyudan (Profilda karta yo'q)", async ({ page, context }) => {
  await loginAs(context, USERS.employer);
  await asMode(context, "employer");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/cabinet");
  const side = page.getByRole("navigation", { name: "Kabinet menyusi" });
  await expect(side.getByRole("link").nth(1)).toHaveText("YordamchiYangi");
  // ish beruvchida xarita (ish izlovchi uchun) yo'q
  await expect(side.getByRole("link", { name: /^Ishlar xaritada/ })).toHaveCount(0);
  // 2026-11-17: Profildagi AI kartasi olib tashlandi
  await expect(page.locator("main [data-ai-entry]")).toHaveCount(0);
  await side.getByRole("link").nth(1).click();
  await page.waitForURL(/\/ai$/);
  await expect(page.locator("[data-ai-workspace]")).toBeVisible();
  await expect(side).toHaveCount(0);
  // "‹" — Profilga qaytadi (oldingi sahifa)
  await page.locator("[data-ai-header]").getByRole("link", { name: "Orqaga" }).click();
  await page.waitForURL(/\/cabinet$/);
});
