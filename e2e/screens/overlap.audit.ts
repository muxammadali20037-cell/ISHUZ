import fs from "node:fs";
import path from "node:path";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { asGuest, asMode, loginAs, sql, stack } from "../support";
import { findLayoutIssues, fullHeight, markIssues, zoomText, type LayoutIssue } from "../overlap";
import { DEMO, cleanDemo, seedDemo } from "./demo-seed";

/**
 * Keng audit (CI'da emas): asosiy sahifalar × kenglik × til × shrift o'lchami — ustma-ust yozuv, to'silgan belgi, qirqilgan matn.
 *   npx playwright test -c e2e/screens/shots.config.ts e2e/screens/overlap.audit.ts
 * Natija: e2e/.stack/overlap/report.json va har muammoli holat uchun belgilangan skrinshot.
 */
const OUT = path.join(__dirname, "../.stack/overlap");
const host = new URL(stack.app).hostname;
const LONG_CO = "7e2e0000-0000-4000-8000-0000000000c2";

type Who = "first" | "guest" | "guest-worker" | "guest-employer" | "worker" | "employer";
const CONFIGS: { width: number; locale: "uz" | "ru" | "oz" | "en"; scale: number; textZoom?: number }[] = [
  { width: 320, locale: "uz", scale: 1 },
  { width: 360, locale: "ru", scale: 1 },
  { width: 390, locale: "uz", scale: 1 },
  { width: 390, locale: "ru", scale: 1.25 },
  { width: 412, locale: "oz", scale: 1.15 },
  { width: 768, locale: "ru", scale: 1 },
  { width: 1024, locale: "en", scale: 1 },
  { width: 1440, locale: "uz", scale: 1 },
  { width: 1440, locale: "ru", scale: 1 },
  // telefondagi "katta shrift" (faqat yozuv kattalashadi)
  { width: 360, locale: "ru", scale: 1, textZoom: 1.3 },
  { width: 390, locale: "uz", scale: 1, textZoom: 1.3 },
];

async function seedLong() {
  // uzun kompaniya nomi va uzun sarlavha — haqiqiy bazadagi kabi
  await sql(
    `insert into public.companies (id, name, slug, verification_status, verified_at, created_by)
     values ($1, 'Toshkent Xalqaro Logistika va Savdo Markazi MChJ', 'long-co-demo', 'verified', now(), $2)
     on conflict (id) do update set name = excluded.name`,
    [LONG_CO, DEMO.employer],
  );
  await sql(
    `insert into public.vacancies (owner_profile_id, company_id, title, region_id, district_id, description, status, salary_from, salary_to, salary_type, schedule, published_at, expires_at)
     select $1, $2, 'Omborxona bo''yicha katta mutaxassis (yuk qabul qilish, hisobga olish va jo''natish)', r.id, d.id,
            'Uzun sarlavhali sinov e''loni: omborxona ishlari, hisob-kitob va jo''natish', 'active', 12500000, 18750000, 'monthly', '6_1', now(), now() + interval '7 days'
     from public.regions r join public.districts d on d.region_id = r.id where r.slug = 'tashkent_city' and d.name_uz = 'Mirzo Ulug''bek tumani'`,
    [DEMO.employer, LONG_CO],
  );
}

async function context(browser: import("@playwright/test").Browser, width: number, locale: string, who: Who): Promise<BrowserContext> {
  const ctx = await browser.newContext({ baseURL: stack.app, viewport: { width, height: width < 768 ? 800 : 900 }, reducedMotion: "reduce", storageState: { cookies: [], origins: [] } });
  if (who !== "first") {
    await asGuest(ctx);
    if (who === "guest-worker") await asMode(ctx, "worker");
    if (who === "guest-employer") await asMode(ctx, "employer");
    if (who === "worker" || who === "employer") {
      await loginAs(ctx, who === "worker" ? DEMO.worker : DEMO.employer);
      await asMode(ctx, who);
    }
  }
  await ctx.addCookies([{ name: "ishuz_locale", value: locale, domain: host, path: "/" }]);
  return ctx;
}

