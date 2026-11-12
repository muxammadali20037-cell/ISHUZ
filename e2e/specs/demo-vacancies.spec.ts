import { expect, test } from "@playwright/test";
import { USERS, asGuest, asMode, loginAs, sql } from "../support";

/**
 * Namuna (demo) vakansiyalar (0077) — ega: "barcha sohalar bo'yicha vakansiyalar qo'sh … bir marta olib tashla desam olib
 * tashlaysan". Alohida jadval (public.demo_vacancies), haqiqiy e'lonlar bilan aralashmaydi:
 *  - haqiqiy e'lon yo'q joyda (bosh sahifa ro'yxati, /jobs va /search ning bo'sh holati) — "Namuna e'lonlar" bloki, har kartada
 *    "Namuna" belgisi; ariza, saqlash, telefon, kompaniya yo'q;
 *  - haqiqiy e'lonlar yetarli bo'lsa — blok chizilmaydi;
 *  - /jobs/namuna — hammasi (soha bo'yicha), /jobs/namuna/<slug> — "Bu namuna e'lon" ogohlantirishi bilan, noindex;
 *  - admin bir bosishda olib tashlaydi va qaytaradi; oddiy foydalanuvchi boshqara olmaydi;
 *  - haqiqiy vakansiyalar jadvaliga, sitemap'ga va JobPosting'ga tushmaydi.
 * Stendda namunalar o'chirilgan holatda boshlanadi (e2e/stack/up.sh) — shu fayl o'zi yaratadi va oxirida olib tashlaydi.
 */

const clearReal = () => sql("delete from public.vacancies where owner_profile_id = $1", [USERS.employer]);

test.beforeAll(async () => {
  await clearReal();
  await sql("select public.demo_vacancies_seed()");
});
test.afterAll(async () => {
  await sql("select public.demo_vacancies_remove()");
  await clearReal();
  await sql("delete from public.admin_users where profile_id = $1", [USERS.workerB]);
});

test("bosh sahifa: haqiqiy e'lon yo'q — 'Namuna e'lonlar' bloki; karta → namuna sahifasi (ogohlantirish, ariza yo'q, noindex)", async ({ page, context }) => {
  await asGuest(context);
  await asMode(context, "worker");
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  // haqiqiy ro'yxat bo'sh ekani yashirilmaydi
  await expect(page.locator("#home-feed")).toBeVisible();
  await expect(page.getByText("Hozircha faol vakansiya yo'q")).toBeVisible();
  const block = page.locator("[data-demo-block]");
  await expect(block.getByRole("heading", { level: 2, name: "Namuna e'lonlar" })).toBeVisible();
  await expect(block.locator("[data-demo-note]")).toContainText("haqiqiy ish emas");
  const cards = block.locator("[data-demo-card]");
  await expect(cards).toHaveCount(6);
  // har kartada "Namuna" belgisi; kompaniya nomi, telefon, saqlash va ariza tugmasi yo'q
  await expect(block.locator("[data-demo-badge]")).toHaveCount(6);
  await expect(block.getByRole("button")).toHaveCount(0);
  await expect(block.locator("a[href^='tel:']")).toHaveCount(0);
  await expect(block.getByText("Ariza yuborish")).toHaveCount(0);
  await expect(block.getByRole("link", { name: "Barcha namunalar" })).toHaveAttribute("href", "/jobs/namuna");

  const title = (await cards.first().getByRole("heading", { level: 3 }).innerText()).trim();
  await cards.first().getByRole("link").click();
  await page.waitForURL(/\/jobs\/namuna\/namuna-[a-z0-9-]+$/);
  await expect(page.getByRole("banner")).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
  await expect(page.locator("[data-demo-banner]")).toContainText("Bu namuna e'lon");
  await expect(page.locator("[data-demo-banner]")).toContainText("Haqiqiy ish emas");
  // ariza, telefon, saqlash yo'q; keyingi qadamlar — haqiqiy imkoniyatlar
  await expect(page.locator("main").getByText("Ariza yuborish")).toHaveCount(0);
  await expect(page.locator("main a[href^='tel:']")).toHaveCount(0);
  await expect(page.locator("main").getByRole("link", { name: /Yangi ish chiqsa/ })).toHaveAttribute("href", "/ai-alerts?role=worker");
  await expect(page.locator("main").getByRole("link", { name: "Haqiqiy vakansiyalar" })).toHaveAttribute("href", "/jobs");
  // qidiruv tizimlariga chiqmaydi: noindex, JobPosting belgilanishi yo'q
  await expect(page.locator("meta[name='robots']")).toHaveAttribute("content", /noindex/);
  expect(await page.locator("script[type='application/ld+json']").allInnerTexts()).not.toEqual(expect.arrayContaining([expect.stringContaining("JobPosting")]));
});

