import { expect, test, type Page } from "@playwright/test";
import { USERS, asGuest, sql } from "../support";

/**
 * Bosh sahifa (mehmon): sayt menyusi, /kasblar, pastki qism havolalari, SEO va 320–1440 px.
 * 2026-11-21 (ega: "kirgan zahoti chat"): bosh sahifa — chat (guided-chat.spec.ts); reklama sahifasidagi qidiruv paneli,
 * kasblar katalogi, yangi vakansiyalar ro'yxati va raqamlar olib tashlandi — ularning testlari ham.
 */

const HOME_H1 = "Ishingiz shu yerdan boshlanadi!";

async function seed() {
  await sql("delete from public.vacancies where owner_profile_id = $1", [USERS.employer]);
  await sql(
    `insert into public.vacancies (owner_profile_id, title, category_id, region_id, description, status, salary_from, salary_type, experience_min_months, is_remote, published_at, expires_at)
     select $1, t.title, c.id, r.id, 'Bosh sahifa sinovi: ' || t.title || ', ish vaqti 9 dan 18 gacha', 'active', t.salary, t.pay::public.salary_type, t.exp, t.remote, now(), now() + interval '10 days'
     from (values
       ('Frontend dasturchi', 'it', 12000000, 'monthly', 24, true),
       ('Backend dasturchi', 'it', 14000000, 'monthly', 24, false),
       ('Yuk tashuvchi', 'logistics', 200000, 'daily', 12, false)
     ) as t(title, cat, salary, pay, exp, remote)
     join public.categories c on c.slug = t.cat
     cross join (select id from public.regions where slug = 'tashkent_city') r`,
    [USERS.employer],
  );
}

const main = (page: Page) => page.getByRole("main");

