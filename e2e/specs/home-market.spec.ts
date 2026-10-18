import { expect, test, type Page } from "@playwright/test";
import { USERS, asGuest, sql } from "../support";

/**
 * Bosh sahifa (mehmon, rejim tanlanmagan) — marketplace ko'rinishi: sayt menyusi, qidiruv paneli (mavjud /search oqimiga),
 * sohalar (bazadagi sonlar bilan), "Yangi ishlar" filtrlari (haqiqiy natijalar, bo'sh va xato holatlari), ish beruvchilar
 * bo'limi, raqamlar (bazadan), pastki qism havolalari, SEO va 320–1440 px. Kirish oqimi va ikki yo'l — entry.spec.ts.
 */

const HOME_H1 = "O'zingizga mos ishni toping yoki eng yaxshi xodimni toping!";
const ACTIVE = "status = 'active' and (expires_at is null or expires_at > now())";

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
const latest = (page: Page) => main(page).getByRole("region", { name: "Yangi ishlar" });

test.describe("bosh sahifa (marketplace)", () => {
  test.beforeAll(seed);
  test.afterAll(async () => {
    await sql("delete from public.vacancies where owner_profile_id = $1", [USERS.employer]);
  });

  test("sayt menyusi (kompyuter): bo'limlar haqiqiy sahifalarga; faol bo'lim belgilanadi; ro'yxatdan o'tish — rol tanlashdan", async ({ page, context }) => {
    await asGuest(context);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");
    const nav = page.getByRole("banner").getByRole("navigation", { name: "Sayt bo'limlari" });
    await expect(nav.getByRole("link")).toHaveText(["Bosh sahifa", "Ishlar", "Ishchilar", "Biz haqimizda"]);
    await expect(nav.getByRole("link", { name: "Bosh sahifa" })).toHaveAttribute("aria-current", "page");
    // to'lovlar o'chiq stendda — "Xizmatlar" (narxlar) yo'q: o'lik havola ko'rsatilmaydi
    await expect(nav.getByRole("link", { name: "Xizmatlar" })).toHaveCount(0);
    await expect(page.getByRole("banner").getByRole("link", { name: "Ro'yxatdan o'tish" })).toHaveAttribute("href", /^\/start\/rol\?next=/);
    await expect(page.getByRole("banner").getByRole("link", { name: "Ish topdim" })).toHaveAttribute("href", "/");

    await nav.getByRole("link", { name: "Biz haqimizda" }).click();
    await page.waitForURL(/\/about$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Biz haqimizda");
    await expect(nav.getByRole("link", { name: "Biz haqimizda" })).toHaveAttribute("aria-current", "page");
    await nav.getByRole("link", { name: "Ishchilar" }).click();
    await page.waitForURL(/\/search\?mode=workers/);
    await expect(nav.getByRole("link", { name: "Ishchilar" })).toHaveAttribute("aria-current", "page");
    await nav.getByRole("link", { name: "Ishlar" }).click();
    await page.waitForURL(/\/search\?mode=jobs/);
    await expect(nav.getByRole("link", { name: "Ishlar" })).toHaveAttribute("aria-current", "page");
  });

  test("telefonda: ixcham sarlavha, menyu ochiladi va yopiladi; pastki menyu o'z joyida", async ({ page, context }) => {
    await asGuest(context);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await expect(page.getByRole("banner").getByRole("navigation", { name: "Sayt bo'limlari" })).toBeHidden();
    const menuButton = page.getByRole("banner").getByRole("button", { name: "Menyu" });
    await menuButton.click();
    const menu = page.getByRole("menu");
    await expect(menu.getByRole("menuitem")).toHaveText(["Ishchilar", "Biz haqimizda", "Yordam", "Ro'yxatdan o'tish"]);
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(menuButton).toBeFocused();
    await menuButton.click();
    await page.getByRole("menuitem", { name: "Biz haqimizda" }).click();
    await page.waitForURL(/\/about$/);
    await expect(page.locator("nav.bottom-nav")).toBeVisible();
  });

  test("qidiruv paneli: kasb, viloyat, ish turi va maosh — /search ga to'g'ri parametrlar bilan (tuman — keyingi qadamda)", async ({ page, context }) => {
    await asGuest(context);
    await page.goto("/");
    const form = page.getByRole("search", { name: "Ish qidirish" });
    await form.getByRole("searchbox", { name: "Kasb yoki lavozim" }).fill("yuk tashuvchi");
    await form.getByLabel("Hudud").selectOption({ label: "Samarqand" });
    await form.getByLabel("Ish turi").selectOption({ label: "Kunlik ish (kunbay to'lov)" });
    await form.getByLabel("Maosh (oyiga)").selectOption({ label: "5 mln so'mdan" });
    await form.getByRole("button", { name: "Ish qidirish", exact: true }).click();
    await page.waitForURL(/\/search\?/);
    const url = new URL(page.url());
    expect(url.searchParams.get("mode")).toBe("jobs");
    expect(url.searchParams.get("region")).toBe("samarkand");
    expect(url.searchParams.get("pay")).toBe("daily");
    expect(url.searchParams.get("salary")).toBe("5000000");

    // kasb yozilmagan, "Butun O'zbekiston" — barcha kasblar bo'yicha natijalar darhol
    await page.goto("/");
    await form.getByLabel("Hudud").selectOption({ label: "Butun O'zbekiston" });
    await form.getByRole("button", { name: "Ish qidirish", exact: true }).click();
    await page.waitForURL(/\/search\?mode=jobs&region=all&any=1$/);
    await expect(page.locator("main article").filter({ hasText: "Backend dasturchi" })).toHaveCount(1);
  });

  test("sohalar: son bazadagi bilan bir xil, karta /jobs?category= ga olib boradi; 'Barcha kategoriyalar' qolganini ochadi", async ({ page, context }) => {
    await asGuest(context);
    await page.goto("/");
    const section = main(page).getByRole("region", { name: "Sohalar bo'yicha ishlar" });
    const [it] = await sql<{ n: string }>(`select count(*) as n from public.vacancies v join public.categories c on c.id = v.category_id where c.slug = 'it' and v.${ACTIVE}`);
    const card = section.getByRole("link", { name: /^IT va dasturlash/ });
    await expect(card).toContainText(`${it!.n} ta vakansiya`);
    const [{ total }] = (await sql<{ total: string }>("select count(*) as total from public.categories where is_active")) as [{ total: string }];
    const more = section.getByText(`Barcha kategoriyalar (${total})`);
    await expect(section.getByRole("link", { name: "Boshqa", exact: true })).toBeHidden();
    await more.click();
    await expect(section.getByRole("link", { name: "Boshqa", exact: true })).toBeVisible();
    await card.click();
    await page.waitForURL(/\/jobs\?category=it$/);
    await expect(page.locator("main").getByText("Backend dasturchi").first()).toBeVisible();
  });

  test("'Yangi ishlar': filtrlar haqiqiy natijani ko'rsatadi, URL'da saqlanadi; bo'sh filtr — tushuntirish va yo'llar", async ({ page, context }) => {
    await asGuest(context);
    await page.goto("/");
    const tabs = latest(page).getByRole("navigation", { name: "Ishlarni saralash" });
    await expect(tabs.getByRole("link", { name: "Barcha ishlar" })).toHaveAttribute("aria-current", "page");
    await expect(latest(page).locator("article").filter({ hasText: "Backend dasturchi" })).toHaveCount(1);

    await tabs.getByRole("link", { name: "Kunlik" }).click();
    await page.waitForURL(/\/\?ish=daily/);
    await expect(tabs.getByRole("link", { name: "Kunlik" })).toHaveAttribute("aria-current", "page");
    const daily = latest(page).locator("article");
    await expect(daily.filter({ hasText: "Yuk tashuvchi" })).toHaveCount(1);
    await expect(daily.filter({ hasText: "Backend dasturchi" })).toHaveCount(0);

    await tabs.getByRole("link", { name: "Masofaviy" }).click();
    await page.waitForURL(/\/\?ish=remote/);
    await expect(latest(page).locator("article").filter({ hasText: "Frontend dasturchi" })).toHaveCount(1);
    await expect(latest(page).locator("article").filter({ hasText: "Yuk tashuvchi" })).toHaveCount(0);
    await expect(latest(page).getByRole("link", { name: /^Barcha ishlarni ko'rish/ })).toHaveAttribute("href", "/search?mode=jobs&region=remote&any=1");

    // tajribasizlar uchun: shu stendda bunday faol e'lon bo'lmasa — bo'sh holat (sabab va keyingi qadamlar bilan)
    const [noexp] = await sql<{ n: string }>(`select count(*) as n from public.vacancies where ${ACTIVE} and experience_min_months = 0`);
    await tabs.getByRole("link", { name: "Tajribasizlar uchun" }).click();
    await page.waitForURL(/\/\?ish=noexp/);
    if (Number(noexp!.n) === 0) {
      await expect(latest(page).getByText("Hozircha bu bo'limda faol vakansiyalar yo'q.")).toBeVisible();
      await expect(latest(page).getByRole("link", { name: "Barcha ishlarni ko'rsatish" })).toBeVisible();
      await expect(latest(page).getByRole("link", { name: "Sohalarni ko'rish" })).toHaveAttribute("href", "#sohalar");
      await expect(latest(page).getByRole("button", { name: "Vakansiya joylashtirish" })).toBeVisible();
    } else {
      await expect(latest(page).locator("article").first()).toBeVisible();
    }
  });

  test("'Yangi ishlar' xatosi: bo'sh deb ko'rsatilmaydi — tushuntirish va 'Qayta urinish'", async ({ page, context }) => {
    const SIG = "public.simple_search_vacancies(uuid, uuid, uuid, boolean, integer, public.work_schedule, boolean, integer, integer)";
    await asGuest(context);
    try {
      await sql(`alter function ${SIG} rename to simple_search_vacancies_e2e_off`);
      await sql("notify pgrst, 'reload schema'");
      await page.waitForTimeout(1500);
      await page.goto("/");
      const alert = latest(page).getByRole("alert");
      await expect(alert).toContainText("Ishlarni yuklab bo'lmadi");
      await expect(alert.getByRole("button", { name: "Qayta urinish" })).toBeVisible();
      await expect(latest(page).getByText("Hozircha bu bo'limda faol vakansiyalar yo'q.")).toHaveCount(0);
    } finally {
      await sql(`alter function ${SIG.replace("simple_search_vacancies", "simple_search_vacancies_e2e_off")} rename to simple_search_vacancies`);
      await sql("notify pgrst, 'reload schema'");
      await page.waitForTimeout(1500);
    }
  });

  test("raqamlar bazadan: faol vakansiyalar va ish beruvchilar; ta'rifi bilan", async ({ page, context }) => {
    await asGuest(context);
    await page.goto("/");
    const stats = main(page).getByRole("region", { name: "Platforma raqamlarda" });
    const [v] = await sql<{ n: string }>(`select count(*) as n from public.vacancies where ${ACTIVE}`);
    const [e] = await sql<{ n: string }>(`select count(distinct coalesce(company_id::text, owner_profile_id::text)) as n from public.vacancies where ${ACTIVE}`);
    await expect(stats.getByRole("definition").filter({ hasText: "Hozir qidiruvda ko'rinadigan" })).toContainText(new Intl.NumberFormat("ru-RU").format(Number(v!.n)));
    await expect(stats.getByRole("definition").filter({ hasText: "Kamida bitta faol vakansiyasi bor" })).toContainText(new Intl.NumberFormat("ru-RU").format(Number(e!.n)));
  });

  test("ish beruvchilar bo'limi: 'Xodimlarni ko'rish' — ishchilar qidiruvi (ish beruvchi rejimida)", async ({ page, context }) => {
    await asGuest(context);
    await page.goto("/");
    const band = main(page).getByRole("region", { name: "Sizga kerakli xodimni toping." });
    await band.getByRole("button", { name: "Xodimlarni ko'rish" }).click();
    await page.waitForURL(/\/search\?mode=workers&region=all&any=1$/);
    expect((await context.cookies()).find((c) => c.name === "ib_mode")?.value).toBe("employer");
  });

  test("pastki qism: barcha havolalar ishlaydigan sahifalarga (o'lik havola yo'q)", async ({ page, context }) => {
    await asGuest(context);
    await page.goto("/");
    const footer = page.getByRole("contentinfo");
    await expect(footer.getByRole("link", { name: "Narxlar" })).toHaveCount(0);
    const hrefs = await footer.getByRole("link").evaluateAll((els) => els.map((el) => el.getAttribute("href") ?? ""));
    expect(hrefs.length).toBeGreaterThan(10);
    for (const href of [...new Set(hrefs)]) {
      expect(href, "bo'sh havola").not.toBe("");
      if (href.startsWith("mailto:") || href.startsWith("https://t.me/")) continue;
      const res = await page.request.get(href);
      expect(res.status(), href).toBeLessThan(400);
    }
    await expect(footer.getByRole("link", { name: "Hisobni o'chirish" })).toHaveAttribute("href", "/account-deletion");
  });

  test("SEO: sarlavha, tavsif, canonical va Open Graph; bitta h1", async ({ page, context }) => {
    await asGuest(context);
    await page.goto("/?ish=daily");
    await expect(page).toHaveTitle("Ish topdim — O'zbekistonda ish topish va xodim qidirish");
    await expect(page.locator("meta[name='description']")).toHaveAttribute("content", /^O'zbekiston bo'ylab vakansiyalarni qidiring/);
    // filtr (?ish=) bilan ochilsa ham canonical — filtrsiz bosh sahifa
    await expect(page.locator("link[rel='canonical']")).toHaveAttribute("href", /^https?:\/\/[^/?]+\/?$/);
    await expect(page.locator("meta[property='og:title']")).toHaveAttribute("content", "Ish topdim — O'zbekistonda ish topish va xodim qidirish");
    await expect(page.locator("meta[property='og:type']")).toHaveAttribute("content", "website");
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(HOME_H1);
  });

  test("320–1440 px: gorizontal siljish yo'q, qidiruv tugmasi va ikki yo'l ko'rinadi", async ({ page, context }) => {
    await asGuest(context);
    for (const width of [320, 375, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: width < 768 ? 780 : 900 });
      await page.goto("/");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${width}px`).toBeLessThanOrEqual(0);
      await expect(main(page).getByRole("button", { name: /^Ish qidiraman/ }), `${width}px`).toBeVisible();
      await expect(main(page).getByRole("button", { name: /^Xodim qidiraman/ }), `${width}px`).toBeVisible();
      const submit = page.getByRole("search", { name: "Ish qidirish" }).getByRole("button", { name: "Ish qidirish", exact: true });
      await submit.scrollIntoViewIfNeeded();
      const box = (await submit.boundingBox())!;
      expect(box.height, `${width}px`).toBeGreaterThanOrEqual(44);
      expect(box.x + box.width, `${width}px`).toBeLessThanOrEqual(width);
    }
  });
});
