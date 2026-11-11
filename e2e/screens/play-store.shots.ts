import fs from "node:fs";
import path from "node:path";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { asMode, loginAs, stack } from "../support";
import { DEMO, cleanDemo, seedDemo } from "./demo-seed";

/**
 * Google Play do'kon sahifasi uchun rasmlar (2.0 dizayn, faqat lokal stendda; namunaviy ma'lumot — demo-seed):
 *   npx playwright test -c e2e/screens/shots.config.ts e2e/screens/play-store.shots.ts
 * Natija: docs/play-store/screenshots-{uz,ru}/01…06.jpg (1080×1920) va feature-graphic-{uz,ru}.png (1024×500).
 * Hech qanday soxta son yo'q: ekranlarda stenddagi haqiqiy (namunaviy) e'lonlar ko'rinadi.
 */
const OUT = path.join(__dirname, "../../docs/play-store");
const host = new URL(stack.app).hostname;

const TEXT = {
  uz: { headline: ["Ish va ishchini", "bir necha daqiqada toping"], pills: ["AI yordamchi", "Mos ishlar", "Telegram orqali kirish"], ask: "Chilonzorda sotuvchi" },
  ru: { headline: ["Работа и работники —", "за несколько минут"], pills: ["ИИ-помощник", "Подходящие вакансии", "Вход через Telegram"], ask: "продавец в Чиланзаре" },
} as const;

async function phone(browser: Browser, locale: "uz" | "ru", setup: (c: import("@playwright/test").BrowserContext) => Promise<void>) {
  const c = await browser.newContext({ baseURL: stack.app, viewport: { width: 360, height: 640 }, deviceScaleFactor: 3, locale: locale === "ru" ? "ru-RU" : "uz-UZ", storageState: { cookies: [], origins: [] } });
  await c.addCookies([
    { name: "ishuz_locale", value: locale, domain: host, path: "/" },
    { name: "ib_intro", value: "1", domain: host, path: "/" },
    { name: "ib_consent", value: "1", domain: host, path: "/" },
  ]);
  await setup(c);
  return c;
}

async function shot(page: Page, file: string) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.waitForTimeout(600);
  await page.screenshot({ path: file, type: "jpeg", quality: 88 });
}

test.beforeAll(async () => {
  await seedDemo();
});
test.afterAll(async () => {
  await cleanDemo();
});

