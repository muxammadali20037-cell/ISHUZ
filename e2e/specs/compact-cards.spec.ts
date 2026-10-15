import { expect, test, type Page } from "@playwright/test";
import { USERS, asGuest, asMode, loginAs, sql } from "../support";

/**
 * H1 · natijalar kartasi ixcham: 390×844 ekranda kamida 3 ta e'lon to'liq ko'rinadi (avval bitta karta butun ekranni
 * egallardi); kartaning istalgan joyi bosilsa e'lon ochiladi; "Saqlash" va amal tugmasi karta havolasi ostida qolmaydi.
 */

const TITLES = ["Kassir — supermarket", "Oshpaz — milliy taomlar", "Sotuvchi — kiyim do'koni", "Buxgalter — kichik firma", "Qorovul — tungi smena", "Farrosh — ofis"];

async function seed() {
  await sql("delete from public.vacancies where owner_profile_id = $1", [USERS.employer]);
  await sql(
    `insert into public.employer_profiles (profile_id, employer_type, display_name, onboarding_completed_at)
     values ($1, 'person', 'Dilnoza opa', now()) on conflict (profile_id) do nothing`,
    [USERS.employer],
  );
  await sql("update public.profile_contacts set phone_visibility = 'applicants' where profile_id = $1", [USERS.employer]);
  for (const [i, title] of TITLES.entries()) {
    await sql(
      `insert into public.vacancies (owner_profile_id, title, region_id, district_id, description, status, salary_from, salary_to, salary_type, schedule, published_at, expires_at)
       select $1, $2, r.id, d.id, 'Sinov e''loni: ' || $2 || ', 9 dan 18 gacha, tushlik bepul', 'active', 3000000, 6000000, 'monthly', '5_2', now() - make_interval(hours => $3), now() + interval '10 days'
       from public.regions r join public.districts d on d.region_id = r.id and d.name_uz = 'Chilonzor tumani' where r.slug = 'tashkent_city'`,
      [USERS.employer, title, i],
    );
  }
  // bittasida raqam ochiq — kartada "Qo'ng'iroq qilish"
  await sql(
    `insert into public.vacancy_contacts (vacancy_id, phone, show_phone)
     select id, '+998901112233', true from public.vacancies where owner_profile_id = $1 and title = $2`,
    [USERS.employer, TITLES[0]],
  );
}

/** pastki menyudan yuqorida to'liq ko'rinadigan kartalar soni (sahifa, shrift va rasmlar to'liq yuklangach) */
async function fullyVisible(page: Page) {
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
  return page.evaluate(() => {
    const vh = window.innerHeight;
    const navs = Array.from(document.querySelectorAll("nav")).map((n) => n.getBoundingClientRect()).filter((r) => r.height > 0 && r.top > vh / 2);
    const bottom = navs.length ? Math.min(vh, ...navs.map((r) => r.top)) : vh;
    return Array.from(document.querySelectorAll("main article")).filter((a) => {
      const r = a.getBoundingClientRect();
      return r.top >= 0 && r.bottom <= bottom;
    }).length;
  });
}

/** eng baland karta (px) — scroll holatiga bog'liq bo'lmagan to'g'ridan-to'g'ri o'lchov */
async function maxCardHeight(page: Page) {
  const hs = await page.locator("main article").evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().height)));
  return Math.max(...hs);
}

/** barmoq bilan bosish: element markaziga (karta havolasi kartani qoplaydi — bo'sh joy bosilsa e'lon ochiladi) */
async function tap(page: Page, el: ReturnType<Page["locator"]>) {
  await el.evaluate((n) => n.scrollIntoView({ block: "center" }));
  const box = (await el.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

/** element ustida hech narsa yo'q — bosilganda aynan u ishlaydi (karta havolasi qoplab olmagan) */
async function onTop(page: Page, selector: string) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return false;
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !!hit && (hit === el || el.contains(hit));
  }, selector);
}

test.beforeEach(seed);
test.afterEach(async () => {
  await sql("delete from public.vacancies where owner_profile_id = $1", [USERS.employer]);
});

