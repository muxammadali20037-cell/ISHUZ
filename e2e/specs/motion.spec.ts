import { expect, test, type Page } from "@playwright/test";
import { asGuest, asMode } from "../support";

/**
 * K · operator paneli uslubidagi harakat: sahifa yuklanayotganda yuqori panel va pastki menyu joyida qoladi (faqat kontent
 * o'rnida skelet), bosilgan bo'lim darhol faol; kontent pastdan yumshoq chiqadi, skeletdan keyin ikkinchi marta "sakramaydi";
 * birinchi ochilishda animatsiya yo'q (server HTML'i darhol ko'rinadi).
 */

/** Sahifa javobi (RSC) 900 ms kechiksin — oraliqdagi holat ko'rinadigan bo'lsin; prefetch kechiktirilmaydi */
async function slowNavigation(page: Page, path: string) {
  await page.route(`**${path}*`, async (route) => {
    const h = route.request().headers();
    if (h["rsc"] && !h["next-router-prefetch"]) await new Promise((r) => setTimeout(r, 900));
    await route.continue();
  });
}

test("sekin javobda ham: yuqori panel va menyu joyida, bosilgan bo'lim darhol faol, kontent o'rnida skelet", async ({ page, context }) => {
  await asGuest(context);
  await asMode(context, "employer");
  await page.goto("/");
  const main = page.locator("main");
  // birinchi ochilish: animatsiya yo'q
  await expect(main).not.toHaveClass(/page-(enter|swap)/);
  await page.waitForLoadState("networkidle");

  await slowNavigation(page, "/search");
  const nav = page.getByRole("navigation", { name: "Asosiy bo'limlar" }).last();
  await nav.getByRole("link", { name: "Nomzodlar" }).click();

  // javob hali kelmagan: skelet ko'rinadi — xuddi shu lahzada panel, menyu va lupa tugmasi ham joyida
  // (bitta "surat": kutib turib, javob kelgandan keyingi holatni tekshirib qo'ymaslik uchun)
  const skeleton = page.locator("[data-step-loading]");
  await page.waitForSelector("[data-step-loading]");
  const snap = await page.evaluate(() => ({
    skeleton: !!document.querySelector("[data-step-loading]"),
    header: !!document.querySelector("header"),
    nav: !!document.querySelector("nav.fixed"),
    fab: document.querySelectorAll("main ~ button, main ~ div button").length > 0,
    active: document.querySelector("nav.fixed a[aria-current='page']")?.textContent ?? null,
    mainClass: document.querySelector("main")?.className ?? "",
  }));
  expect(snap).toMatchObject({ skeleton: true, header: true, nav: true, fab: true, active: "Nomzodlar" });
  expect(snap.mainClass).toContain("page-enter");

  // javob keldi: kontent skelet o'rnida, faqat ochiladi (pastdan ikkinchi marta chiqmaydi)
  await expect(page.getByRole("heading", { name: "Qanday mutaxassis kerak?" })).toBeVisible();
  await expect(skeleton).toHaveCount(0);
  await expect(page.locator("main")).toHaveClass(/page-swap/);
  await expect(page.locator("header")).toHaveCount(1);
  await expect(page.locator("nav.fixed")).toHaveCount(1);
});

test("skeletsiz o'tishda kontent pastdan chiqadi; animatsiya tugagach main'da transform qolmaydi; gidratsiya xatosiz", async ({ page, context }) => {
  await asGuest(context);
  await asMode(context, "worker");
  // birinchi ochilishda (server HTML'i + gidratsiya) animatsiya klassi server bilan bir xil — React xatosi yo'q
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/search?mode=jobs&any=1&region=all");
  await page.waitForLoadState("networkidle");
  expect(errors.filter((e) => /hydrat|#418|#423|#425/i.test(e))).toEqual([]);
  await expect(page.locator("main")).not.toHaveClass(/page-(enter|swap)/);
  // /ai (pastki menyu, S2) — kontent bevosita, skeletsiz
  await page.getByRole("navigation", { name: "Asosiy bo'limlar" }).last().getByRole("link", { name: "AI" }).click();
  await expect(page).toHaveURL(/\/ai$/);
  const main = page.locator("main");
  await expect(main).toHaveClass(/page-enter/);
  // 350 ms dan keyin: element o'z joyida, ichidagi fixed panellar uchun "containing block" yaratmaydi
  await page.waitForTimeout(600);
  expect(await main.evaluate((el) => getComputedStyle(el).transform)).toBe("none");
  expect(await main.evaluate((el) => el.getAnimations().length)).toBe(0);
});
