import { expect, test } from "@playwright/test";
import { USERS, asGuest, asMode, sql } from "../support";

/**
 * /jobs/xarita — yaqin atrofdagi ishlar Yandex xaritasida (ega: "real karta qo'shish kerak yaqin atrofdagi ishlarni ko'rish uchun").
 * Stendda internet yo'q — Yandex vidjeti yuklanmaydi; tekshiriladi: vidjet manzili (raqamli belgilar, lng,lat), ro'yxat raqamlari
 * va masofa tartibi, aniq/taxminiy joy, joyi yo'q e'lonlar alohida, haqiqiy e'lon yo'q bo'lsa kulrang namunalar, JS'siz forma,
 * "Joylashuvim bo'yicha" (brauzer joylashuvi → eng yaqin tuman, koordinata URL'da yo'q), CSP va kirish nuqtalari.
 */

const clear = () => sql("delete from public.vacancies where owner_profile_id = $1", [USERS.employer]);

async function seed() {
  await clear();
  // Toshkent shahri: Chilonzor (aniq nuqta), Yunusobod (tuman markazi), tumansiz (joyi yo'q)
  await sql(
    `insert into public.vacancies (owner_profile_id, title, region_id, district_id, lat, lng, description, status, salary_from, salary_type, schedule, published_at, expires_at)
     select $1, t.title, r.id, d.id, t.lat, t.lng, 'Xarita sinovi: ' || t.title, 'active', 5000000, 'monthly', '5_2', now() - (t.ord || ' minutes')::interval, now() + interval '10 days'
     from (values
       ('Xarita: Chilonzor kassir', 'Chilonzor tumani', 41.2856::float8, 69.2034::float8, 1),
       ('Xarita: Yunusobod oshpaz', 'Yunusobod tumani', null, null, 2),
       ('Xarita: Yunusobod ofitsiant', 'Yunusobod tumani', null, null, 3)
     ) as t(title, dname, lat, lng, ord)
     join public.regions r on r.slug = 'tashkent_city'
     join public.districts d on d.region_id = r.id and d.name_uz = t.dname`,
    [USERS.employer],
  );
  await sql(
    `insert into public.vacancies (owner_profile_id, title, region_id, description, status, salary_from, salary_type, schedule, published_at, expires_at)
     select $1, 'Xarita: tumansiz qorovul', r.id, 'Xarita sinovi: tuman ko''rsatilmagan', 'active', 4000000, 'monthly', '2_2', now() - interval '4 minutes', now() + interval '10 days'
     from public.regions r where r.slug = 'tashkent_city'`,
    [USERS.employer],
  );
}

test.afterAll(clear);

