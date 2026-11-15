import { expect, test } from "@playwright/test";
import { USERS, asGuest, asMode, loginAs, sql } from "../support";

/**
 * R-C / 2026-10 redizayn · bosh sahifa: birinchi ekranda qidiruv va haqiqiy e'lonlar. Har bir yo'l aytgan joyini ochadi:
 * qidiruv qatori → natijalar; tez filtr (Kunlik, Talabalar uchun) va "Filtrlar" → natijalar; "Barcha kasblar" → kasb tanlash;
 * e'lon berish → forma.
 */
const PATHS = [
  // 3.0 (2026-11-13): "O'zim haqimda e'lon berish" bosh sahifada yo'q — pastki menyudagi "E'lon" (navigatsiya testi)
  // 2.0 (2026-11-11): ish qidiruvchi bosh sahifasida 4 ta tez yo'l va "Filtrlar bilan qidirish"
  { mode: "worker", name: /^Kunlik ish$/, url: /\/search\?mode=jobs&region=all&pay=daily$/, heading: /Kunlik ishlar/ },
  { mode: "worker", name: /^Tajribasiz ish$/, url: /\/search\?mode=jobs&region=all&noexp=1&any=1$/, heading: /Ish e'lonlari/ },
  { mode: "worker", name: /^Filtrlar bilan qidirish$/, url: /\/search\?mode=jobs&region=all&any=1$/, heading: /Ish e'lonlari/ },
  { mode: "employer", name: /^Vakansiya joylash$/, url: /\/post\/vacancy$/, heading: /Qanday mutaxassis kerak/ },
  { mode: "employer", name: /^Tajribali/, url: /\/search\?mode=workers&region=all&exp=1&any=1$/, heading: /Ishchilar: Barcha kasblar/ },
] as const;

for (const p of PATHS) {
  test(`bosh sahifa (${p.mode}) → "${p.name.source}" kutilgan sahifani ochadi`, async ({ page, context }) => {
    await asGuest(context);
    await asMode(context, p.mode);
    await page.goto("/");
    // ro'yxat bo'sh bo'lsa (toza baza) "O'zim haqimda e'lon berish" bo'sh holatda ham turadi — birinchi ko'rinadiganini bosamiz
    const link = page.getByRole("main").getByRole("link", { name: p.name }).first();
    await expect(link).toBeVisible();
    await link.click();
    await page.waitForURL(p.url);
    await expect(page.getByRole("heading", { level: 1 }).or(page.getByRole("heading", { level: 2 })).first()).toContainText(p.heading);
  });
}

test("bosh sahifa: qidiruv qatori → kompaniya nomi bo'yicha natija (matn kasbga aylanmasa ham)", async ({ page, context }) => {
  await sql("delete from public.vacancies where owner_profile_id = $1", [USERS.employer]);
  const [co] = await sql<{ id: string }>(
    `insert into public.companies (name, slug, verification_status) values ('Sarbon Savdo', 'sarbon-savdo-e2e', 'verified')
     on conflict (slug) do update set name = excluded.name returning id`,
  );
  await sql(
    `insert into public.vacancies (owner_profile_id, company_id, title, region_id, description, status, salary_from, salary_type, experience_min_months, published_at, expires_at)
     select $1, $2, 'Kassir', r.id, 'Do''konga kassir kerak, 9 dan 18 gacha', 'active', 4000000, 'monthly', 0, now(), now() + interval '10 days'
     from public.regions r where r.slug = 'tashkent_city'`,
    [USERS.employer, co!.id],
  );
  try {
    await asGuest(context);
    await page.goto("/");
    await page.getByRole("searchbox", { name: "Kasb yoki lavozim" }).fill("Sarbon");
    await page.getByRole("search", { name: "Ish qidirish" }).getByRole("button", { name: "Qidirish", exact: true }).click();
    await page.waitForURL(/\/search\?mode=jobs&q=Sarbon/);
    const card = page.locator("main article").filter({ hasText: "Kassir" });
    await expect(card).toHaveCount(1);
    // kompaniya va haqiqiy "tasdiqlangan" belgisi; maosh davri bilan
    await expect(card.getByText("Sarbon Savdo")).toBeVisible();
    await expect(card.getByRole("img", { name: "Tasdiqlangan kompaniya" })).toBeVisible();
    await expect(card).toContainText("so'm/oy");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("«Sarbon»");
  } finally {
    await sql("delete from public.vacancies where owner_profile_id = $1", [USERS.employer]);
    await sql("delete from public.companies where slug = 'sarbon-savdo-e2e'");
  }
});

test("bosh sahifa (2.0): bitta h1 va bitta qidiruv maydoni birinchi ekranda; 4 ta tez yo'l; fon surati, nol raqamlar va plitkalar yo'q", async ({ page, context }) => {
  await asGuest(context);
  await asMode(context, "worker");
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Qanday ish qidiryapsiz?");
  // bitta qidiruv: yozilgan matn yordamchiga ketadi. 2026-11-15: telefonda u sarlavhada (Uzum kabi) — sahifada takrorlanmaydi
  const search = page.getByRole("search", { name: "Ish va ishchilar izlash" });
  await expect(search).toHaveCount(1);
  await expect(page.locator("header").getByRole("searchbox")).toHaveCount(1);
  await expect(page.getByRole("main").getByRole("searchbox")).toBeHidden();
  const box = (await search.boundingBox())!;
  expect(box.y + box.height).toBeLessThan(140);
  // tez yo'llar: 4 ta, shu tartibda, birinchi ekranda
  const quick = page.getByRole("navigation", { name: "Tez qidiruv" }).getByRole("listitem");
  expect((await quick.allInnerTexts()).map((x) => x.trim())).toEqual(["Kunlik ish", "Yaqin atrofda ish", "Masofaviy ish", "Tajribasiz ish"]);
  expect((await quick.last().boundingBox())!.y).toBeLessThan(844);
  // olib tashlanganlar: fon surati, "Faol vakansiyalar 0" kabi raqamlar, 8 ta plitka, ko'p bo'limli yon panel
  await expect(page.locator("main .hero-surface")).toHaveCount(0);
  await expect(page.locator("[data-home='seeker-v2'] img")).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Xizmatlar" })).toHaveCount(0);
  await expect(page.getByText("Faol vakansiyalar")).toHaveCount(0);
  await expect(page.locator("#home-feed")).toBeVisible();
});

test("bosh sahifa (4.0, telefon, kirgan): qidiruv, tez yo'llar, yig'ilgan 'Yangi ishlar' va bo'limlar menyusi — ortiqcha bloklar yo'q", async ({ page, context }) => {
  // ro'yxat bo'sh bo'lmasin: bo'sh holatda "O'zim haqimda e'lon berish" — to'g'ri keyingi qadam (bu test kartalar haqida)
  await sql("delete from public.vacancies where owner_profile_id = $1", [USERS.employer]);
  await sql(
    `insert into public.vacancies (owner_profile_id, title, region_id, description, status, salary_from, salary_type, published_at, expires_at)
     select $1, 'Kassir — 3.0 sinovi', r.id, 'Do''konga kassir kerak, 9 dan 18 gacha', 'active', 4000000, 'monthly', now(), now() + interval '10 days'
     from public.regions r where r.slug = 'tashkent_city'`,
    [USERS.employer],
  );
  await loginAs(context, USERS.workerA);
  await asMode(context, "worker");
  await page.goto("/");
  const main = page.getByRole("main");
  // "Yangi ishlar" — yig'ilgan (2026-11-15): bosilsa ro'yxat ochiladi
  const toggle = main.locator('[data-fold="home-feed"] [data-fold-toggle]');
  await expect(toggle).toContainText("Ko'rish");
  await expect(main.locator("article:visible")).toHaveCount(0);
  await toggle.click();
  await expect(main.locator("article").first()).toBeVisible();
  // ko'chirilganlar: "Mening dunyom" (Profilga), "Yangi ish chiqsa" (Profil → PRO kuzatuv), "O'zim haqimda e'lon" (pastki menyu)
  await expect(main.getByText("Mening dunyom")).toHaveCount(0);
  await expect(main.getByRole("link", { name: /Yangi ish chiqsa/ })).toHaveCount(0);
  await expect(main.getByRole("link", { name: /^O'zim haqimda e'lon berish/ })).toHaveCount(0);
  // "Yordamchi" va "Universal ustalar" — faqat bo'limlar menyusida (katta bloklar telefonda yo'q)
  await expect(main.locator("[data-ai-entry]")).toHaveCount(1);
  await expect(main.locator("[data-home-menu] [data-ai-entry]")).toHaveCount(1);
  await expect(main.locator("[data-masters-home]")).toBeHidden();
  const menu = main.locator("[data-home-menu]");
  expect((await menu.boundingBox())!.y).toBeGreaterThan((await main.locator('[data-fold="home-feed"]').boundingBox())!.y);
  await menu.locator('[data-menu-item="masters"]').click();
  await page.waitForURL(/\/ustalar$/);
  await sql("delete from public.vacancies where owner_profile_id = $1", [USERS.employer]);
});

test("bosh sahifa (390×844, kirgan ish qidiruvchi): 'Yangi ishlar' birinchi ekranda; ochilsa — birinchi vakansiyaning nomi, maoshi va hududi pastki menyudan yuqorida", async ({ page, context }) => {
  await sql("delete from public.vacancies where owner_profile_id = $1", [USERS.employer]);
  await sql(
    `insert into public.vacancies (owner_profile_id, title, region_id, district_id, description, status, salary_from, salary_to, salary_type, schedule, published_at, expires_at)
     select $1, 'Sotuvchi — birinchi ekran', r.id, d.id, 'Do''konga sotuvchi kerak, 9 dan 18 gacha', 'active', 4000000, 6000000, 'monthly', '5_2', now() + interval '1 minute', now() + interval '10 days'
     from public.regions r join public.districts d on d.region_id = r.id and d.name_uz = 'Chilonzor tumani' where r.slug = 'tashkent_city'`,
    [USERS.employer],
  );
  try {
    await loginAs(context, USERS.workerA);
    await asMode(context, "worker");
    await page.goto("/");
    const navTop = (await page.getByRole("navigation", { name: "Asosiy bo'limlar" }).last().boundingBox())!.y;
    const toggle = page.locator('main [data-fold="home-feed"] [data-fold-toggle]');
    const tb = (await toggle.boundingBox())!;
    expect(tb.y + tb.height).toBeLessThanOrEqual(navTop);
    await toggle.click();
    const card = page.locator("main article").first();
    await expect(card).toBeVisible();
    for (const part of [card.getByRole("heading", { level: 3 }), card.getByText(/so'm\/(oy|kun|soat)/).first(), card.locator("li[title]").first()]) {
      const box = (await part.boundingBox())!;
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.y + box.height).toBeLessThanOrEqual(navTop);
    }
    // suzuvchi AI tugmasi yo'q; qidiruv — bosh sahifaning yagona qidiruv maydoni
    await expect(page.locator(".ai-fab")).toHaveCount(0);
    await expect(page.locator("form[data-ai-field]:visible")).toHaveCount(1);
  } finally {
    await sql("delete from public.vacancies where owner_profile_id = $1", [USERS.employer]);
  }
});

test("navigatsiya: mehmonda brend nomi va 'Kirish' ko'rinadi; faol bo'lim belgilanadi", async ({ page, context }) => {
  await asGuest(context);
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("/");
  await expect(page.getByRole("banner").getByText("topdim")).toBeVisible();
  await expect(page.getByRole("banner").getByRole("link", { name: "Kirish" })).toBeVisible();
  // 2026-10: ish qidiruvchi (rejim tanlamagan mehmon ham) — Ishlar · Saqlangan · Arizalar · Profil
  const nav = page.getByRole("navigation", { name: "Asosiy bo'limlar" }).last();
  // o'rtada — bo'rtib turadigan "E'lon" (ish qidiruvchi: o'zi haqida e'lon / CV)
  await expect(nav.getByRole("link")).toHaveText(["Ishlar", "Saqlangan", "E'lon", "Arizalar", "Profil"]);
  await expect(nav.getByRole("link", { name: "E'lon" })).toHaveAttribute("href", "/post/worker");
  await expect(nav.getByRole("link", { name: "Ishlar" })).toHaveAttribute("aria-current", "page");
  await nav.getByRole("link", { name: "Saqlangan" }).click();
  await page.waitForURL(/\/saved$/);
  await expect(nav.getByRole("link", { name: "Saqlangan" })).toHaveAttribute("aria-current", "page");
  await expect(nav.getByRole("link", { name: "Ishlar" })).not.toHaveAttribute("aria-current", "page");
  // 360 px da yozuvlar sig'adi (kesilmaydi)
  for (const name of ["Ishlar", "Saqlangan", "E'lon", "Arizalar", "Profil"]) {
    const label = nav.getByRole("link", { name }).locator("span").first();
    expect(await label.evaluate((el) => el.scrollWidth <= el.clientWidth + 1), name).toBe(true);
  }
});

test("navigatsiya: kirgan foydalanuvchida 360 px da sarlavha sig'adi (gorizontal siljish yo'q)", async ({ page, context }) => {
  await loginAs(context, USERS.workerA);
  for (const width of [360, 390]) {
    await page.setViewportSize({ width, height: 780 });
    await page.goto("/");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `${width}px`).toBeLessThanOrEqual(0);
    await expect(page.getByRole("banner").getByRole("link", { name: "Xabarlar" })).toBeVisible();
    await expect(page.getByRole("banner").getByRole("link", { name: "Bildirishnomalar" })).toBeVisible();
  }
});

test("bosh sahifa kartalari: 360–1440 px da matn karta chetidan chiqmaydi (ikkala rejimda va rejim tanlanmaganda)", async ({ page, context }) => {
  await asGuest(context);
  const bad: string[] = [];
  const modes: ("worker" | "employer" | null)[] = [null, "worker", "employer"];
  for (const [mode, width] of modes.flatMap((m) => [360, 768, 1024, 1440].map((w) => [m, w] as const))) {
    await asGuest(context);
    if (mode) await asMode(context, mode);
    else await context.clearCookies({ name: "ib_mode" });
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const over = await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLElement>("main ul > li > a, main ul > li > section, main ul > li a, main section button"))
        .filter((el) => el.scrollWidth > el.clientWidth + 1)
        .map((el) => `${(el.textContent ?? "").trim().slice(0, 30)} (+${el.scrollWidth - el.clientWidth}px)`),
    );
    bad.push(...over.map((o) => `${mode ?? "rejimsiz"} ${width}px: ${o}`));
  }
  expect(bad).toEqual([]);
});