async function scaleText(page: Page, scale: number) {
  if (scale !== 1) await page.addStyleTag({ content: `html{font-size:${Math.round(scale * 100)}%}` });
}

test("overlap audit", async ({ browser }) => {
  test.setTimeout(60 * 60_000);
  const slug = await seedDemo();
  await seedLong();
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  const pages: { who: Who; url: string; name: string; action?: (p: Page) => Promise<void> }[] = [
    { who: "first", url: "/start/til", name: "start-language" },
    { who: "first", url: "/start/tanishtiruv", name: "start-intro" },
    { who: "first", url: "/start/rol", name: "start-role" },
    { who: "guest", url: "/", name: "guest-home" },
    { who: "guest", url: "/auth", name: "auth" },
    { who: "guest-worker", url: "/", name: "guest-seeker-home" },
    { who: "guest-employer", url: "/", name: "guest-employer-home" },
    { who: "worker", url: "/", name: "seeker-home" },
    { who: "worker", url: "/search?mode=jobs&any=1&region=all", name: "search" },
    { who: "worker", url: `/jobs/${slug}`, name: "vacancy" },
    { who: "worker", url: "/ai", name: "ai-hub" },
    { who: "worker", url: "/cabinet", name: "cabinet" },
    { who: "worker", url: "/post/worker", name: "post-worker" },
    { who: "employer", url: "/", name: "employer-home" },
    { who: "employer", url: "/employer/vacancies", name: "employer-vacancies" },
    { who: "employer", url: "/post/vacancy", name: "post-vacancy" },
    { who: "employer", url: "/cabinet", name: "employer-cabinet" },
    { who: "employer", url: "/search?mode=workers&any=1&region=all", name: "workers-search" },
    { who: "worker", url: "/applications", name: "applications" },
    { who: "worker", url: "/saved", name: "saved" },
    { who: "worker", url: "/notifications", name: "notifications" },
    { who: "worker", url: "/settings", name: "settings" },
    { who: "guest", url: "/help", name: "help" },
    { who: "guest-worker", url: "/students", name: "students" },
    { who: "guest-worker", url: "/ai-alerts", name: "ai-alerts" },
    {
      who: "worker",
      url: "/",
      name: "ai-dialog",
      action: async (p) => {
        await p.getByRole("button", { name: /AI|ИИ/ }).first().click();
        const d = p.getByRole("dialog");
        await d.locator("textarea").fill("Toshkentda sotuvchi");
        await d.locator("textarea").press("Enter");
        await expect(d.locator("article").first()).toBeVisible({ timeout: 15_000 });
      },
    },
  ];
  const report: Record<string, LayoutIssue[]> = {};
  for (const pg of pages) {
    for (const cfg of CONFIGS) {
      const ctx = await context(browser, cfg.width, cfg.locale, pg.who);
      const p = await ctx.newPage();
      const key = `${pg.name} · ${cfg.width} · ${cfg.locale} · ${cfg.textZoom ? `text${cfg.textZoom}` : `${cfg.scale}x`}`;
      try {
        await p.goto(pg.url);
        await p.waitForLoadState("networkidle").catch(() => undefined);
        await scaleText(p, cfg.scale);
        if (pg.action) await pg.action(p);
        if (cfg.textZoom) await zoomText(p, cfg.textZoom);
        await p.waitForTimeout(300);
        if (!pg.action) await fullHeight(p);
        const issues = await findLayoutIssues(p, pg.action ? "[role=dialog]" : "body");
        if (issues.length) {
          report[key] = issues;
          await markIssues(p, issues);
          await p.screenshot({ path: path.join(OUT, `${key.replace(/[^a-z0-9.-]+/gi, "_")}.jpg`), type: "jpeg", quality: 60, fullPage: !pg.action });
        }
      } catch (e) {
        report[key] = [{ kind: "clipped", text: `ERROR ${(e as Error).message.slice(0, 120)}`, box: { x: 0, y: 0, w: 0, h: 0 } }];
      }
      await ctx.close();
    }
  }
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
  await cleanDemo();
  await sql("delete from public.companies where id = $1", [LONG_CO]);
  console.log(`audit: ${Object.keys(report).length} holatda muammo`);
});
