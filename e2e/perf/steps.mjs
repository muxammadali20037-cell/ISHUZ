// Qadamdan qadamga o'tish vaqti (lab, field EMAS): bosish → keyingi qadam ekranda ko'ringuncha (ms).
// Sharoit: "Slow 4G" (150 ms RTT yoki STEPS_RTT_MS, 1.6 Mbit/s) + CPU 4× sekin, 390×844. Mehmon.
// Ishga tushirish: bash e2e/stack/up.sh && node e2e/perf/steps.mjs [runs=3] [baseUrl]
// Shlyuz E2E_DB_LATENCY_MS (har Supabase so'roviga kechikish) va E2E_GATEWAY_LOG=1 bilan ishga tushirilgan bo'lsa,
// har qadamdagi Supabase so'rovlari soni ham yoziladi (e2e/.stack/gateway.log).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const dir = path.dirname(fileURLToPath(import.meta.url));
const stack = JSON.parse(fs.readFileSync(path.join(dir, "../.stack/env.json"), "utf8"));
const RUNS = Number(process.argv[2] || 3);
const BASE = process.argv[3] || stack.app;
const host = new URL(BASE).hostname;
// RTT: brauzer ↔ server kechikishi (standart 150 ms — "Slow 4G"; STEPS_RTT_MS=400 — O'zbekistondan uzoq server, kuchsiz tarmoq)
const RTT = Number(process.env.STEPS_RTT_MS || 150);
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor((xs.length - 1) / 2)];

const LOG = path.join(dir, "../.stack/gateway.log");
const dbCalls = (t0, t1) => {
  try {
    return fs.readFileSync(LOG, "utf8").split("\n").filter((l) => { const t = Number(l.split(" ")[0]); return t >= t0 && t <= t1; }).length;
  } catch {
    return null;
  }
};
const calls = {};
const feedback = {};
let current = "";

// Vaqt sahifaning o'zida o'lchanadi: haqiqiy "click" hodisasi → keyingi qadam elementi DOM'da ko'rinadigan birinchi kadr.
// (Playwright click() ning "element tinchlandimi" kutishi o'lchovga kirmaydi.)
async function timed(page, act, until, seen) {
  await page.evaluate(() => {
    window.__tClick = 0;
    document.addEventListener("click", (e) => { if (!window.__tClick) window.__tClick = e.timeStamp; }, { capture: true, once: true });
  });
  const t0 = Date.now();
  await act();
  // ifoda satr sifatida baholanadi (o'lchov kontekstida bypassCSP — sahifa CSP'si eval'ni taqiqlaydi)
  const wait = (expr) =>
    page
      .waitForFunction(`(() => { if (!window.__tClick) return false; const ok = (${expr})(); return ok ? Math.round(performance.now() - window.__tClick) : false; })()`, undefined, { polling: "raf", timeout: 30_000 })
      .then((h) => h.jsonValue());
  // birinchi javob: kerakli qadam yoki kutish belgisi (skelet / aylanuvchi belgi — [data-step-loading]) ekranda
  const fb = await wait(`() => !!document.querySelector("[data-step-loading]") || (${seen})()`);
  (feedback[current] ??= []).push(fb);
  const ms = await wait(seen);
  await until();
  const t1 = Date.now();
  (calls[current] ??= []).push(dbCalls(t0, t1));
  return ms;
}

const hasText = (sel, re) => `() => [...document.querySelectorAll(${JSON.stringify(sel)})].some((e) => ${re}.test(e.textContent.trim()) && e.getClientRects().length > 0)`;
const hasInput = (label) => `() => [...document.querySelectorAll("input")].some((i) => (i.getAttribute("aria-label") || "").includes(${JSON.stringify(label)}) || [...(i.labels || [])].some((l) => l.textContent.includes(${JSON.stringify(label)})))`;

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const results = {};
const add = (k, v) => (results[k] ??= []).push(v);
const step = async (k, fn) => { current = k; add(k, await fn()); };

