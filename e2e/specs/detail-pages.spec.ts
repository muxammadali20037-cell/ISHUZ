import { expect, test, type Page } from "@playwright/test";
import { USERS, asGuest, asMode, loginAs, sql } from "../support";

/**
 * I1 / 2026-10 · e'lon sahifalari ixcham: eng muhim ma'lumot (nomi, maosh, ish beruvchi, joy, grafik) birinchi ekranda,
 * qo'ng'iroq tavsifdan oldin, "Orqaga" — qidiruv natijalariga (o'sha joyiga), sahifa yonga siljimaydi.
 */

const TITLE = "Oshpaz — milliy taomlar (I1)";
const OTHER = "Ofitsiant — kafe (I1)";

async function seed() {
  await sql("delete from public.vacancies where owner_profile_id = $1", [USERS.employer]);
  await sql(
    `insert into public.employer_profiles (profile_id, employer_type, display_name, onboarding_completed_at)
     values ($1, 'person', 'Dilnoza opa', now()) on conflict (profile_id) do nothing`,
    [USERS.employer],
  );
  for (const [title, hours] of [[TITLE, 1], [OTHER, 2]] as const) {
    await sql(
      `insert into public.vacancies (owner_profile_id, title, region_id, district_id, category_id, description, status, salary_from, salary_to, salary_type, schedule, work_time_from, work_time_to, published_at, expires_at)
       select $1, $2, r.id, d.id, c.id,
         'Milliy taomlar oshpazi kerak. Palov, manti, lag''mon tayyorlay olish. Smena 2/2, ovqat va transport bilan. Tajriba 1 yildan.',
         'active', 5000000, 7000000, 'monthly', '2_2', '09:00', '18:00', now() - make_interval(hours => $3), now() + interval '10 days'
       from public.regions r join public.districts d on d.region_id = r.id and d.name_uz = 'Chilonzor tumani'
       cross join (select id from public.categories where slug = 'restaurant') c
       where r.slug = 'tashkent_city'`,
      [USERS.employer, title, hours],
    );
  }
  await sql(
    `insert into public.vacancy_contacts (vacancy_id, phone, show_phone)
     select id, '+998901112233', true from public.vacancies where owner_profile_id = $1 and title = $2`,
    [USERS.employer, TITLE],
  );
}

/** pastki yopishqoq panel va menyudan yuqoridagi ko'rinadigan chegara */
async function visibleBottom(page: Page) {
  return page.evaluate(() => {
    const vh = window.innerHeight;
    const fixed = Array.from(document.querySelectorAll("body *"))
      .filter((e) => {
        const s = getComputedStyle(e);
        const r = e.getBoundingClientRect();
        return (s.position === "fixed" || s.position === "sticky") && r.top > vh / 2 && r.height > 30;
      })
      .map((e) => e.getBoundingClientRect().top);
    return Math.min(vh, ...fixed);
  });
}

test.beforeEach(seed);
test.afterEach(async () => {
  await sql("delete from public.vacancies where owner_profile_id = $1", [USERS.employer]);
});

