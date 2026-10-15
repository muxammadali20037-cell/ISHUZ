// Laboratoriya o'lchovi (field ma'lumot EMAS): E2E stendidagi production build'ni mobil sharoitda ochadi va
// LCP, CLS, TTFB, load/networkidle vaqti, sahifa tayyor bo'lgach bitta bosish kechikishi (INP o'rnini bosuvchi lab
// ko'rsatkich — bitta bosish, haqiqiy INP emas) va yuklangan JS hajmini (siqilgan) yozadi.
// Ishga tushirish: bash e2e/stack/up.sh && node e2e/perf/lab.mjs [runs=3]
// Natija: e2e/.stack/perf.json (mediana).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import pg from "pg";
import { sessionCookie } from "../stack/jwt.mjs";

const dir = path.dirname(fileURLToPath(import.meta.url));
const stack = JSON.parse(fs.readFileSync(path.join(dir, "../.stack/env.json"), "utf8"));
const RUNS = Number(process.argv[2] || 3);
// E2E_BASE_URL — o'sha stendga ulangan boshqa build (masalan, eski commit) ustida o'lchash (Playwright konfiguratsiyasidagidek)
const app = process.env.E2E_BASE_URL ?? stack.app;
const host = new URL(app).hostname;

const db = new pg.Client({ connectionString: stack.db });
await db.connect();
const { rows } = await db.query("select id from public.profession_nodes where name_uz = 'Buxgalter' and selectable limit 1");
// e'lon sahifasi (R-F): eng yangi faol vakansiya; bazada bo'lmasa — o'lchanmaydi
const { rows: vac } = await db.query("select slug from public.vacancies where status = 'active' order by published_at desc nulls last limit 1");
await db.end();