for (let i = 0; i < RUNS; i++) {
  const ctx = await browser.newContext({ bypassCSP: true, baseURL: BASE, viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: "uz-UZ" });
  await ctx.addCookies([
    { name: "ishuz_locale", value: "uz", domain: host, path: "/" },
    { name: "ishuz_welcomed", value: "1", domain: host, path: "/" },
  ]);
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: RTT, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  const T = 30_000;

  // --- qidiruv: bosh sahifa → "Ish e'lonlari" → kasb → viloyat → butun shahar → natija
  await page.goto("/", { waitUntil: "networkidle" });
  await step("search: bosh sahifa → kasb qadami", () => timed(page,
    () => page.getByRole("main").getByRole("link", { name: "Ish e'lonlari", exact: true }).click(),
    () => page.getByLabel("Kasb yoki sohani qidiring").waitFor({ timeout: T }), hasInput("Kasb yoki sohani qidiring")));
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Kasb yoki sohani qidiring").fill("Buxgalter");
  const pick = page.getByRole("button").filter({ has: page.getByText("Buxgalter", { exact: true }) }).filter({ hasText: "Tanlash" }).first();
  await pick.waitFor({ timeout: T });
  await step("search: kasb → viloyat qadami", () => timed(page, () => pick.click(),
    () => page.getByRole("heading", { level: 1, name: "Qaysi viloyatda?" }).waitFor({ timeout: T }), hasText("h1", /^Qaysi viloyatda\?/)));
  await page.waitForLoadState("networkidle");
  await step("search: viloyat → tuman qadami", () => timed(page, () => page.getByRole("link", { name: "Toshkent shahri", exact: true }).click(),
    () => page.getByRole("link", { name: /^Butun (viloyat|shahar)/ }).waitFor({ timeout: T }), hasText("a", /^Butun (viloyat|shahar)/)));
  await page.waitForLoadState("networkidle");
  await step("search: tuman → natijalar", () => timed(page, () => page.getByRole("link", { name: /^Butun (viloyat|shahar)/ }).click(),
    () => page.waitForURL(/district=all/, { timeout: T }).then(() => page.getByRole("button", { name: "O'zgartirish" }).waitFor({ timeout: T })), hasText("button", /O'zgartirish/)));

  // --- ishchi e'loni: 4 qadam (mijozda)
  await page.goto("/post/worker", { waitUntil: "networkidle" });
  await page.locator('[aria-busy="true"][inert]').waitFor({ state: "detached", timeout: T }).catch(() => {});
  await page.getByLabel("Kasb yoki sohani qidiring").fill("Buxgalter");
  const pick2 = page.getByRole("button").filter({ has: page.getByText("Buxgalter", { exact: true }) }).filter({ hasText: "Tanlash" }).first();
  await pick2.waitFor({ timeout: T });
  await pick2.click();
  const nextBtn = page.getByRole("button", { name: /^Davom etish/ });
  await step("post: 1 → 2 (hudud)", () => timed(page, () => nextBtn.click(),
    () => page.getByRole("button", { name: /^Toshkent shahri/ }).first().waitFor({ timeout: T }), hasText("button", /^Toshkent shahri/)));
  await step("post: viloyat → tuman ro'yxati", () => timed(page, () => page.getByRole("button", { name: /^Toshkent shahri/ }).first().click(),
    () => page.getByRole("radio", { name: /^Butun (viloyat|shahar)/ }).waitFor({ timeout: T }), hasText("label, [role=radio], button", /^Butun (viloyat|shahar)/)));
  await page.getByRole("radio", { name: /^Butun (viloyat|shahar)/ }).click();
  await step("post: 2 → 3 (ma'lumot)", () => timed(page, () => nextBtn.click(),
    () => page.getByLabel("Ismingiz").waitFor({ timeout: T }), hasInput("Ismingiz")));
  await page.getByLabel("Ismingiz").fill("Botir");
  await page.locator("#phone").fill("901234567");
  await page.locator("#about").fill("Buxgalteriya hisobi, soliq hisobotlari, 1C bilan 5 yil ishlaganman");
  await page.getByRole("radio", { name: "3 yildan ko'p" }).click();
  await step("post: 3 → 4 (tekshirish)", () => timed(page, () => nextBtn.click(),
    () => page.getByText("Oxirgi qadam: hisobga kirish").waitFor({ timeout: T }), hasText("p, h2, h3, div", /^Oxirgi qadam: hisobga kirish/)));
  await ctx.close();
}
await browser.close();
const out = Object.fromEntries(Object.entries(results).map(([k, v]) => [k, { median: median(v), samples: v }]));
for (const [k, v] of Object.entries(out)) {
  v.dbCalls = calls[k];
  v.feedback = { median: median(feedback[k]), samples: feedback[k] };
  console.log(`${k.padEnd(34)} javob ${String(v.feedback.median).padStart(5)} ms · tayyor ${String(v.median).padStart(5)} ms   ${JSON.stringify(v.samples)}   so'rovlar: ${JSON.stringify(calls[k])}`);
}
fs.writeFileSync(path.join(dir, "../.stack/steps.json"), JSON.stringify(out, null, 2));
