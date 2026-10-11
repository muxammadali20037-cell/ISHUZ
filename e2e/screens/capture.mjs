// Avval/keyin ekranlari (faqat E2E stendidagi test ma'lumotlari): node e2e/screens/capture.mjs <app-url> <prefiks>
// Masalan: node e2e/screens/capture.mjs http://localhost:3300 after → docs/screenshots/after-*.jpg
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import pg from "pg";
import { sessionCookie } from "../stack/jwt.mjs";

const dir = path.dirname(fileURLToPath(import.meta.url));
const stack = JSON.parse(fs.readFileSync(path.join(dir, "../.stack/env.json"), "utf8"));
const [app, prefix] = process.argv.slice(2);
if (!app || !prefix) throw new Error("ishlatish: capture.mjs <app-url> <prefiks>");
const host = new URL(app).hostname;
const OUT = path.join(dir, "../../docs/screenshots");
fs.mkdirSync(OUT, { recursive: true });

const db = new pg.Client({ connectionString: stack.db });
await db.connect();
const node = (await db.query("select id from public.profession_nodes where name_uz = 'Buxgalter' and selectable limit 1")).rows[0].id;
const SIG = "public.simple_search_vacancies(uuid, uuid, uuid, boolean, integer, public.work_schedule, boolean, integer, integer)";
async function searchBroken(on) {
  const has = (await db.query("select count(*)::int as n from pg_proc where proname = 'simple_search_vacancies_e2e_off'")).rows[0].n > 0;
  if (on && !has) await db.query(`alter function ${SIG} rename to simple_search_vacancies_e2e_off`);
  if (!on && has) await db.query(`alter function ${SIG.replace("simple_search_vacancies", "simple_search_vacancies_e2e_off")} rename to simple_search_vacancies`);
  await db.query("notify pgrst, 'reload schema'");
  await new Promise((r) => setTimeout(r, 1500));
}

const SHOTS = [
  { name: "home", url: "/" },
  { name: "search-results", url: `/search?mode=jobs&p=${node}&region=all` },
  { name: "search-error", url: `/search?mode=jobs&p=${node}&region=all`, broken: true },
  { name: "post-worker-custom", url: "/post/worker", user: "7e2e0000-0000-4000-8000-000000000001", type: "Kaktus parvarishchisi" },
  { name: "cabinet", url: "/cabinet", user: "7e2e0000-0000-4000-8000-000000000001" },
];
const WIDTHS = [
  { w: 390, h: 844, tag: "m" },
  { w: 768, h: 1024, tag: "t" },
  { w: 1440, h: 900, tag: "d" },
];

const browser = await chromium.launch();
try {
  for (const s of SHOTS) {
    if (s.broken) await searchBroken(true);
    try {
      for (const v of WIDTHS) {
        const ctx = await browser.newContext({ viewport: { width: v.w, height: v.h }, deviceScaleFactor: 1, reducedMotion: "reduce" });
        await ctx.addCookies([
          { name: "ishuz_welcome", value: "1", domain: host, path: "/" },
          { name: "ishuz_locale", value: "uz", domain: host, path: "/" },
          ...(s.user ? [{ ...sessionCookie(s.user, stack.secret), domain: host, path: "/" }] : []),
        ]);
        const page = await ctx.newPage();
        await page.goto(app + s.url, { waitUntil: "networkidle" });
        if (s.type) {
          await page.locator('[aria-busy="true"][inert]').waitFor({ state: "detached" }).catch(() => undefined);
          await page.getByLabel("Kasb yoki sohani qidiring").fill(s.type);
          await page.waitForTimeout(1500);
        }
        await page.screenshot({ path: path.join(OUT, `${prefix}-${s.name}-${v.tag}.jpg`), type: "jpeg", quality: 70, fullPage: false });
        await ctx.close();
      }
    } finally {
      if (s.broken) await searchBroken(false);
    }
  }
} finally {
  await browser.close();
  await db.end();
}
console.log(`✓ ${OUT}/${prefix}-*.jpg`);
