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
  // 2026-11-17 (ega): "Tajribasiz ish" → "Tajriba talab qilinmaydigan ishlar"
  { mode: "worker", name: /^Tajriba talab qilinmaydigan ishlar$/, url: /\/search\?mode=jobs&region=all&noexp=1&any=1$/, heading: /Ish e'lonlari/ },
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
  // bitta qidiruv: yozilgan matn yordamchiga ketadi. 5.0 (2026-11-16, "ko'k-oq"): hero blokida (telefon va kompyuterda bir
  // xil); sarlavhada qidiruv yo'q (2026-11-15 dagi sarlavhadagi qidiruv o'rniga)
  const search = page.getByRole("search", { name: "Lavozim yoki kompaniyani qidiring..." });
  await expect(search).toHaveCount(1);
  await expect(page.locator("header").getByRole("searchbox")).toHaveCount(0);
  await expect(page.locator("[data-home='seeker-v2']").getByRole("searchbox")).toBeVisible();
  const box = (await search.boundingBox())!;
  expect(box.y + box.height).toBeLessThan(560);
  // qidiruv ostida katta "+ E'lon joylash" (ega, 2026-11-17)
  const post = page.locator("[data-home='seeker-v2'] [data-home-post]");
  await expect(post).toHaveText("E'lon joylash");
  // bosilsa — yordamchi (e'lon joylash rejimi)
  await expect(post).toHaveAttribute("href", "/ai/post");
  expect((await post.boundingBox())!.height).toBeGreaterThanOrEqual(56);
  // tez yo'llar: 4 ta katta plitka (hero ostida), shu tartibda; birinchisi birinchi ekranda
  const quick = page.getByRole("navigation", { name: "Tez qidiruv" }).getByRole("listitem");
  expect((await quick.allInnerTexts()).map((x) => x.trim())).toEqual(["Kunlik ish", "Yaqin atrofdan ish qidirish", "Masofaviy ish", "Tajriba talab qilinmaydigan ishlar"]);
  expect((await quick.first().boundingBox())!.y).toBeLessThan(844);
  for (const box of await quick.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height))) expect(box).toBeGreaterThanOrEqual(100);
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

test("bosh sahifa (390×844, kirgan ish qidiruvchi): qidiruv va «E'lon joylash» birinchi ekranda; keyin tez yo'llar, yig'ilgan 'Yangi ishlar' — ochilsa birinchi vakansiya nomi, maoshi va hududi bilan", async ({ page, context }) => {
  // 2026-11-17 (ega): hero ostida katta "+ E'lon joylash" va katta tez yo'llar — "Yangi ishlar" endi birinchi ekrandan pastda
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
    for (const el of [page.locator("form[data-ai-field]:visible"), page.locator("[data-home-post]")]) {
      const box = (await el.boundingBox())!;
      expect(box.y + box.height).toBeLessThanOrEqual(navTop);
    }
    // tartib: hero → tez yo'llar → "Yangi ishlar"
    const shortcutsY = (await page.locator("[data-home-shortcuts]").boundingBox())!.y;
    const toggle = page.locator('main [data-fold="home-feed"] [data-fold-toggle]');
    expect((await toggle.boundingBox())!.y).toBeGreaterThan(shortcutsY);
    await toggle.click();
    const card = page.locator("main article").first();
    await expect(card).toBeVisible();
    await expect(card.getByRole("heading", { level: 3 })).toBeVisible();
    await expect(card.getByText(/so'm\/(oy|kun|soat)/).first()).toBeVisible();
    await expect(card.locator("li[title]").first()).toBeVisible();
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
  // 4.0 (ega "MASTER PROMPT"): ish qidiruvchi (rejim tanlamagan mehmon ham) — Bosh sahifa · Ishlar · Arizalar · Xabarlar · Profil
  const nav = page.getByRole("navigation", { name: "Asosiy bo'limlar" }).last();
  await expect(nav.getByRole("link")).toHaveText(["Bosh sahifa", "Ishlar", "Arizalar", "Xabarlar", "Profil"]);
  await expect(nav.getByRole("link", { name: "Bosh sahifa" })).toHaveAttribute("aria-current", "page");
  await nav.getByRole("link", { name: "Ishlar" }).click();
  await page.waitForURL(/\/jobs$/);
  await expect(nav.getByRole("link", { name: "Ishlar" })).toHaveAttribute("aria-current", "page");
  await expect(nav.getByRole("link", { name: "Bosh sahifa" })).not.toHaveAttribute("aria-current", "page");
  // 360 px da yozuvlar sig'adi (kesilmaydi)
  for (const name of ["Bosh sahifa", "Ishlar", "Arizalar", "Xabarlar", "Profil"]) {
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