test("ish e'lonlari: 390×844 da kamida 3 ta karta to'liq; karta bosilsa e'lon ochiladi; tugmalar ishlaydi", async ({ page, context }) => {
  await asGuest(context);
  await asMode(context, "worker");
  await page.goto("/search?mode=jobs&any=1&region=all");
  await expect(page.locator("main article")).toHaveCount(TITLES.length);
  expect(await fullyVisible(page)).toBeGreaterThanOrEqual(3);
  expect(await maxCardHeight(page)).toBeLessThanOrEqual(200); // avval 376–563 px

  // kartada (R-C tartibi): nomi, maosh va davri, ish beruvchi, joy, jadval, sana; katta "Batafsil" tugmasi yo'q
  const card = page.locator("main article").filter({ hasText: "Oshpaz — milliy taomlar" });
  await expect(card).toContainText("3 000 000 – 6 000 000 so'm/oy");
  await expect(card.getByText("Dilnoza opa", { exact: true })).toBeVisible();
  await expect(card.getByText("Toshkent shahri · Chilonzor tumani", { exact: true })).toBeVisible();
  // tasdiqlanmagan ish beruvchi — "tasdiqlangan" belgisi yo'q
  await expect(card.getByRole("img", { name: "Tasdiqlangan kompaniya" })).toHaveCount(0);
  await expect(card).toContainText("5/2");
  await expect(card).toContainText("Bugun");
  await expect(card.getByRole("link", { name: "Batafsil" })).toHaveCount(0);

  // raqam ochiq e'lon — kichik "Qo'ng'iroq qilish" (nomida raqam), qolganlarida — "Ariza yuborish"
  const call = page.locator("main article").filter({ hasText: TITLES[0] }).getByRole("link", { name: /^Qo'ng'iroq qilish: \+998 90 111 22 33$/ });
  await expect(call).toHaveText("Qo'ng'iroq");
  await expect(call).toHaveAttribute("href", "tel:+998901112233");
  expect(await onTop(page, "main article a[href^='tel:']")).toBe(true);
  await expect(card.getByRole("link", { name: "Ariza yuborish" })).toBeVisible();
  expect(await onTop(page, "main article a[href$='?apply=1']")).toBe(true);
  expect(await onTop(page, "main article button[aria-pressed]")).toBe(true);

  // 360 px telefonda ham karta ixcham: amal qatori ikkiga bo'linmaydi (avval 376–563 px edi)
  await page.setViewportSize({ width: 360, height: 740 });
  expect(await maxCardHeight(page)).toBeLessThanOrEqual(200);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(360);
  await page.setViewportSize({ width: 390, height: 844 });

  // kartaning bo'sh joyi (maosh yozuvi) bosilsa — e'lon sahifasi
  await tap(page, card.getByText("3 000 000 – 6 000 000 so'm"));
  await expect(page.getByRole("heading", { level: 1, name: "Oshpaz — milliy taomlar" })).toBeVisible();
});

test("ishchilar: 390×844 da kamida 3 ta karta to'liq; karta bosilsa ishchi e'loni ochiladi", async ({ page, context }) => {
  const names = ["Aziza", "Bekzod", "Charos", "Doston"];
  const ids = names.map((_, i) => `7e2e0000-0000-4000-8000-0000000001a${i}`);
  const [n] = await sql<{ id: string; category_id: string }>("select id, category_id from public.profession_nodes where name_uz = 'Buxgalter' and selectable limit 1");
  const [r] = await sql<{ id: string }>("select id from public.regions where slug = 'tashkent_city'");
  for (const [i, id] of ids.entries()) {
    await sql(`insert into auth.users (id, phone, phone_confirmed_at, raw_user_meta_data) values ($1, $2, now(), json_build_object('first_name', $3::text)) on conflict (id) do nothing`, [id, `+99890777010${i}`, names[i]]);
    await sql("delete from public.worker_profiles where profile_id = $1", [id]);
    await sql(
      `insert into public.worker_profiles (profile_id, headline, about, region_id, profession_node_id, category_id, experience_level, onboarding_completed_at)
       values ($1, 'Buxgalter', 'Buxgalteriya, 1C, soliq hisobotlari, 5 yillik tajriba', $2, $3, $4, '3_5y', now())`,
      [id, r!.id, n!.id, n!.category_id],
    );
  }
  try {
    await loginAs(context, USERS.employer);
    await asMode(context, "employer");
    await page.goto(`/search?mode=workers&p=${n!.id}&region=all`);
    await expect(page.locator("main article").first()).toBeVisible();
    expect(await fullyVisible(page)).toBeGreaterThanOrEqual(3);
    expect(await maxCardHeight(page)).toBeLessThanOrEqual(200); // avval 382–476 px
    const card = page.locator("main article").filter({ hasText: "Charos" });
    await expect(card).toContainText("Buxgalter");
    await expect(card).toContainText("Tajriba: 3 yildan ko'p");
    await tap(page, card.getByText("3 yildan ko'p", { exact: true }));
    await page.waitForURL(/\/listing\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Charos");
  } finally {
    await sql("delete from public.worker_profiles where profile_id = any($1)", [ids]);
  }
});
