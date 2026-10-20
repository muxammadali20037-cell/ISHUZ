import fs from "node:fs";
import path from "node:path";
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { asMode, loginAs, stack } from "../support";
import { DEMO, cleanDemo, seedDemo } from "./demo-seed";

/**
 * "Premium" bosqichi (2026-10, 3-qism) — oldin/keyin: birinchi ochilish (til, tanishtiruv, rol), mehmon, ish qidiruvchi va
 * ish beruvchi bosh ekranlari, AI yordamchi, e'lon joylash — 390 px (bosh ekranlar 1440 px ham). Faqat lokal stendda:
 *   SHOTS_TAG=before|after npx playwright test -c e2e/screens/shots.config.ts e2e/screens/premium.shots.ts
 */
const TAG = process.env.SHOTS_TAG ?? "before";
const OUT = path.join(__dirname, "../../docs/screenshots/premium-2026-10");
const host = new URL(stack.app).hostname;

test.afterAll(cleanDemo);

async function shot(page: Page, name: string, width: number, full = false) {
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.waitForTimeout(600);
  fs.mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: path.join(OUT, `${TAG}-${name}-${width}.jpg`), type: "jpeg", quality: 74 });
  if (full) await page.screenshot({ path: path.join(OUT, `${TAG}-${name}-${width}-full.jpg`), type: "jpeg", quality: 60, fullPage: true });
}

async function ctx(browser: Browser, width: number, setup: (c: BrowserContext) => Promise<void>) {
  // harakat bilan (reducedMotion yo'q) — tugmalar va AI paneli qanday ko'rinishi
  const c = await browser.newContext({ baseURL: stack.app, viewport: { width, height: width < 768 ? 844 : 900 }, storageState: { cookies: [], origins: [] } });
  await c.addCookies([{ name: "ishuz_locale", value: "uz", domain: host, path: "/" }]);
  await setup(c);
  return c;
}

test("premium: kirish va bosh ekranlar", async ({ browser }) => {
  await seedDemo();

  // 1) birinchi ochilish: til → tanishtiruv → rol (cookie'siz, haqiqiy yangi foydalanuvchi)
  const first = await browser.newContext({ baseURL: stack.app, viewport: { width: 390, height: 844 }, storageState: { cookies: [], origins: [] } });
  const f = await first.newPage();
  await f.goto("/start/til");
  await shot(f, "0-start-language", 390);
  await f.goto("/start/tanishtiruv");
  await shot(f, "0-start-intro", 390);
  await f.goto("/start/rol");
  await shot(f, "0-start-role", 390);
  await first.close();

  for (const width of [390, 1440]) {
    const g = await ctx(browser, width, async (c) => {
      await c.addCookies([{ name: "ib_intro", value: "1", domain: host, path: "/" }]);
    });
    const gp = await g.newPage();
    await gp.goto("/");
    await expect(gp.getByRole("heading", { level: 1 })).toBeVisible();
    await shot(gp, "1-guest-home", width, true);
    await g.close();

    const w = await ctx(browser, width, async (c) => {
      await loginAs(c, DEMO.worker);
      await asMode(c, "worker");
    });
    const p = await w.newPage();
    await p.goto("/");
    await expect(p.getByRole("heading", { level: 1 })).toBeVisible();
    await shot(p, "2-seeker-home", width, true);
    if (width === 390) {
      await p.getByRole("button", { name: "AI bilan qidirish" }).first().click();
      await expect(p.getByRole("dialog")).toBeVisible();
      await shot(p, "3-ai-open", width);
    }
    await w.close();

    const e = await ctx(browser, width, async (c) => {
      await loginAs(c, DEMO.employer);
      await asMode(c, "employer");
    });
    const q = await e.newPage();
    await q.goto("/");
    await expect(q.getByRole("heading", { level: 1 })).toBeVisible();
    await shot(q, "4-employer-home", width, true);
    if (width === 390) {
      await q.goto("/post/vacancy");
      await shot(q, "5-post-vacancy", width);
    }
    await e.close();
  }
});
