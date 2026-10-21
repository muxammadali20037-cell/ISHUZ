import path from "node:path";
import { defineConfig } from "@playwright/test";
import base from "../playwright.config";

/**
 * Oldin/keyin skrinshotlari (CI'da ishlamaydi): npx playwright test -c e2e/screens/shots.config.ts
 * SHOTS_TAG=before|after — fayl nomi prefiksi; natija: docs/screenshots/redesign-2026-10/
 */
export default defineConfig({
  ...base,
  testDir: __dirname,
  testMatch: /.*\.(shots|audit)\.ts$/,
  globalSetup: undefined,
  outputDir: path.join(__dirname, "../.stack/shots-results"),
  reporter: [["list"]],
  projects: [{ name: "shots" }],
  timeout: 180_000,
});