test("Toshkent · Chilonzor: raqamli belgilar ro'yxat bilan mos, yaqinidan uzog'iga; aniq/taxminiy joy; joyi yo'q e'lon alohida", async ({ page, context }) => {
  await seed();
  await asGuest(context);
  await asMode(context, "worker");
  await page.setViewportSize({ width: 1280, height: 900 });
  const [chil] = await sql<{ id: string }>("select d.id from public.districts d join public.regions r on r.id = d.region_id where r.slug = 'tashkent_city' and d.name_uz = 'Chilonzor tumani'");
  await page.goto(`/jobs/xarita?region=tashkent_city&district=${chil!.id}`);
  await expect(page.getByRole("heading", { level: 1, name: "Yaqin atrofdagi ishlar — xaritada" })).toBeVisible();
  await expect(page.locator("[data-map-summary]")).toHaveText("Toshkent shahri · Chilonzor tumani: 4 ta faol e'lon");

  const items = page.locator("[data-map-list] > li");
  await expect(items).toHaveCount(3);
  // 1 — Chilonzor (aniq nuqta, eng yaqin), keyin Yunusobod (tuman markazi)
  await expect(items.nth(0)).toContainText("Xarita: Chilonzor kassir");
  await expect(items.nth(0)).toContainText("aniq manzil");
  await expect(items.nth(1)).toContainText("taxminan (tuman markazi)");
  await expect(items.nth(1)).toContainText(/≈ \d+([,.]\d)? km/);
  // tumansiz e'lon — xaritada emas, alohida ro'yxatda
  await expect(page.getByRole("heading", { level: 2, name: "Joyi ko'rsatilmagan e'lonlar" })).toBeVisible();
  await expect(page.getByText("Xarita: tumansiz qorovul")).toBeVisible();

  // vidjet: lng,lat tartibi, ko'k raqamli belgilar 1..3, sarlavha (a11y)
  const src = (await page.locator("[data-map-widget]").getAttribute("src"))!;
  expect(src.startsWith("https://yandex.ru/map-widget/v1/?")).toBe(true);
  expect(src).toContain("pt=69.2034,41.2856,pm2blm1~");
  expect(src).toMatch(/pm2blm2~[\d.]+,[\d.]+,pm2blm3$/);
  await expect(page.locator("[data-map-widget]")).toHaveAttribute("title", "Toshkent shahri · Chilonzor tumani — ish joylari xaritasi");
  await expect(page.locator("[data-map-external]")).toHaveAttribute("href", /^https:\/\/yandex\.uz\/maps\/\?ll=/);
  // bir tumandagi ikki e'lon ustma-ust emas (belgilar suriladi)
  const pts = src.split("pt=")[1]!.split("~").map((p) => p.split(",").slice(0, 2).join(","));
  expect(new Set(pts).size).toBe(3);
  // CSP vidjetga ruxsat beradi
  const res = await page.request.get("/jobs/xarita");
  expect(res.headers()["content-security-policy"]).toContain("frame-src 'self' https://yandex.ru https://yandex.uz");
});

test("haqiqiy e'lon yo'q viloyat: kulrang namuna belgilari ochiq yozilgan; JS'siz forma bilan joy almashtiriladi", async ({ page, context }) => {
  await clear();
  await sql("select public.demo_vacancies_seed()");
  try {
    await asGuest(context);
    await asMode(context, "worker");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/jobs/xarita?region=samarkand");
    await expect(page.locator("[data-map-summary]")).toHaveText("Samarqandda hozircha faol vakansiya yo'q");
    await expect(page.locator("[data-map-empty]")).toContainText("namuna e'lonlar");
    const demo = page.locator("[data-map-demo-list] > li");
    expect(await demo.count()).toBeGreaterThan(0);
    await expect(demo.first().locator("[data-demo-badge]")).toBeVisible();
    expect(await page.locator("[data-map-widget]").getAttribute("src")).toContain("pm2grm1");
    expect(await page.locator("[data-map-widget]").getAttribute("src")).not.toContain("pm2blm");

    // forma (GET): viloyatni almashtirish
    await page.locator("[data-map-place] select[name=region]").selectOption("andijan");
    await page.locator("[data-map-place]").getByRole("button", { name: "Ko'rsatish" }).click();
    await page.waitForURL(/region=andijan/);
    await expect(page.locator("[data-map-summary]")).toContainText("Andijon");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  } finally {
    await sql("select public.demo_vacancies_remove()");
  }
});

test("'Joylashuvim bo'yicha': eng yaqin tuman tanlanadi, koordinata manzilda yo'q; bosh sahifadan kirish", async ({ page, context }) => {
  await seed();
  await asGuest(context);
  await asMode(context, "worker");
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 41.2856, longitude: 69.2034 });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  await page.locator("main [data-map-entry]").click();
  await page.waitForURL(/\/jobs\/xarita/);
  await page.locator("[data-map-locate]").click();
  await page.waitForURL(/district=/);
  expect(page.url()).not.toContain("41.28");
  expect(page.url()).not.toContain("69.20");
  await expect(page.locator("[data-map-summary]")).toContainText("Toshkent shahri · Chilonzor tumani");
  await expect(page.locator("[data-map-list] > li").first()).toContainText("Xarita: Chilonzor kassir");
});
