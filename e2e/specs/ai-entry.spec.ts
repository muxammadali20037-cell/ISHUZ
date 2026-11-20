import { expect, test } from "@playwright/test";
import { USERS, asGuest, asMode, loginAs } from "../support";

/**
 * Yordamchi va asosiy menyu.
 * 2026-11-12: "Yordamchi" (/ai) bo'limiga nomli kirish. 2026-11-20 (ega: "ilova chalkash — pastda faqat Ishchilar, Ishlar,
 * E'lonlarim, Izlash va e'lon berish, Profil"): asosiy menyu hamma joyda bir xil 5 ta bo'lim, o'rtada chat ("Izlash/E'lon",
 * /chat); alohida "Yordamchi" belgisi va menyu bandi yo'q. /ai (to'liq ekran yordamchi) — mehmon bosh sahifasidagi
 * "Bo'limlar" qatoridan ochiladi. O'sha kuni kechqurun (ega: "ishchi panelida Ishchilar nimaga kerak"): bo'limlar rejimga qarab —
 * ish izlovchida "Sizga mos" (Ishchilar o'rniga), ish beruvchida "Arizalar" (Ishlar o'rniga).
 */
const TABS = ["Sizga mos", "Ishlar", "Izlash/E'lon", "E'lonlarim", "Profil"];
const SIDE = {
  worker: ["Izlash/E'lon", "Ishlar", "Sizga mos", "E'lonlarim", "Xabarlar", "Profil"],
  employer: ["Izlash/E'lon", "Arizalar", "Ishchilar", "E'lonlarim", "Xabarlar", "Profil"],
};

test("mehmon, kompyuter: yuqori menyuda 5 ta bo'lim nomlari bilan; Yordamchi — bosh sahifa «Bo'limlar» qatorida", async ({ page, context }) => {
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
  // planshetda: bo'limlar belgi bilan, "Universal ustalar" ham shu qatorda
  await page.setViewportSize({ width: 800, height: 900 });
  await expect(nav.getByRole("link", { name: "Universal ustalar" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Izlash/E'lon" })).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(page.locator("main [data-home-menu] [data-ai-entry]")).toHaveCount(1);
  await expect(page.locator("main [data-masters-home]")).toContainText("Universal ustalar");

  await page.locator("main [data-home-menu] [data-ai-entry]").click();
  await page.waitForURL(/\/ai$/);
  await expect(page.locator("[data-ai-workspace]")).toBeVisible();
  // "Yordamchi" — alohida to'liq ekran: sayt menyusi va pastki menyu yo'q; "‹" bilan oldingi sahifaga
  await expect(page.getByRole("navigation", { name: "Asosiy bo'limlar" })).toHaveCount(0);
  await expect(page.locator("nav.bottom-nav")).toHaveCount(0);
  await page.locator("[data-ai-header]").getByRole("link", { name: "Orqaga" }).click();
  await page.waitForURL((u) => new URL(u).pathname === "/");
});

for (const who of ["worker", "employer"] as const) {
  test(`kirgan foydalanuvchi, kompyuter (${who}): yon menyuda chat birinchi, keyin rolga mos bo'limlar, Xabarlar, Profil`, async ({ page, context }) => {
    await loginAs(context, who === "worker" ? USERS.workerA : USERS.employer);
    await asMode(context, who);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/cabinet");
    const side = page.getByRole("navigation", { name: "Kabinet menyusi" });
    const main = side.getByRole("list").first().getByRole("link");
    await expect(main).toHaveText(SIDE[who]);
    await expect(side.getByRole("link", { name: "Profil" })).toHaveAttribute("aria-current", "page");
    await expect(side.locator("[data-masters-entry]")).toBeVisible();
    await side.getByRole("link", { name: "Izlash/E'lon" }).click();
    await page.waitForURL(/\/chat$/);
    // chat — oddiy sahifa: yon menyu joyida, bo'lim belgilangan
    await expect(side.getByRole("link", { name: "Izlash/E'lon" })).toHaveAttribute("aria-current", "page");
    await expect(page.locator("[data-start-chat]")).toBeVisible();
    // Profilda AI kartasi yo'q
    await page.goto("/cabinet");
    await expect(page.locator("main [data-ai-entry]")).toHaveCount(0);
  });
}

test("telefon: yuqori panelda alohida «Yordamchi» belgisi yo'q; pastki menyu — 5 ta bo'lim; 320 px da sig'adi", async ({ page, context }) => {
  await asGuest(context);
  await asMode(context, "worker");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("banner").getByRole("link", { name: "Yordamchi" })).toHaveCount(0);
  await expect(page.locator("main [data-home-menu] [data-ai-entry]")).toContainText("Yordamchi");
  await expect(page.locator("nav.bottom-nav").getByRole("link")).toHaveText(TABS);
  await page.locator("nav.bottom-nav").getByRole("link", { name: "Izlash/E'lon" }).click();
  await page.waitForURL(/\/chat$/);
  await expect(page.locator("[data-start-chat]")).toBeVisible();

  // 320 px: sarlavha va menyu ekrandan chiqmaydi
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/");
  await expect(page.locator("nav.bottom-nav").getByRole("link")).toHaveCount(5);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