test("haqiqiy e'lonlar yetarli bo'lsa — namuna bloki ko'rinmaydi; kam bo'lsa — haqiqiylaridan keyin", async ({ page, context }) => {
  const add = (n: number) =>
    sql(
      `insert into public.vacancies (owner_profile_id, title, region_id, description, status, salary_from, salary_type, schedule, published_at, expires_at)
       select $1, 'Haqiqiy e''lon ' || g, r.id, 'Namuna bloki sinovi uchun haqiqiy e''lon', 'active', 4000000, 'monthly', '5_2', now() - (g || ' minutes')::interval, now() + interval '10 days'
       from generate_series(1, $2::int) g cross join (select id from public.regions where slug = 'tashkent_city') r`,
      [USERS.employer, n],
    );
  try {
    await asGuest(context);
    await asMode(context, "worker");
    await page.setViewportSize({ width: 1280, height: 900 });
    await add(2);
    await page.goto("/");
    // 2 ta haqiqiy e'lon: avval ular, keyin namuna bloki (aralashmaydi)
    const feedCards = page.locator("#home-feed").locator("xpath=ancestor::section").locator("article");
    await expect(feedCards.first().getByRole("heading", { level: 3 })).toContainText("Haqiqiy e'lon");
    await expect(page.locator("[data-demo-block]")).toBeVisible();
    await expect(page.locator("[data-demo-block] article").first().locator("[data-demo-badge]")).toBeVisible();
    const order = await page.locator("main article").evaluateAll((els) => els.map((el) => (el.hasAttribute("data-demo-card") ? "namuna" : "haqiqiy")));
    expect(order.slice(0, 2)).toEqual(["haqiqiy", "haqiqiy"]);
    expect(order.indexOf("haqiqiy", 2)).toBe(-1);

    await clearReal();
    await add(5);
    await page.goto("/");
    await expect(page.locator("#home-feed")).toBeVisible();
    await expect(page.locator("[data-demo-block]")).toHaveCount(0);
    await expect(page.locator("[data-demo-card]")).toHaveCount(0);
  } finally {
    await clearReal();
  }
});

test("/jobs va /search: hech narsa topilmasa — o'sha sohadan namunalar; /jobs/namuna — barcha sohalar, saralash va sahifalash", async ({ page, context }) => {
  await asGuest(context);
  await asMode(context, "worker");
  await page.setViewportSize({ width: 1280, height: 900 });
  // /jobs: soha tanlangan, haqiqiy e'lon yo'q
  await page.goto("/jobs?category=it");
  const block = page.locator("[data-demo-block]");
  await expect(block).toBeVisible();
  await expect(block.locator("[data-demo-note]")).toContainText("«IT va dasturlash» sohasida hozircha haqiqiy e'lon yo'q");
  await expect(block.locator("[data-demo-card]")).toHaveCount(4);
  await expect(block.locator("[data-demo-card]").first().getByRole("link")).toHaveAttribute("href", /^\/jobs\/namuna\/namuna-it-\d$/);

  // /jobs/namuna: hammasi
  const n = (await sql<{ n: string }>("select count(*)::text as n from public.demo_vacancies"))[0]!.n;
  const c = (await sql<{ c: string }>("select count(*)::text as c from public.categories where is_active"))[0]!.c;
  expect(Number(n)).toBe(Number(c) * 4);
  await page.goto("/jobs/namuna");
  await expect(page.getByRole("heading", { level: 1, name: "Namuna e'lonlar" })).toBeVisible();
  await expect(page.getByRole("banner")).toHaveCount(1);
  await expect(page.locator("[data-demo-note]")).toContainText("ariza yuborib bo'lmaydi");
  await expect(page.locator("[data-demo-count]")).toHaveText(`${n} ta namuna`);
  await expect(page.locator("[data-demo-card]")).toHaveCount(24);
  await expect(page.locator("meta[name='robots']")).toHaveAttribute("content", /noindex/);
  await page.getByRole("link", { name: "Keyingi" }).click();
  await page.waitForURL(/page=2/);
  await expect(page.locator("[data-demo-card]")).toHaveCount(24);
  // soha bo'yicha (JS'siz ham ishlaydigan forma)
  await page.locator("[data-demo-filter] select").selectOption("medicine");
  await page.locator("[data-demo-filter]").getByRole("button").click();
  await page.waitForURL(/soha=medicine/);
  await expect(page.locator("[data-demo-card]")).toHaveCount(4);
  await expect(page.locator("[data-demo-count]")).toHaveText("4 ta namuna");

  // noto'g'ri manzil — 404 (xato ekrani emas)
  expect((await page.request.get("/jobs/namuna/namuna-yoq-9")).status()).toBe(404);
  expect((await page.request.get("/jobs/namuna/'; drop table x; --")).status()).toBe(404);

  // sitemap'da namuna yo'q
  const sitemap = await (await page.request.get("/sitemap.xml")).text();
  expect(sitemap).not.toContain("/jobs/namuna");
});

