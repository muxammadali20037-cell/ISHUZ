import fs from "node:fs";
import path from "node:path";
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { asMode, loginAs, stack } from "../support";
import { DEMO, cleanDemo, seedDemo } from "./demo-seed";

/**
 * "Toza" uslub (2026-10-22, egasi tanlagan A varianti) — oldin/keyin: ish qidiruvchi, ish beruvchi, mehmon bosh ekranlari,
 * birinchi ochilish (til, rol) — 390 px. Faqat lokal stendda:
 *   SHOTS_TAG=before|after npx playwright test -c e2e/screens/shots.config.ts e2e/screens/clean.shots.ts
 */
const TAG = process.env.SHOTS_TAG ?? "before";
const OUT = path.join(__dirname, "../../docs/screenshots/clean-2026-10-22");
const host = new URL(stack.app).hostname;

test.afterAll(cleanDemo);

async function shot(page: Page, name: string) {
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.waitForTimeout(500);
  fs.mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: path.join(OUT, `${TAG}-${name}.jpg`), type: "jpeg", quality: 78 });
}

async function ctx(browser: Browser, setup?: (c: BrowserContext) => Promise<void>) {
  const c = await browser.newContext({
    baseURL: stack.app,
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    reducedMotion: "reduce",
    storageState: { cookies: [], origins: [] },
  });
  await c.addCookies([{ name: "ishuz_locale", value: "uz", domain: host, path: "/" }]);
  if (setup) await setup(c);
  return c;
}

test("toza uslub: bosh ekranlar va birinchi ochilish", async ({ browser }) => {
  test.setTimeout(180_000);
  await seedDemo();

  const first = await ctx(browser);
  const f = await first.newPage();
  await f.goto("/start/til");
  await shot(f, "start-language");
  await f.goto("/start/rol");
  await shot(f, "start-role");
  await first.close();

  const g = await ctx(browser, (c) => c.addCookies([{ name: "ib_intro", value: "1", domain: host, path: "/" }]));
  const gp = await g.newPage();
  await gp.goto("/");
  await expect(gp.getByRole("heading", { level: 1 })).toBeVisible();
  await shot(gp, "guest-home");
  await g.close();

  for (const who of ["worker", "employer"] as const) {
    const c = await ctx(browser, async (x) => {
      await loginAs(x, who === "worker" ? DEMO.worker : DEMO.employer);
      await asMode(x, who);
    });
    const p = await c.newPage();
    await p.goto("/");
    await expect(p.getByRole("heading", { level: 1 })).toBeVisible();
    await shot(p, `${who}-home`);
    await c.close();
  }
});
