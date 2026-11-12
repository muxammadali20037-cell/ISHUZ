import fs from "node:fs";
import path from "node:path";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { USERS, asGuest, asMode, loginAs, stack } from "../support";

/**
 * "Universal ustalar" (2026-11): katalog, qidiruv, usta sahifasi (demo), e'lon formasi, kabinet — 390 va 1440 px.
 * Faqat lokal stendda:  npx playwright test -c e2e/screens/shots.config.ts e2e/screens/masters.shots.ts
 */
const OUT = path.join(__dirname, "../../docs/screenshots/masters-2026-11");

async function shot(page: Page, name: string, width: number, full = false) {
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.waitForTimeout(300);
  fs.mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: path.join(OUT, `${name}-${width}.jpg`), type: "jpeg", quality: 78, fullPage: full });
}

async function ctx(browser: Browser, width: number, login = false) {
  const c = await browser.newContext({ baseURL: stack.app, viewport: { width, height: width < 768 ? 844 : 960 }, reducedMotion: "reduce" });
  await asGuest(c);
  if (login) {
    await loginAs(c, USERS.workerA);
    await asMode(c, "worker");
  }
  return c;
}

test("Universal ustalar × 390/1440", async ({ browser }) => {
  for (const width of [1440, 390]) {
    const g = await ctx(browser, width);
    const p = await g.newPage();
    await p.goto("/ustalar");
    await expect(p.locator("[data-masters-hero]")).toBeVisible();
    await shot(p, "home", width);
    await shot(p, "home-full", width, true);
    await p.goto("/ustalar/qidiruv?k=ac");
    await expect(p.locator("[data-masters-results]")).toBeVisible();
    await shot(p, "search", width);
    await p.goto("/ustalar/demo-ac-1");
    await expect(p.locator("[data-masters-detail]")).toBeVisible();
    await shot(p, "detail-demo", width, true);
    await p.goto("/");
    await shot(p, "site-entry", width);
    await g.close();

    const u = await ctx(browser, width, true);
    const up = await u.newPage();
    await up.goto("/ustalar/elon");
    await expect(up.locator("[data-masters-form]")).toBeVisible();
    await shot(up, "form", width, true);
    await up.goto("/");
    await shot(up, "seeker-home-entry", width);
    // telefonda yon menyu yo'q — kirgan foydalanuvchi "Kabinetim"dagi kartadan kiradi
    await up.goto("/cabinet");
    await up.waitForLoadState("networkidle").catch(() => undefined);
    await up.locator("main [data-masters-entry]").evaluate((el) => el.scrollIntoView({ block: "center", behavior: "instant" }));
    await shot(up, "cabinet-entry", width);
    await u.close();
  }
});