for (const locale of ["uz", "ru"] as const) {
  test(`do'kon rasmlari: ${locale}`, async ({ browser }) => {
    test.setTimeout(240_000);
    const dir = path.join(OUT, `screenshots-${locale}`);
    fs.mkdirSync(dir, { recursive: true });
    const T = TEXT[locale];

    // 01 — xush kelibsiz (til + rol)
    const g = await phone(browser, locale, async (c) => c.clearCookies({ name: "ib_intro" }));
    let page = await g.newPage();
    await page.goto("/start/til");
    await expect(page.locator("form[data-welcome-roles]")).toBeVisible();
    await shot(page, path.join(dir, "01.jpg"));
    await g.close();

    // 02 — ish izlovchi bosh sahifasi
    const w = await phone(browser, locale, (c) => asMode(c, "worker"));
    page = await w.newPage();
    await page.goto("/");
    await expect(page.locator("#home-feed")).toBeVisible();
    await shot(page, path.join(dir, "02.jpg"));

    // 03 — AI yordamchi javobi (bazadagi haqiqiy namunaviy e'lonlar)
    await page.goto("/ai");
    const field = page.getByRole("main").getByLabel(locale === "ru" ? "Что ищете?" : "Nima qidiryapsiz?");
    await field.fill(T.ask);
    await page.getByRole("main").getByRole("button", { name: locale === "ru" ? "Найти" : "Topish" }).click();
    await expect(page.getByRole("main").locator("article").first()).toBeVisible({ timeout: 20_000 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.getByRole("main").locator("[data-ai-reply]").last().scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, -80));
    await shot(page, path.join(dir, "03.jpg"));

    // 04 — qidiruv natijalari
    await page.goto("/search?mode=jobs&region=all&any=1");
    await expect(page.locator("main article").first()).toBeVisible();
    await shot(page, path.join(dir, "04.jpg"));

    // 06 — vakansiya sahifasi
    await page.locator("main article").first().getByRole("heading").getByRole("link").click();
    await page.waitForURL(/\/jobs\//);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await shot(page, path.join(dir, "06.jpg"));
    await w.close();

    // 05 — ish beruvchi paneli (demo kompaniya)
    const e = await phone(browser, locale, async (c) => {
      await loginAs(c, DEMO.employer);
      await c.addCookies([
        { name: "ishuz_locale", value: locale, domain: host, path: "/" },
        { name: "ib_intro", value: "1", domain: host, path: "/" },
        { name: "ib_consent", value: "1", domain: host, path: "/" },
      ]);
      await asMode(c, "employer");
    });
    page = await e.newPage();
    await page.goto("/");
    await expect(page.locator("[data-home='employer-v2']")).toBeVisible();
    await shot(page, path.join(dir, "05.jpg"));
    await e.close();

    // feature graphic 1024×500: brend, shior va telefon ko'rinishi (02-ekranning o'zi)
    const home = fs.readFileSync(path.join(dir, "02.jpg")).toString("base64");
    const icon = fs.readFileSync(path.join(__dirname, "../../public/icons/icon-512.png")).toString("base64");
    const fg = await browser.newContext({ viewport: { width: 1024, height: 500 }, deviceScaleFactor: 1 });
    page = await fg.newPage();
    await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
      *{box-sizing:border-box;margin:0}
      body{width:1024px;height:500px;overflow:hidden;font-family:Inter,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
        background:radial-gradient(900px 500px at 85% 20%,#2b5fd9 0%,#13224a 55%,#0d1830 100%);color:#fff;position:relative}
      .l{position:absolute;left:64px;top:92px;width:520px}
      .brand{display:flex;align-items:center;gap:18px}
      .brand img{width:76px;height:76px;border-radius:20px;background:#fff;padding:6px}
      .brand span{font-size:44px;font-weight:800;letter-spacing:-0.02em}
      .brand b{color:#8fd3ff;font-weight:800}
      h1{margin-top:34px;font-size:40px;line-height:1.12;font-weight:800;letter-spacing:-0.02em}
      h1 em{font-style:normal;color:#7ee0b8}
      .pills{display:flex;gap:10px;margin-top:26px;flex-wrap:wrap}
      .pills span{border:1.5px solid rgba(255,255,255,.35);border-radius:999px;padding:9px 16px;font-size:17px;font-weight:600;background:rgba(255,255,255,.08)}
      .ph{position:absolute;right:66px;top:54px;width:272px;height:560px;border-radius:38px;background:#0b1326;padding:12px;transform:rotate(-8deg);box-shadow:0 30px 60px rgba(0,0,0,.45)}
      .ph img{width:100%;height:100%;object-fit:cover;object-position:top;border-radius:28px;display:block}
    </style></head><body>
      <div class="l">
        <div class="brand"><img src="data:image/png;base64,${icon}" alt=""><span>Ish <b>topdim</b></span></div>
        <h1>${T.headline[0]}<br><em>${T.headline[1]}</em></h1>
        <div class="pills">${T.pills.map((p) => `<span>${p}</span>`).join("")}</div>
      </div>
      <div class="ph"><img src="data:image/jpeg;base64,${home}" alt=""></div>
    </body></html>`);
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(OUT, `feature-graphic-${locale}.png`), type: "png" });
    await fg.close();
  });
}

test("do'kon ikonasi: ilovaning o'zidagi belgi (oq fon, 512×512)", async () => {
  fs.copyFileSync(path.join(__dirname, "../../public/icons/maskable-512.png"), path.join(OUT, "icon-512.png"));
});
