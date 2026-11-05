import fs from "node:fs";
import path from "node:path";
import { test } from "@playwright/test";
import { asGuest, asMode, stack } from "../support";

/**
 * Logotip "Darvoza" (2026-11-05): ochilish ekrani, birinchi ochilishdagi brend kartasi, sarlavha va footer.
 *   SHOTS_TAG=after npx playwright test -c e2e/screens/shots.config.ts e2e/screens/logo.shots.ts
 * Logo fayllarining o'zi (SVG/PNG, favicon, ilova belgilari) — public/brand, scripts/brand/build-brand.py.
 */
const TAG = process.env.SHOTS_TAG ?? "after";
const OUT = path.join(__dirname, "../../docs/screenshots/brand-2026-11");

test("logotip: ochilish ekrani, brend kartasi, sarlavha, footer", async ({ browser }) => {
  fs.mkdirSync(OUT, { recursive: true });
  const ctx = await browser.newContext({ baseURL: stack.app, viewport: { width: 390, height: 844 }, storageState: { cookies: [], origins: [] } });
  // splash avtomatlashtirilgan brauzerda o'chiq — oddiy foydalanuvchi kabi
  await ctx.addInitScript(() => Object.defineProperty(navigator, "webdriver", { get: () => false }));
  const p = await ctx.newPage();
  await p.goto("/start/til");
  await p.waitForTimeout(250);
  await p.screenshot({ path: path.join(OUT, `${TAG}-0-splash-390.jpg`), type: "jpeg", quality: 80 });
  await p.waitForTimeout(1600);
  await p.screenshot({ path: path.join(OUT, `${TAG}-1-start-language-390.jpg`), type: "jpeg", quality: 80 });
  await ctx.close();

  const home = await browser.newContext({ baseURL: stack.app, viewport: { width: 390, height: 844 } });
  await asGuest(home);
  await asMode(home, "worker");
  const h = await home.newPage();
  await h.goto("/");
  await h.waitForTimeout(800);
  await h.screenshot({ path: path.join(OUT, `${TAG}-2-header-390.jpg`), type: "jpeg", quality: 80, clip: { x: 0, y: 0, width: 390, height: 120 } });
  await h.getByRole("contentinfo").screenshot({ path: path.join(OUT, `${TAG}-3-footer-390.jpg`), type: "jpeg", quality: 80 });
  await home.close();
});
