// Bosh sahifa suratlari (mehmon, rejim tanlanmagan): node e2e/screens/home-shots.mjs <app-url> <prefiks> <papka> [kengliklar]
// Masalan: node e2e/screens/home-shots.mjs http://localhost:3300 after docs/screenshots/home 390,1440
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const [app, prefix, outDir, widthsArg] = process.argv.slice(2);
if (!app || !prefix || !outDir) throw new Error("ishlatish: home-shots.mjs <app-url> <prefiks> <papka> [kengliklar]");
const widths = (widthsArg ?? "390,1440").split(",").map(Number);
fs.mkdirSync(outDir, { recursive: true });
const host = new URL(app).hostname;
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined });
for (const width of widths) {
  const ctx = await browser.newContext({ viewport: { width, height: width < 768 ? 844 : 900 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
  await ctx.addCookies([
    { name: "ishuz_locale", value: "uz", domain: host, path: "/" },
    { name: "ib_intro", value: "1", domain: host, path: "/" },
  ]);
  const page = await ctx.newPage();
  await page.goto(`${app}/`, { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(outDir, `${prefix}-${width}.jpg`), quality: 70, fullPage: true });
  await page.screenshot({ path: path.join(outDir, `${prefix}-${width}-fold.jpg`), quality: 75 });
  await ctx.close();
}
await browser.close();
console.log(`✓ ${widths.join(", ")} → ${outDir}`);
