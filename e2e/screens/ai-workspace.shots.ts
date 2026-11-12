import fs from "node:fs";
import path from "node:path";
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { asGuest, asMode, loginAs, stack } from "../support";
import { DEMO, cleanDemo, seedDemo } from "./demo-seed";

/**
 * /ai ish maydoni (2026-11): ish qidiruvchi, ish beruvchi, mehmon — 390 va 1440 px; bo'sh holat, javob (jarayon izi bilan),
 * telefonda chap panel (pastdan). Faqat lokal stendda:
 *   npx playwright test -c e2e/screens/shots.config.ts e2e/screens/ai-workspace.shots.ts
 */
const OUT = path.join(__dirname, "../../docs/screenshots/ai-workspace-2026-11");

test.afterAll(cleanDemo);

async function shot(page: Page, name: string, width: number, full = false) {
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.waitForTimeout(400);
  fs.mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: path.join(OUT, `${name}-${width}.jpg`), type: "jpeg", quality: 78, fullPage: full });
}

async function ctxFor(browser: Browser, width: number, who: "guest" | "worker" | "employer") {
  const ctx: BrowserContext = await browser.newContext({ baseURL: stack.app, viewport: { width, height: width < 768 ? 844 : 960 }, reducedMotion: "reduce" });
  await asGuest(ctx);
  if (who !== "guest") {
    await loginAs(ctx, who === "worker" ? DEMO.worker : DEMO.employer);
    await asMode(ctx, who);
  }
  return ctx;
}

test("AI ish maydoni × 390/1440", async ({ browser }) => {
  await seedDemo();
  for (const width of [1440, 390]) {
    for (const who of ["worker", "employer", "guest"] as const) {
      const ctx = await ctxFor(browser, width, who);
      const page = await ctx.newPage();
      await page.goto("/ai");
      await expect(page.locator("[data-ai-welcome]")).toBeVisible();
      await shot(page, `${who}-welcome`, width);
      if (who === "worker") {
        await page.getByLabel("Nima qidiryapsiz?").fill("Toshkentda sotuvchi");
        await page.locator("form[data-voice] button[type=submit]").click();
        await expect(page.locator("[data-ai-trace] [data-state='done']").last()).toBeVisible({ timeout: 30_000 });
        await expect(page.locator("[data-ai-reply]").first()).toBeVisible();
        await shot(page, `${who}-answer`, width);
        if (width < 768) {
          await page.locator("[data-ai-open-sidebar]").click();
          await expect(page.getByRole("dialog")).toBeVisible();
          await shot(page, `${who}-drawer`, width);
        }
      }
      await ctx.close();
    }
  }
});