test("xavfsizlik: oddiy foydalanuvchi va mehmon admin sahifasini ko'rmaydi; haqiqiy vakansiyalar jadvaliga hech narsa tushmaydi", async ({ page, context }) => {
  // (jadvalga to'g'ridan-to'g'ri kirish va boshqaruv funksiyalari huquqlari — supabase/tests/demo_vacancies.test.sql da)
  const n = (await sql<{ n: string }>("select count(*)::text as n from public.demo_vacancies"))[0]!.n;
  expect(Number(n)).toBeGreaterThan(100);
  const real = (await sql<{ real: string }>("select count(*)::text as real from public.vacancies where slug like 'namuna-%'"))[0]!.real;
  expect(real).toBe("0");
  // namuna sahifasi haqiqiy vakansiya manzilida ochilmaydi (alohida manzil): "Sahifa topilmadi" (noindex)
  const asReal = await (await page.request.get("/jobs/namuna-it-1")).text();
  expect(asReal).toContain("Sahifa topilmadi");
  expect(asReal).not.toContain("data-demo-banner");

  await asGuest(context);
  await page.goto("/admin/namuna");
  await expect(page.locator("[data-admin-demo]")).toHaveCount(0);
  await loginAs(context, USERS.workerA);
  expect((await page.goto("/admin/namuna"))?.status()).toBe(404);
  await expect(page.locator("[data-admin-demo]")).toHaveCount(0);
});

test("admin: bir bosishda olib tashlaydi (tasdiq bilan) va qaytaradi; sayt darhol yangilanadi", async ({ page, context }) => {
  await sql(
    `insert into public.admin_users (profile_id, role, permissions, is_active) values ($1, 'super_admin', '{}', true)
     on conflict (profile_id) do update set is_active = true, role = 'super_admin'`,
    [USERS.workerB],
  );
  await loginAs(context, USERS.workerB, "aal2");
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/admin/namuna");
  const root = page.locator("[data-admin-demo]");
  await expect(root.getByRole("heading", { level: 1 })).toHaveText("Namuna e'lonlar");
  const n = (await sql<{ n: string }>("select count(*)::text as n from public.demo_vacancies"))[0]!.n;
  await expect(root.locator("[data-demo-count]")).toHaveAttribute("data-demo-count", n);
  // yon menyuda bo'lim bor
  await expect(page.getByRole("link", { name: "Namuna e'lonlar" }).first()).toHaveAttribute("href", "/admin/namuna");

  await root.locator("[data-demo-remove]").click();
  const dialog = page.getByRole("alertdialog").or(page.getByRole("dialog"));
  await expect(dialog).toContainText("Barcha namuna vakansiyalar olib tashlansinmi?");
  await dialog.getByRole("button", { name: "Ha, olib tashlash" }).click();
  await expect(root.getByRole("status")).toContainText(`${n} ta namuna olib tashlandi`);
  await expect(root.locator("[data-demo-count]")).toHaveAttribute("data-demo-count", "0");
  expect((await sql<{ n: string }>("select count(*)::text as n from public.demo_vacancies"))[0]!.n).toBe("0");

  // sayt: blok yo'qoldi, ro'yxat sahifasi "yo'q" deydi (xato emas)
  const guest = await context.browser()!.newContext({ baseURL: "http://localhost:3300", viewport: { width: 1280, height: 900 } });
  await asGuest(guest);
  await asMode(guest, "worker");
  const g = await guest.newPage();
  await g.goto("/");
  await expect(g.locator("#home-feed")).toBeVisible();
  await expect(g.locator("[data-demo-block]")).toHaveCount(0);
  await g.goto("/jobs/namuna");
  await expect(g.locator("[data-demo-empty]")).toBeVisible();
  await guest.close();

  // qaytarish
  await root.locator("[data-demo-seed]").click();
  await expect(root.getByRole("status")).toContainText(`${n} ta namuna qo'yildi`);
  await expect(root.locator("[data-demo-count]")).toHaveAttribute("data-demo-count", n);
});