test("ish e'loni: nomi, maosh, ish beruvchi, joy va faktlar birinchi ekranda; qo'ng'iroq tavsifdan oldin; o'xshashlar ixcham", async ({ page, context }) => {
  await asGuest(context);
  await asMode(context, "worker");
  const [v] = await sql<{ slug: string }>("select slug from public.vacancies where title = $1", [TITLE]);
  await page.goto(`/jobs/${v!.slug}`);
  await page.waitForLoadState("networkidle");
  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { level: 1 })).toHaveText(TITLE);

  const bottom = await visibleBottom(page);
  // birinchi ekranda (pastki panel ustida): maosh, ish beruvchi, joy, grafik va ish vaqti (sarlavhada bir qatorda)
  // kompaniyasiz ish beruvchi — umumiy "Ish beruvchi" emas, ismi (mehmonga — ega ismi)
  const header = main.locator("header").first();
  await expect(header).toContainText("Dilnoza");
  for (const loc of [main.getByText("5 000 000 – 7 000 000 so'm").first(), header.getByText(/^Dilnoza/).first(), header.getByText("Chilonzor tumani, Toshkent shahri"), header.getByText("· 09:00–18:00")]) {
    const box = (await loc.boundingBox())!;
    expect(box.y + box.height).toBeLessThanOrEqual(bottom);
  }
  // 2026-10: bo'limlar ochiq (tablar yo'q) — Vazifalar · Talablar · Sharoitlar · Manzil · Kompaniya, yuqorida havolalar
  const nav = main.getByRole("navigation", { name: "Vakansiya bo'limlari" });
  await expect(nav.getByRole("link")).toHaveText(["Vazifalar", "Talablar", "Sharoitlar", "Manzil", "Kompaniya"]);
  for (const name of ["Vazifalar", "Talablar", "Sharoitlar", "Manzil", "Kompaniya"]) await expect(main.getByRole("region", { name })).toBeAttached();
  // shartlar — ixcham ro'yxat (yorliq + qiymat)
  const facts = main.getByRole("region", { name: "Sharoitlar" }).locator("dl");
  for (const label of ["Ish grafigi", "Bandlik turi", "Ish shakli"]) await expect(facts.locator("dt", { hasText: label })).toBeVisible();
  await expect(facts).toContainText("09:00–18:00");
  await nav.getByRole("link", { name: "Manzil" }).click();
  await expect(page).toHaveURL(/#manzil$/);
  await expect(main.getByRole("heading", { level: 2, name: "Manzil" })).toBeInViewport();

  // qo'ng'iroq — bo'limlardan oldin
  const call = main.getByRole("link", { name: "Qo'ng'iroq qilish" }).first();
  const about = main.getByRole("heading", { level: 2, name: "Vazifalar" });
  expect((await call.boundingBox())!.y).toBeLessThan((await about.boundingBox())!.y);

  // o'xshash vakansiya — ixcham qator
  const similar = main.getByRole("link", { name: new RegExp(OTHER.replace(/[()]/g, "\\$&")) });
  await expect(similar).toBeVisible();
  expect((await similar.boundingBox())!.height).toBeLessThanOrEqual(100);

  // telefon kengliklarida yonga siljimaydi
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await page.setViewportSize({ width: 360, height: 740 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(360);

  // kirgan foydalanuvchiga — qidiruv kartasidagi nom bilan bir xil ("Dilnoza opa")
  await loginAs(context, USERS.workerB);
  await page.reload();
  await expect(page.getByRole("main").locator("header").first()).toContainText("Dilnoza opa");
});

test("'Orqaga': qidiruvdan kelganda — o'sha natijalarga; havola orqali ochilganda — qidiruvga", async ({ page, context }) => {
  await asGuest(context);
  await asMode(context, "worker");
  const results = "/search?mode=jobs&any=1&region=tashkent_city&district=all";
  await page.goto(results);
  await page.locator("main article").filter({ hasText: TITLE }).getByRole("heading").getByRole("link").click();
  await expect(page.getByRole("heading", { level: 1, name: TITLE })).toBeVisible();
  await page.getByRole("link", { name: "Orqaga" }).click();
  await page.waitForURL((u) => u.pathname === "/search" && u.searchParams.get("region") === "tashkent_city");
  await expect(page.locator("main article").filter({ hasText: TITLE })).toBeVisible();

  // to'g'ridan-to'g'ri havola (tarix yo'q) — qidiruv sahifasiga
  const [v] = await sql<{ slug: string }>("select slug from public.vacancies where title = $1", [TITLE]);
  const fresh = await context.newPage();
  await fresh.goto(`/jobs/${v!.slug}`);
  await fresh.getByRole("link", { name: "Orqaga" }).click();
  await fresh.waitForURL((u) => u.pathname === "/search" && u.searchParams.get("mode") === "jobs");
  await fresh.close();
});

test("ishchi e'loni: ism birinchi ekran tepasida, katta bo'sh rasm yo'q, faktlar ixcham, 'Bog'lanish' birinchi ekranda", async ({ page, context }) => {
  await sql("delete from public.worker_profiles where profile_id = $1", [USERS.workerB]);
  const [n] = await sql<{ id: string; category_id: string }>("select id, category_id from public.profession_nodes where name_uz = 'Buxgalter' and selectable limit 1");
  const [r] = await sql<{ id: string }>("select id from public.regions where slug = 'tashkent_city'");
  const [w] = await sql<{ id: string }>(
    `insert into public.worker_profiles (profile_id, headline, about, region_id, profession_node_id, category_id, experience_level, onboarding_completed_at)
     values ($1, 'Buxgalter', 'Buxgalteriya, 1C, soliq hisobotlari. Kichik firmalarda 5 yil ishlaganman.', $2, $3, $4, '3_5y', now()) returning id`,
    [USERS.workerB, r!.id, n!.id, n!.category_id],
  );
  try {
    await loginAs(context, USERS.employer);
    await asMode(context, "employer");
    await page.goto(`/listing/${w!.id}`);
    await page.waitForLoadState("networkidle");
    const main = page.getByRole("main");
    const h1 = main.getByRole("heading", { level: 1 });
    await expect(h1).toContainText("Botir");
    expect((await h1.boundingBox())!.y).toBeLessThan(250); // avval ~460 px (240 px'lik rasm ostida)
    // rasm/kasb belgisi — ism yonida kichik
    const thumb = main.getByRole("img", { name: "Buxgalter" }).first();
    expect((await thumb.boundingBox())!.height).toBeLessThanOrEqual(64);
    const facts = main.locator("dl").first();
    for (const label of ["Hudud", "Tajriba"]) await expect(facts.locator("dt", { hasText: label })).toBeVisible();
    await expect(facts).toContainText("3 yildan ko'p");
    // bog'lanish bo'limi birinchi ekranda (pastki menyu ustida)
    const contact = main.locator("#contact");
    const bottom = await visibleBottom(page);
    expect((await contact.getByRole("heading", { name: "Bog'lanish" }).boundingBox())!.y).toBeLessThan(bottom);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  } finally {
    await sql("delete from public.worker_profiles where profile_id = $1", [USERS.workerB]);
  }
});
