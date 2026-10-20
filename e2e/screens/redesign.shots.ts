import fs from "node:fs";
import path from "node:path";
import { expect, test, type BrowserContext } from "@playwright/test";
import { asGuest, asMode, loginAs, stack } from "../support";
import { DEMO, cleanDemo, seedDemo } from "./demo-seed";

/**
 * Redizayn oldin/keyin: 5 ta ekran × 390 va 1440 px, bir xil (faqat lokal stenddagi) namunaviy ma'lumot bilan.
 * Ma'lumot har ishga tushishda qayta yoziladi (aniq id'lar) — "oldin" va "keyin" bir xil holatda olinadi.
 */
const TAG = process.env.SHOTS_TAG ?? "before";
const OUT = path.join(__dirname, "../../docs/screenshots/redesign-2026-10");
const EMP = DEMO.employer;
const WRK = DEMO.worker;
const seed = seedDemo;

/** Namunaviy e'lonlar boshqa E2E testlar natijasiga aralashmasin (stend umumiy) — skrinshotdan keyin o'chiriladi */
test.afterAll(cleanDemo);

async function as(ctx: BrowserContext, who: "worker" | "employer") {
  await loginAs(ctx, who === "worker" ? WRK : EMP);
  await asMode(ctx, who);
}

const shot = async (page: import("@playwright/test").Page, name: string, width: number) => {
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.waitForTimeout(500);
  fs.mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: path.join(OUT, `${TAG}-${name}-${width}.jpg`), type: "jpeg", quality: 72 });
  await page.screenshot({ path: path.join(OUT, `${TAG}-${name}-${width}-full.jpg`), type: "jpeg", quality: 60, fullPage: true });
};

test("redizayn: 5 ekran × 390/1440", async ({ browser }) => {
  const slug = await seed();
  for (const width of [390, 1440]) {
    const viewport = { width, height: width < 768 ? 844 : 900 };
    const w = await browser.newContext({ baseURL: stack.app, viewport, reducedMotion: "reduce" });
    await asGuest(w);
    await as(w, "worker");
    const p = await w.newPage();
    await p.goto("/");
    await expect(p.getByRole("heading", { level: 1 })).toBeVisible();
    await shot(p, "1-seeker-home", width);
    await p.goto("/search?mode=jobs&any=1&region=tashkent_city&district=all");
    await shot(p, "2-search", width);
    await p.goto(`/jobs/${slug}`);
    await expect(p.getByRole("heading", { level: 1 })).toBeVisible();
    await shot(p, "3-vacancy", width);
    await w.close();

    const e = await browser.newContext({ baseURL: stack.app, viewport, reducedMotion: "reduce" });
    await asGuest(e);
    await as(e, "employer");
    const q = await e.newPage();
    await q.goto("/");
    await expect(q.getByRole("heading", { level: 1 })).toBeVisible();
    await shot(q, "4-employer-home", width);
    await q.goto("/post/vacancy");
    await shot(q, "5-post-vacancy", width);
    await e.close();
  }
});

/** Qo'shimcha holatlar (faqat "keyin"): ru tili, 360 px, mehmon (ish qidiruvchi rejimi), qidiruv 768 px */
test("redizayn: qo'shimcha holatlar (ru, 360, mehmon, planshet)", async ({ browser }) => {
  test.skip(TAG === "before", "faqat yangi dizayn uchun");
  await seed();
  const take = async (name: string, viewport: { width: number; height: number }, setup: (ctx: BrowserContext) => Promise<void>, url = "/") => {
    const ctx = await browser.newContext({ baseURL: stack.app, viewport, reducedMotion: "reduce" });
    await asGuest(ctx);
    await setup(ctx);
    const p = await ctx.newPage();
    await p.goto(url);
    await expect(p.getByRole("heading", { level: 1 }).first()).toBeVisible();
    await shot(p, name, viewport.width);
    await ctx.close();
  };
  const ru = async (ctx: BrowserContext) => {
    await as(ctx, "worker");
    await ctx.addCookies([{ name: "ishuz_locale", value: "ru", url: stack.app }]);
  };
  await take("1-seeker-home-ru", { width: 390, height: 844 }, ru);
  await take("1-seeker-home", { width: 360, height: 780 }, (ctx) => as(ctx, "worker"));
  await take("6-guest-seeker-home", { width: 390, height: 844 }, (ctx) => asMode(ctx, "worker"));
  await take("2-search-ru", { width: 390, height: 844 }, ru, "/search?mode=jobs&any=1&region=tashkent_city&district=all");
  await take("2-search", { width: 768, height: 1024 }, (ctx) => as(ctx, "worker"), "/search?mode=jobs&any=1&region=tashkent_city&district=all");
});
