import fs from "node:fs";
import path from "node:path";
import { test } from "@playwright/test";
import { asGuest, asMode, stack } from "../support";

/**
 * Logotip (2026-10): ochilish ekrani, birinchi ochilishdagi brend kartasi, sarlavha belgisi va qo'l siqish harakati kadrlari.
 *   SHOTS_TAG=after npx playwright test -c e2e/screens/shots.config.ts e2e/screens/logo.shots.ts
 */
const TAG = process.env.SHOTS_TAG ?? "after";
const OUT = path.join(__dirname, "../../docs/screenshots/logo-2026-10");

test("logotip: ochilish ekrani, brend kartasi, sarlavha, harakat kadrlari", async ({ browser }) => {
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

  // qo'l siqish: brend kartasidagi logotip ketma-ket kadrlarda (yuqori aniqlikda, siklning boshida — siqish shu paytda)
  const big = await browser.newContext({ baseURL: stack.app, viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
  const b = await big.newPage();
  await b.goto("/start/til");
  const logo = b.locator("main svg[role='img']").first();
  await logo.waitFor();
  // gidratsiyadan keyin svg qayta yaratiladi (harakat yoqiladi) — o'shandan boshlab kadrlar
  await b.waitForFunction(() => !!document.querySelector("main svg[role='img'] feDisplacementMap"));
  for (let i = 0; i < 12; i++) {
    await logo.screenshot({ path: path.join(OUT, `${TAG}-frame-${String(i).padStart(2, "0")}.png`) });
    await b.waitForTimeout(110);
  }
  await big.close();

  const home = await browser.newContext({ baseURL: stack.app, viewport: { width: 390, height: 844 } });
  await asGuest(home);
  await asMode(home, "worker");
  const h = await home.newPage();
  await h.goto("/");
  await h.waitForTimeout(800);
  await h.screenshot({ path: path.join(OUT, `${TAG}-2-header-390.jpg`), type: "jpeg", quality: 80, clip: { x: 0, y: 0, width: 390, height: 120 } });
  await home.close();
});
