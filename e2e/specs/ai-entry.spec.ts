import { expect, test } from "@playwright/test";
import { USERS, asGuest, asMode, loginAs } from "../support";

/**
 * Yordamchi va asosiy menyu. 2026-11-21 (ega, master prompt): menyu 3 ta bo'lim — Qidiruv · E'lonlarim · Profil.
 * 2026-11-12: "Yordamchi" (/ai) bo'limiga nomli kirish. Asosiy menyu hamma joyda bir xil, chat (/chat) — birinchi;
 * alohida "Yordamchi" belgisi va menyu bandi yo'q. /ai (to'liq ekran yordamchi) — to'g'ridan-to'g'ri havola bilan
 * (2026-11-21: bosh sahifa — chat, "Bo'limlar" qatori yo'q). O'sha kuni kechqurun (ega: "ishchi panelida Ishchilar nimaga kerak"): bo'limlar rejimga qarab —
 * ish izlovchida "Sizga mos" (Ishchilar o'rniga), ish beruvchida "Arizalar" (Ishlar o'rniga).
 */
// 2026-11-21 (ega, master prompt): asosiy menyu — 3 ta bo'lim; kompyuterning yon menyusida yana "Xabarlar".
// 2026-11-23 (ega): boshida "Bosh sahifa"
const TABS = ["Bosh sahifa", "Qidiruv", "E'lonlarim", "Profil"];
const SIDE = ["Bosh sahifa", "Qidiruv", "E'lonlarim", "Xabarlar", "Profil"];

test("mehmon, kompyuter: yuqori menyuda 3 ta bo'lim nomlari bilan; /ai — alohida to'liq ekran", async ({ page, context }) => {
  await asGuest(context);
  await asMode(context, "worker");
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  const nav = page.getByRole("banner").getByRole("navigation", { name: "Asosiy bo'limlar" });
  await expect(nav.getByRole("link").filter({ visible: true })).toHaveText(TABS);
  for (const name of TABS) {
    const label = nav.getByRole("link", { name, exact: true }).getByText(name, { exact: true });
    expect(await label.evaluate((el) => el.getBoundingClientRect().width), `"${name}" nomi ko'rinadi`).toBeGreaterThan(10);
  }
  // planshetda: bo'limlar belgi bilan ("Universal ustalar" hozircha yashirin — ega, 2026-11-24)
  await page.setViewportSize({ width: 800, height: 900 });
  await expect(nav.locator("[data-masters-entry]")).toHaveCount(0);
  await expect(nav.getByRole("link", { name: "Qidiruv" })).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 900 });
  // bosh sahifa — chat (2026-11-21): ishchi rejimida ustalar havolasi yo'q (ish izlovchiga kerak emas), menyuda bor
  await expect(page.locator("main [data-start-chat]")).toBeVisible();
  await expect(page.locator("main [data-chat-choice='find_masters']")).toHaveCount(0);

  // /ai (to'liq ekran yordamchi) — to'g'ridan-to'g'ri havola bilan (bosh sahifadagi "Bo'limlar" qatori olib tashlandi)
  await page.goto("/ai");
  await expect(page.locator("[data-ai-workspace]")).toBeVisible();
  // "Yordamchi" — alohida to'liq ekran: sayt menyusi va pastki menyu yo'q; "‹" bilan oldingi sahifaga
  await expect(page.getByRole("navigation", { name: "Asosiy bo'limlar" })).toHaveCount(0);
  await expect(page.locator("nav.bottom-nav")).toHaveCount(0);
  await page.locator("[data-ai-header]").getByRole("link", { name: "Orqaga" }).click();
  await page.waitForURL((u) => new URL(u).pathname === "/");
});

for (const who of ["worker", "employer"] as const) {
  test(`kirgan foydalanuvchi, kompyuter (${who}): yon menyuda Chat, E'lonlarim, Xabarlar, Profil`, async ({ page, context }) => {
    await loginAs(context, who === "worker" ? USERS.workerA : USERS.employer);
    await asMode(context, who);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/cabinet");
    const side = page.getByRole("navigation", { name: "Kabinet menyusi" });
    const main = side.getByRole("list").first().getByRole("link");
    await expect(main).toHaveText(SIDE);
    await expect(side.getByRole("link", { name: "Profil" })).toHaveAttribute("aria-current", "page");
    await expect(side.locator("[data-masters-entry]")).toHaveCount(0);
    await side.getByRole("link", { name: "Qidiruv", exact: true }).click();
    await page.waitForURL(/\/chat$/);
    // chat — oddiy sahifa: yon menyu joyida, bo'lim belgilangan
    await expect(side.getByRole("link", { name: "Qidiruv", exact: true })).toHaveAttribute("aria-current", "page");
    await expect(page.locator("[data-start-chat]")).toBeVisible();
    // Profilda AI kartasi yo'q
    await page.goto("/cabinet");
    await expect(page.locator("main [data-ai-entry]")).toHaveCount(0);
  });
}

test("telefon: yuqori panelda alohida «Yordamchi» belgisi yo'q; pastki menyu — 4 ta bo'lim; 320 px da sig'adi", async ({ page, context }) => {
  await asGuest(context);
  await asMode(context, "worker");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("banner").getByRole("link", { name: "Yordamchi" })).toHaveCount(0);
  await expect(page.locator("nav.bottom-nav").getByRole("link")).toHaveText(TABS);
  await page.locator("nav.bottom-nav").getByRole("link", { name: "Qidiruv" }).click();
  await page.waitForURL(/\/chat$/);
  await expect(page.locator("[data-start-chat]")).toBeVisible();

  // 320 px: sarlavha va menyu ekrandan chiqmaydi
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/");
  await expect(page.locator("nav.bottom-nav").getByRole("link")).toHaveCount(4);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  // 4 ta bo'lim nomi ham 320 px da to'liq sig'adi (kesilmaydi)
  const cut = await page.locator("nav.bottom-nav a span.truncate").evaluateAll((els) => els.filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent));
  expect(cut).toEqual([]);
});
