import { expect, test, type Page } from "@playwright/test";
import { USERS, asGuest, sql } from "../support";

/**
 * Bosh sahifa (mehmon, rejim tanlanmagan; 2026-11-05 — haqiqiy suratlar): sayt menyusi, uch maydonli qidiruv (mavjud /search
 * oqimiga), suratli kasblar katalogi (bazadagi sonlar bilan) va /kasblar, tanlangan vakansiyalar (qoida ochiq yozilgan),
 * yangi vakansiyalar ro'yxati (bo'sh va xato holatlari alohida), ishonch bo'limi, ish beruvchilar bo'limi, pastki qism
 * havolalari, SEO va 320–1440 px. Kirish oqimi va ikki yo'l — entry.spec.ts.
 */

const HOME_H1 = "Ish toping. Yoki jamoangizga odam toping.";
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
const latest = (page: Page) => main(page).getByRole("region", { name: "Yangi vakansiyalar" });

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
    // oxirida — "Universal ustalar" (alohida bo'lim, turkuaz rangda ajralib turadi)
    await expect(nav.getByRole("link")).toHaveText(["Ish qidirish", "Kompaniyalar", "Kasblar", "Ish beruvchilar uchun", "Universal ustalar"]);
    await expect(nav.getByRole("link", { name: "Universal ustalar" })).toHaveAttribute("href", "/ustalar");
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
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Kompaniyalar");
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
    await expect(menu.getByRole("menuitem")).toHaveText(["Kompaniyalar", "Kasblar", "Ish beruvchilar uchun", "Universal ustalar", "Biz haqimizda", "Yordam", "Ish joylashtirish", "Ro'yxatdan o'tish"]);
    await expect(menu.getByRole("menuitem", { name: "Universal ustalar" })).toHaveAttribute("href", "/ustalar");
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(menuButton).toBeFocused();
    await menuButton.click();
    await page.getByRole("menuitem", { name: "Biz haqimizda" }).click();
    await page.waitForURL(/\/about$/);
    await expect(page.locator("nav.bottom-nav")).toBeVisible();
  });

  test("qidiruv paneli: kasb yoki lavozim · hudud · ish turi — /search ga to'g'ri parametrlar bilan", async ({ page, context }) => {
    await asGuest(context);
    await page.goto("/");
    const form = page.getByRole("search", { name: "Ish qidirish" });
    await form.getByRole("searchbox", { name: "Kasb yoki lavozim" }).fill("yuk tashuvchi");
    await form.getByLabel("Hudud").selectOption({ label: "Samarqand" });
    await form.getByLabel("Ish turi").selectOption({ label: "Kunlik ish (kunbay to'lov)" });
    await form.getByRole("button", { name: "Qidirish", exact: true }).click();
    await page.waitForURL(/\/search\?/);
    const url = new URL(page.url());
    expect(url.searchParams.get("mode")).toBe("jobs");
    expect(url.searchParams.get("region")).toBe("samarkand");
    expect(url.searchParams.get("pay")).toBe("daily");

    // kasb yozilmagan, "Butun O'zbekiston" — barcha kasblar bo'yicha natijalar darhol
    await page.goto("/");
    await form.getByLabel("Hudud").selectOption({ label: "Butun O'zbekiston" });
    await form.getByRole("button", { name: "Qidirish", exact: true }).click();
    await page.waitForURL(/\/search\?mode=jobs&region=all&any=1$/);
    await expect(page.locator("main article").filter({ hasText: "Backend dasturchi" })).toHaveCount(1);
  });

  test("qanday ishlaydi: ikki auditoriya, 4 + 4 qadam; takror 'Nega Ish topdim?' yo'q", async ({ page, context }) => {
    await asGuest(context);
    await page.goto("/");
    const how = main(page).getByRole("region", { name: "Qanday ishlaydi" });
    await expect(how.getByRole("listitem")).toHaveCount(8);
    await expect(main(page).getByRole("heading", { name: "Nega Ish topdim?" })).toHaveCount(0);
  });

  test("kasblar katalogi: suratli kartalar (tavsifli rasm, 4:3), son bazadan; surati yo'q soha — 'Boshqa kasblar' da", async ({ page, context }) => {
    await asGuest(context);
    await page.goto("/");
    const section = main(page).getByRole("region", { name: "Ommabop kasblar" });
    // o'rnatilgan surat: tavsifi bilan, havola — soha filtri
    const medicine = section.getByRole("link", { name: /Tibbiyot/ });
    await expect(medicine).toHaveAttribute("href", "/jobs?category=medicine");
    const img = medicine.getByRole("img");
    await expect(img).toHaveAttribute("alt", "Klinikada qo'llarini qovushtirib turgan shifokor");
    // har kartadagi surat bir xil nisbatda (layout siljimaydi): 4:3
    const box = (await img.boundingBox())!;
    expect(Math.abs(box.width / box.height - 4 / 3)).toBeLessThan(0.02);
    // IT — surati yo'q: "Boshqa kasblar" ro'yxatida, son — bazadan
    const [it] = await sql<{ n: string }>(`select count(*) as n from public.vacancies v join public.categories c on c.id = v.category_id where c.slug = 'it' and v.${ACTIVE}`);
    const chip = section.getByRole("list", { name: "Boshqa kasblar" }).getByRole("link", { name: /^IT va dasturlash/ });
    await expect(chip).toContainText(it!.n);
    await chip.click();
    await page.waitForURL(/\/jobs\?category=it$/);
    await expect(page.locator("main").getByText("Backend dasturchi").first()).toBeVisible();
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

  test("tanlangan vakansiyalar: qoida ochiq yozilgan va bajariladi; kartada kompaniya, maosh, belgilar va saqlash", async ({ page, context }) => {
    await asGuest(context);
    await page.goto("/");
    const featured = main(page).getByRole("region", { name: "Tanlangan vakansiyalar" });
    const rule = featured.getByText(/^(Maoshi ochiq ko'rsatilgan e'lonlar|Tekshirilgan ish beruvchilardan, maoshi ochiq ko'rsatilgan e'lonlar)$/);
    await expect(rule).toBeVisible();
    const cards = featured.locator("article");
    // to'r doim to'liq qatorlar: 2, 4 yoki 8 ta
    expect([2, 4, 8]).toContain(await cards.count());
    // har kartada maosh (qoida — maoshi ko'rsatilgan) va belgilar ro'yxati; "tekshirilgan" qoidasida — har birida tasdiq belgisi
    const verifiedRule = (await rule.innerText()).startsWith("Tekshirilgan");
    for (const card of await cards.all()) {
      await expect(card).toContainText(/so'm/);
      await expect(card.getByRole("list", { name: "Vakansiya belgilari" })).toBeVisible();
      if (verifiedRule) await expect(card.getByRole("img", { name: "Tasdiqlangan kompaniya" })).toBeVisible();
    }
    // saqlash — mehmon kirishga yuboriladi (keyin shu joyga qaytadi)
    await cards.first().getByRole("button", { name: /^Saqlash: / }).click();
    await page.waitForURL(/\/auth\?next=/);
  });

  test("yangi vakansiyalar: ro'yxat (kompaniya · joy · ish turi · maosh · sana), 'Barcha yangi vakansiyalar'", async ({ page, context }) => {
    await asGuest(context);
    await page.goto("/");
    const rows = latest(page).locator("article");
    await expect(rows.first()).toBeVisible();
    expect(await rows.count()).toBeLessThanOrEqual(6);
    const row = rows.filter({ hasText: "Frontend dasturchi" });
    await expect(row).toContainText("Masofaviy");
    await expect(latest(page).getByRole("link", { name: /^Barcha yangi vakansiyalar/ })).toHaveAttribute("href", "/jobs?sort=newest");
    await row.getByRole("link", { name: "Frontend dasturchi" }).click();
    await page.waitForURL(/\/jobs\/[^/?]+$/);
  });

  test("'Yangi vakansiyalar' xatosi: bo'sh deb ko'rsatilmaydi — tushuntirish va 'Qayta urinish'", async ({ page, context }) => {
    // ro'yxat so'rovi (search_vacancies_v2) mehmonga vaqtincha yopiq: xato "bo'sh" deb ko'rsatilmasligi kerak
    const SIG =
      "public.search_vacancies_v2(text, uuid, uuid, uuid, uuid[], integer, public.employment_type[], public.work_schedule[], public.work_format, integer, boolean, text[], boolean, boolean, boolean, uuid, boolean, public.opportunity_type[], boolean, uuid, text, integer, integer)";
    await asGuest(context);
    try {
      await sql(`revoke execute on function ${SIG} from public, anon, authenticated`);
      await page.goto("/");
      const alert = latest(page).getByRole("alert");
      await expect(alert).toContainText("Ishlarni yuklab bo'lmadi");
      await expect(alert.getByRole("button", { name: "Qayta urinish" })).toBeVisible();
      await expect(latest(page).getByText("Hozircha bu bo'limda faol vakansiyalar yo'q.")).toHaveCount(0);
      // tanlangan vakansiyalar ham o'sha so'rovdan — xatoda bo'lim umuman yo'q (soxta "bo'sh" emas)
      await expect(main(page).getByRole("region", { name: "Tanlangan vakansiyalar" })).toHaveCount(0);
    } finally {
      await sql(`grant execute on function ${SIG} to public, anon, authenticated`);
    }
  });

  test("raqamlar bazadan (birinchi ekranda, katta surat bilan) va ishonch bo'limi — haqiqiy himoya qoidalari", async ({ page, context }) => {
    await asGuest(context);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");
    const fmt = (n: string) => new Intl.NumberFormat("ru-RU").format(Number(n));
    const [v] = await sql<{ n: string }>(`select count(*) as n from public.vacancies where ${ACTIVE}`);
    const [e] = await sql<{ n: string }>(`select count(distinct coalesce(company_id::text, owner_profile_id::text)) as n from public.vacancies where ${ACTIVE}`);
    const hero = main(page).getByRole("region", { name: HOME_H1 });
    await expect(hero.getByText(`${fmt(v!.n)} ta faol vakansiya`)).toBeVisible();
    await expect(hero.getByText("ish beruvchi xodim qidirmoqda")).toBeVisible();
    await expect(hero.getByText(fmt(e!.n), { exact: true })).toBeVisible();
    await expect(hero.getByRole("img", { name: "Qurilish maydonida sariq kaskadagi ishchi" })).toBeVisible();
    const trust = main(page).getByRole("region", { name: /^(Ishonchli ish beruvchilar|Xavfsiz va ishonchli)$/ });
    await expect(trust.getByText("Har bir e'lon tekshiriladi")).toBeVisible();
    await expect(trust.getByText("Telefon raqamingiz himoyada")).toBeVisible();
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
    // pastki qism kechroq chiziladi (birinchi ekrandan keyin) — havolalar paydo bo'lishini kutamiz
    await expect(footer.getByRole("link").nth(10)).toBeAttached();
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
  });

  test("320–1440 px: gorizontal siljish yo'q, qidiruv tugmasi va ikki yo'l ko'rinadi", async ({ page, context }) => {
    await asGuest(context);
    for (const width of [320, 360, 390, 430, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: width < 768 ? 780 : 900 });
      await page.goto("/");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${width}px`).toBeLessThanOrEqual(0);
      await expect(main(page).getByRole("button", { name: /^Men ish qidiryapman/ }), `${width}px`).toBeVisible();
      await expect(main(page).getByRole("button", { name: /^Menga ishchi kerak/ }), `${width}px`).toBeVisible();
      const submit = page.getByRole("search", { name: "Ish qidirish" }).getByRole("button", { name: "Qidirish", exact: true });
      await submit.scrollIntoViewIfNeeded();
      const box = (await submit.boundingBox())!;
      expect(box.height, `${width}px`).toBeGreaterThanOrEqual(44);
      expect(box.x + box.width, `${width}px`).toBeLessThanOrEqual(width);
    }
  });
});