test.describe("bosh sahifa (marketplace)", () => {
  test.beforeAll(seed);
  test.afterAll(async () => {
    await sql("delete from public.vacancies where owner_profile_id = $1", [USERS.employer]);
  });

  test("sayt menyusi (kompyuter): Ish qidirish · Kompaniyalar · Kasblar · Ish beruvchilar uchun; o'ngda Kirish va 'Ish joylashtirish'", async ({ page, context }) => {
    await asGuest(context);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");
    const banner = page.getByRole("banner");
    const nav = banner.getByRole("navigation", { name: "Sayt bo'limlari" });
    // oxirida — alohida bo'limlar: "AI yordamchi" (suhbat oynasi) va "Universal ustalar" (turkuaz rangda ajralib turadi)
    // (joy tor: "AI" qisqa nom bilan, ustalar — belgi bilan; to'liq nomlar aria-label'da — ekran o'qigichi va sichqoncha uchun)
    // evaluateAll kutmaydi — menyu chizilguncha qayta so'raladi (CI'da sekinroq)
    await expect
      .poll(() => nav.getByRole("link").evaluateAll((els) => els.map((el) => el.getAttribute("aria-label") ?? (el.textContent ?? "").trim())))
      .toEqual(["Ish qidirish", "Kompaniyalar", "Kasblar", "Ish beruvchilar uchun", "Yordamchi", "Universal ustalar xizmati"]);
    await expect(nav.getByRole("link", { name: "Yordamchi" })).toHaveText("Yordamchi");
    await expect(nav.getByRole("link", { name: "Yordamchi" })).toHaveAttribute("href", "/ai");
    await expect(nav.getByRole("link", { name: "Universal ustalar xizmati" })).toHaveAttribute("href", "/ustalar");
    // to'lovlar o'chiq stendda — "Xizmatlar" (narxlar) yo'q: o'lik havola ko'rsatilmaydi
    await expect(nav.getByRole("link", { name: "Xizmatlar" })).toHaveCount(0);
    // "Ro'yxatdan o'tish" — "Kirish" oqimining o'zi (telefon raqami); alohida havola — telefon menyusida
    await expect(banner.getByRole("link", { name: "Kirish" })).toBeVisible();
    await expect(banner.getByRole("link", { name: "Ish joylashtirish" })).toHaveAttribute("href", "/post/vacancy");
    await expect(banner.getByRole("link", { name: "Ish topdim" })).toHaveAttribute("href", "/");

    await nav.getByRole("link", { name: "Ish qidirish" }).click();
    await page.waitForURL(/\/jobs$/);
    await expect(nav.getByRole("link", { name: "Ish qidirish" })).toHaveAttribute("aria-current", "page");
    await nav.getByRole("link", { name: "Kompaniyalar" }).click();
    await page.waitForURL(/\/companies$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ish beruvchilar");
    await expect(nav.getByRole("link", { name: "Kompaniyalar" })).toHaveAttribute("aria-current", "page");
    await nav.getByRole("link", { name: "Kasblar" }).click();
    await page.waitForURL(/\/kasblar$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Kasblar katalogi");
    await expect(nav.getByRole("link", { name: "Kasblar" })).toHaveAttribute("aria-current", "page");
    await nav.getByRole("link", { name: "Ish beruvchilar uchun" }).click();
    await page.waitForURL(/\/for-employers$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Kerakli xodimni tez va ishonchli toping");
    await expect(nav.getByRole("link", { name: "Ish beruvchilar uchun" })).toHaveAttribute("aria-current", "page");
  });

  test("telefonda: ixcham sarlavha, menyu ochiladi va yopiladi; pastki menyu o'z joyida", async ({ page, context }) => {
    await asGuest(context);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await expect(page.getByRole("banner").getByRole("navigation", { name: "Sayt bo'limlari" })).toBeHidden();
    const menuButton = page.getByRole("banner").getByRole("button", { name: "Menyu" });
    await menuButton.click();
    const menu = page.getByRole("menu");
    await expect(menu.getByRole("menuitem")).toHaveText(["Kompaniyalar", "Kasblar", "Ish beruvchilar uchun", "Yordamchi", "Universal ustalar xizmati", "Biz haqimizda", "Yordam", "Ish joylashtirish", "Ro'yxatdan o'tish"]);
    await expect(menu.getByRole("menuitem", { name: "Yordamchi" })).toHaveAttribute("href", "/ai");
    await expect(menu.getByRole("menuitem", { name: "Universal ustalar xizmati" })).toHaveAttribute("href", "/ustalar");
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(menuButton).toBeFocused();
    await menuButton.click();
    await page.getByRole("menuitem", { name: "Biz haqimizda" }).click();
    await page.waitForURL(/\/about$/);
    await expect(page.locator("nav.bottom-nav")).toBeVisible();
  });

  test("/kasblar: barcha faol sohalar (son bilan) va suratli kartalar; ro'yxatdan o'tish shart emas", async ({ page, context }) => {
    await asGuest(context);
    await page.goto("/kasblar");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Kasblar katalogi");
    const [{ total }] = (await sql<{ total: string }>("select count(*) as total from public.categories where is_active")) as [{ total: string }];
    const all = main(page).getByRole("region", { name: "Barcha sohalar" }).getByRole("link");
    await expect(all).toHaveCount(Number(total));
    await expect(main(page).getByRole("link", { name: /Avtoservis/ }).first().getByRole("img")).toBeVisible();
    await expect(page.locator("link[rel='canonical']")).toHaveAttribute("href", /\/kasblar$/);
    await all.filter({ hasText: "Logistika va ombor" }).click();
    await page.waitForURL(/\/jobs\?category=logistics$/);
  });

  test("pastki qism: barcha havolalar ishlaydigan sahifalarga (o'lik havola yo'q)", async ({ page, context }) => {
    await asGuest(context);
    await page.goto("/");
    const footer = page.getByRole("contentinfo");
    // "Tariflar" (0080) — har doim bor va ishlaydigan sahifa (pastdagi tekshiruv /pricing ni ham ochadi)
    await expect(footer.getByRole("link", { name: "Tariflar" })).toHaveAttribute("href", "/pricing");
    // pastki qism kechroq chiziladi (birinchi ekrandan keyin) — havolalar paydo bo'lishini kutamiz
    await expect(footer.getByRole("link").nth(10)).toBeAttached();
    const hrefs = await footer.getByRole("link").evaluateAll((els) => els.map((el) => el.getAttribute("href") ?? ""));
    expect(hrefs.length).toBeGreaterThan(10);
    for (const href of [...new Set(hrefs)]) {
      expect(href, "bo'sh havola").not.toBe("");
      // tashqi sahifalar (Telegram, Instagram — social-links.spec) stenddan ochilmaydi: faqat saytning o'z havolalari tekshiriladi
      if (href.startsWith("mailto:") || /^https:\/\//.test(href)) continue;
      const res = await page.request.get(href);
      expect(res.status(), href).toBeLessThan(400);
    }
    await expect(footer.getByRole("link", { name: "Hisobni o'chirish" })).toHaveAttribute("href", "/account-deletion");
  });

  test("SEO: sarlavha, tavsif, canonical va Open Graph; bitta h1", async ({ page, context }) => {
    await asGuest(context);
    await page.goto("/?utm_source=e2e");
    await expect(page).toHaveTitle("Ish topdim — O'zbekistonda ish topish va xodim qidirish");
    await expect(page.locator("meta[name='description']")).toHaveAttribute("content", /^O'zbekiston bo'ylab vakansiyalarni qidiring/);
    // parametr bilan ochilsa ham canonical — parametrsiz bosh sahifa
    await expect(page.locator("link[rel='canonical']")).toHaveAttribute("href", /^https?:\/\/[^/?]+\/?$/);
    await expect(page.locator("meta[property='og:title']")).toHaveAttribute("content", "Ish topdim — O'zbekistonda ish topish va xodim qidirish");
    await expect(page.locator("meta[property='og:type']")).toHaveAttribute("content", "website");
    await expect(page.locator("meta[property='og:image']")).toHaveAttribute("content", /\/brand\/og-default\.png$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(HOME_H1);
    // bosh sahifa — chat (2026-11-21): qidiruv tizimlari uchun sahifa haqida qisqa matn va havolalar — pastki qismda
    await expect(page.getByRole("contentinfo")).toBeAttached();
  });

  test("320–1440 px: gorizontal siljish yo'q; sarlavha, qidiruv qatori va uchta tugma ko'rinadi", async ({ page, context }) => {
    await asGuest(context);
    for (const width of [320, 360, 390, 430, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: width < 768 ? 780 : 900 });
      await page.goto("/");
      await expect(page.getByRole("heading", { level: 1 }), `${width}px`).toHaveText(HOME_H1);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${width}px`).toBeLessThanOrEqual(0);
      await expect(main(page).locator("[data-guided-start='jobs']"), `${width}px`).toBeVisible();
      await expect(main(page).locator("[data-guided-start]"), `${width}px`).toHaveCount(3);
      await expect(page.locator("[data-home-q]"), `${width}px`).toBeVisible();
      const submit = page.locator("[data-home-submit]");
      const box = (await submit.boundingBox())!;
      expect(box.height, `${width}px`).toBeGreaterThanOrEqual(44);
      expect(box.x + box.width, `${width}px`).toBeLessThanOrEqual(width);
    }
  });
});
