import fs from "node:fs";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

/**
 * Brauzer E2E: izolyatsiyalangan lokal stendda (e2e/stack/up.sh) — haqiqiy Supabase, Telegram yoki to'lov ishlatilmaydi.
 * Natijalar: e2e/.stack/report (HTML), xato bo'lsa trace/screenshot — e2e/.stack/results.
 */
const envFile = path.join(__dirname, ".stack/env.json");
const app = fs.existsSync(envFile) ? (JSON.parse(fs.readFileSync(envFile, "utf8")) as { app: string }).app : "http://localhost:3300";

export default defineConfig({
  testDir: path.join(__dirname, "specs"),
  outputDir: path.join(__dirname, ".stack/results"),
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [["list"], ["html", { outputFolder: path.join(__dirname, ".stack/report"), open: "never" }]],
  use: {
    baseURL: app,
    locale: "uz-UZ",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    ...(process.env.PW_CHROMIUM_PATH ? { launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH } } : {}),
  },
  projects: [{ name: "mobile-390", use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 } } }],
});