const ROUTES = [
  { name: "home", url: "/", tap: "main a[href^='/search']:visible" },
  { name: "search-start", url: "/search", tap: "main a[href*='mode=']:visible" },
  { name: "search-results", url: `/search?mode=jobs&p=${rows[0].id}&region=all`, tap: null },
  // E1 dan keyin rejimsiz mehmonga avval "ish izlayapsizmi?" savoli chiqadi — formaning o'zi o'lchanishi uchun rejim beriladi
  { name: "post-worker", url: "/post/worker", mode: "worker", tap: "main input:visible" },
  { name: "auth", url: "/auth", tap: null },
  { name: "cabinet", url: "/cabinet", user: "7e2e0000-0000-4000-8000-000000000001", tap: null },
  // R-F: ish beruvchi bosh sahifasi (mehmon) va e'lon sahifasi
  { name: "home-employer", url: "/", mode: "employer", tap: null },
  ...(vac[0] ? [{ name: "vacancy", url: `/jobs/${vac[0].slug}`, tap: null }] : []),
];

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor((s.length - 1) / 2)] : null;
};

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const out = [];
for (const r of ROUTES) {
  const samples = [];
  for (let i = 0; i < RUNS; i++) {
    // service worker o'chiq: u /_next/static fayllarini keshdan siqilmagan holda beradi va resource timing'da "siqilgan hajm"
    // o'rniga to'liq hajm chiqadi (gidratsiyadan keyin yuklangan bo'laklar 3–4 baravar katta ko'rinardi). Birinchi tashrif sharoiti.
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: "uz-UZ", serviceWorkers: "block" });
    await ctx.addCookies([
      { name: "ishuz_locale", value: "uz", domain: host, path: "/" },
      ...(r.mode ? [{ name: "ib_mode", value: r.mode, domain: host, path: "/" }] : []),
      ...(r.user ? [{ ...sessionCookie(r.user, stack.secret), domain: host, path: "/" }] : []),
    ]);
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    // "Slow 4G" ga yaqin: 150 ms RTT, 1.6 Mbit/s yuklash, 750 kbit/s yuborish; CPU 4× sekin (o'rta Android)
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await page.addInitScript(() => {
      window.__lab = { lcp: 0, cls: 0, maxEvent: 0 };
      new PerformanceObserver((l) => l.getEntries().forEach((e) => (window.__lab.lcp = e.startTime))).observe({ type: "largest-contentful-paint", buffered: true });
      new PerformanceObserver((l) => l.getEntries().forEach((e) => { if (!e.hadRecentInput) window.__lab.cls += e.value; })).observe({ type: "layout-shift", buffered: true });
      // faqat haqiqiy o'zaro ta'sir (INP qoidasi): yuklanishdagi avtomatik pointerover/mouseover hisobga kirmaydi
      new PerformanceObserver((l) => l.getEntries().forEach((e) => { if (e.interactionId) window.__lab.maxEvent = Math.max(window.__lab.maxEvent, e.duration); })).observe({ type: "event", buffered: true, durationThreshold: 16 });
    });
    const t0 = Date.now();
    await page.goto(app + r.url, { waitUntil: "load" });
    const loadMs = Date.now() - t0;
    await page.waitForLoadState("networkidle");
    const idleMs = Date.now() - t0;
    await page.waitForTimeout(1000);
    // JS hajmi bosishdan OLDIN (bosish keyingi sahifa chunk'larini oldindan yuklaydi)
    // jsKb — bosishgacha yuklangan barcha JS (Next.js ko'rinib turgan havolalar sahifalarining bo'laklarini ham oldindan oladi);
    // jsAtLoadKb — `load` hodisasigacha tugaganlari (sahifaning o'zi uchun kerak bo'lgani, taxminan)
    const js = await page.evaluate(() => {
      const res = performance.getEntriesByType("resource").filter((e) => e.initiatorType === "script" || e.name.endsWith(".js"));
      const nav = performance.getEntriesByType("navigation")[0];
      const loadEnd = nav && nav.loadEventEnd > 0 ? nav.loadEventEnd : Infinity;
      const kb = (xs) => xs.reduce((s, e) => s + (e.encodedBodySize || 0), 0) / 1024;
      return { jsKb: kb(res), jsFiles: res.length, jsAtLoadKb: kb(res.filter((e) => e.responseEnd <= loadEnd)) };
    });
    if (r.tap) {
      const el = page.locator(r.tap).first();
      if (await el.count()) {
        await el.tap({ noWaitAfter: true, trial: false }).catch(() => undefined);
        await page.waitForTimeout(800);
      }
    }
    const m = await page.evaluate(() => {
      const nav = performance.getEntriesByType("navigation")[0];
      return {
        ttfb: nav ? nav.responseStart : null,
        lcp: window.__lab.lcp,
        cls: window.__lab.cls,
        tapMs: window.__lab.maxEvent,
        htmlKb: nav ? nav.encodedBodySize / 1024 : null,
      };
    });
    samples.push({ ...m, ...js, loadMs, idleMs });
    await ctx.close();
  }
  const pick = (k) => median(samples.map((s) => s[k]).filter((v) => v !== null));
  const row = { route: r.name, runs: RUNS, loadMs: pick("loadMs"), idleMs: pick("idleMs"), ttfbMs: Math.round(pick("ttfb")), lcpMs: Math.round(pick("lcp")), cls: Number(pick("cls").toFixed(3)), tapMs: Math.round(pick("tapMs")), jsKb: Math.round(pick("jsKb")), jsAtLoadKb: Math.round(pick("jsAtLoadKb")), jsFiles: pick("jsFiles"), htmlKb: Math.round(pick("htmlKb")) };
  out.push(row);
  console.log(JSON.stringify(row));
}
await browser.close();
fs.writeFileSync(path.join(dir, "../.stack/perf.json"), JSON.stringify({ at: new Date().toISOString(), app, conditions: "390×844 DPR3, 150ms RTT, 1.6 Mbit/s, CPU 4×, local production build, service worker blocked", rows: out }, null, 2));
