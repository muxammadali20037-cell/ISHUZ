import fs from "node:fs";
import path from "node:path";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { asGuest, asMode, loginAs, stack } from "../support";
import { DEMO, cleanDemo, seedDemo } from "./demo-seed";

/**
 * UX va AI yordamchi (2026-10, 2-qism) — oldin/keyin: mehmon bosh sahifasi, ish qidiruvchi bosh sahifasi, AI yordamchi (bo'sh va
 * natija bilan), /ai, qidiruv, vakansiya, ish beruvchi paneli — 390 va 1440 px. Faqat lokal stendda (CI'da ishlamaydi):
 *   SHOTS_TAG=before|after npx playwright test -c e2e/screens/shots.config.ts e2e/screens/ux.shots.ts
 */
const TAG = process.env.SHOTS_TAG ?? "before";
const OUT = path.join(__dirname, "../../docs/screenshots/ux-2026-10");

test.afterAll(cleanDemo);

async function shot(page: Page, name: string, width: number, full = true) {
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.waitForTimeout(400);
  fs.mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: path.join(OUT, `${TAG}-${name}-${width}.jpg`), type: "jpeg", quality: 72 });
  if (full) await page.screenshot({ path: path.join(OUT, `${TAG}-${name}-${width}-full.jpg`), type: "jpeg", quality: 60, fullPage: true });
}

async function ctxFor(browser: import("@playwright/test").Browser, width: number, who: "guest" | "worker" | "employer") {
  const ctx: BrowserContext = await browser.newContext({ baseURL: stack.app, viewport: { width, height: width < 768 ? 844 : 900 }, reducedMotion: "reduce" });
  await asGuest(ctx);
  if (who !== "guest") {
    await loginAs(ctx, who === "worker" ? DEMO.worker : DEMO.employer);
    await asMode(ctx, who);
  }
  return ctx;
}

test("UX: asosiy ekranlar × 390/1440", async ({ browser }) => {
  const slug = await seedDemo();
  for (const width of [390, 1440]) {
    // 1) mehmon — birinchi taassurot
    const g = await ctxFor(browser, width, "guest");
    const gp = await g.newPage();
    await gp.goto("/");
    await expect(gp.getByRole("heading", { level: 1 })).toBeVisible();
    await shot(gp, "1-guest-home", width);
    await g.close();

    // 2) ish qidiruvchi: bosh sahifa, AI yordamchi (bo'sh → natija), /ai, qidiruv, vakansiya
    const w = await ctxFor(browser, width, "worker");
    const p = await w.newPage();
    await p.goto("/");
    await expect(p.getByRole("heading", { level: 1 })).toBeVisible();
    await shot(p, "2-seeker-home", width);
    await p.getByRole("button", { name: "AI bilan qidirish" }).first().click();
    const dialog = p.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await shot(p, "3-ai-open", width, false);
    await dialog.getByLabel("Nima qidiryapsiz?").fill("Toshkentda sotuvchi");
    await dialog.getByRole("button", { name: "Topish" }).click();
    await expect(dialog.getByText(/Tushundim/).first()).toBeVisible();
    await shot(p, "4-ai-result", width, false);
    await p.keyboard.press("Escape");
    await p.goto("/ai");
    await expect(p.getByRole("heading", { level: 1 })).toBeVisible();
    await shot(p, "5-ai-hub", width);
    await p.goto("/search?mode=jobs&any=1&region=tashkent_city&district=all");
    await shot(p, "6-search", width);
    await p.goto(`/jobs/${slug}`);
    await expect(p.getByRole("heading", { level: 1 })).toBeVisible();
    await shot(p, "7-vacancy", width);
    await w.close();

    // 3) ish beruvchi paneli
    const e = await ctxFor(browser, width, "employer");
    const q = await e.newPage();
    await q.goto("/");
    await expect(q.getByRole("heading", { level: 1 })).toBeVisible();
    await shot(q, "8-employer-home", width);
    await e.close();
  }
});
