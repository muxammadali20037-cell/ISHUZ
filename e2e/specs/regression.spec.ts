import { expect, test, type Page } from "@playwright/test";
import { USERS, asGuest, loginAs, sql, stack } from "../support";

/**
 * C8.10 · regressiya: qabul mezonlari #26 (eski javob yangi holatni bosmaydi), #27 (tarmoq/limit — tugma qotmaydi),
 * #31 (ruscha uzun matn, katta shrift, uzun kasb nomi — layout buzilmaydi) va hudud yorlig'i (shahar ≠ viloyat).
 */

const host = new URL(stack.app).hostname;

async function nodeId(name: string) {
  const [r] = await sql<{ id: string }>("select id from public.profession_nodes where name_uz = $1 and selectable limit 1", [name]);
  return r!.id;
}

async function regionId(slug: string) {
  const [r] = await sql<{ id: string }>("select id from public.regions where slug = $1", [slug]);
  return r!.id;
}

async function vacancy(opts: { profession: string; region: string; title?: string; custom?: string }) {
  const [v] = await sql<{ slug: string }>(
    `insert into public.vacancies (owner_profile_id, title, region_id, description, status, profession_node_id, custom_profession, salary_negotiable, published_at, expires_at)
     values ($1, $2, $3, 'Sinov e''loni: ish joyi tavsifi, grafik va shartlar', 'active', $4, $5, true, now(), now() + interval '10 days') returning slug`,
    [USERS.employer, opts.title ?? opts.profession, await regionId(opts.region), await nodeId(opts.profession), opts.custom ?? null],
  );
  return v!.slug;
}

const noSideScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

test.beforeEach(async () => {
  await sql("delete from public.vacancies where owner_profile_id = $1", [USERS.employer]);
});
test.afterEach(async () => {
  await sql("delete from public.vacancies where owner_profile_id = $1", [USERS.employer]);
  await sql("delete from public.worker_profiles where profile_id = $1", [USERS.workerB]);
  await sql("update public.app_settings set value = '30'::jsonb where key = 'application_daily_limit'");
});

test("hudud: Toshkent shahri — «Butun shahar», viloyat — «Butun viloyat» (qidiruv va karta)", async ({ page, context }) => {
  await vacancy({ profession: "Buxgalter", region: "tashkent_city" });
  await asGuest(context);
  const p = await nodeId("Buxgalter");
  await page.goto(`/search?mode=jobs&p=${p}&region=tashkent_city`);
  await expect(page.getByRole("link", { name: /^Butun shahar/ })).toContainText("Shaharning istalgan joyi");
  await expect(page.getByRole("link", { name: /^Butun viloyat/ })).toHaveCount(0);
  await page.getByRole("link", { name: /^Butun shahar/ }).click();
  await expect(page.locator("main article").first()).toContainText("Toshkent shahri · Butun shahar");
  await page.goto(`/search?mode=jobs&p=${p}&region=samarkand`);
  await expect(page.getByRole("link", { name: /^Butun viloyat/ })).toBeVisible();
});

test("#26: Orqaga/Oldinga — kechikkan eski javob yangi natijani bosmaydi", async ({ page, context }) => {
  await vacancy({ profession: "Buxgalter", region: "tashkent_city" });
  await vacancy({ profession: "Oshpaz", region: "tashkent_city" });
  await asGuest(context);
  const a = await nodeId("Buxgalter");
  const b = await nodeId("Oshpaz");
  const results = (id: string) => `/search?mode=jobs&p=${id}&region=all`;
  await page.goto(results(a));
  await expect(page.locator("main article").first()).toContainText("Buxgalter");
  // ikkinchi qidiruvga ilova ichida o'tish (sahifani to'liq qayta yuklamasdan)
  await page.getByRole("button", { name: "O'zgartirish" }).click();
  await page.getByRole("dialog").getByRole("link", { name: "Kasbni o'zgartirish" }).click();
  await page.getByLabel("Kasb yoki sohani qidiring").fill("Oshpaz");
  await page.getByRole("button").filter({ has: page.getByText("Oshpaz", { exact: true }) }).filter({ hasText: "Tanlash" }).first().click();
  await page.waitForURL((u) => u.searchParams.get("p") === b);
  await expect(page.locator("main article").first()).toContainText("Oshpaz");

  // eski (Buxgalter) natijasi uchun server javobi 1,5 s kechiktiriladi: Orqaga → darhol Oldinga
  await page.route(`**/search?**p=${a}**`, async (route) => {
    await new Promise((r) => setTimeout(r, 1500));
    await route.continue().catch(() => {});
  });
  await page.goBack();
  await page.goForward();
  await page.waitForTimeout(2500);
  expect(new URL(page.url()).searchParams.get("p")).toBe(b);
  await expect(page.locator("main article").first()).toContainText("Oshpaz");
  await expect(page.locator("main article").filter({ hasText: "Buxgalter" })).toHaveCount(0);
});

test.describe("#27: ariza yuborish — tarmoq uzilishi va kunlik limit", () => {
  async function workerReady() {
    const [n] = await sql<{ id: string }>("select id from public.profession_nodes where name_uz = 'Buxgalter' and selectable limit 1");
    await sql("delete from public.worker_profiles where profile_id = $1", [USERS.workerB]);
    await sql(
      `insert into public.worker_profiles (profile_id, headline, region_id, profession_node_id, experience_level, onboarding_completed_at)
       values ($1, 'Buxgalter', $2, $3, '3_5y', now())`,
      [USERS.workerB, await regionId("tashkent_city"), n!.id],
    );
  }

  test("tarmoq uzilsa: aniq xato, tugma qayta ishlaydi, xabar matni joyida", async ({ page, context }) => {
    const slug = await vacancy({ profession: "Buxgalter", region: "tashkent_city" });
    await workerReady();
    await loginAs(context, USERS.workerB);
    await page.goto(`/jobs/${slug}`);
    await page.getByRole("button", { name: "Ariza yuborish" }).last().click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel(/Qisqacha xabar/).fill("Assalomu alaykum! Tajribam 4 yil.");
    // server action so'rovi (POST, Next-Action sarlavhasi) uziladi
    await page.route(`**/jobs/${slug}`, (route) => (route.request().method() === "POST" ? route.abort("internetdisconnected") : route.continue()));
    await dialog.getByRole("button", { name: "Ariza yuborish" }).click();
    await expect(page.getByText("Internet bilan aloqa yo'q. Ulanishni tekshiring.")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Ariza yuborish" })).toBeEnabled();
    await expect(dialog.getByLabel(/Qisqacha xabar/)).toHaveValue("Assalomu alaykum! Tajribam 4 yil.");
    // internet qaytdi — o'sha tugma bilan yuboriladi, bitta ariza
    await page.unroute(`**/jobs/${slug}`);
    await dialog.getByRole("button", { name: "Ariza yuborish" }).click();
    await expect(dialog.getByText("Ariza yuborildi").first()).toBeVisible();
    const rows = await sql("select 1 from public.applications a join public.vacancies v on v.id = a.vacancy_id where v.slug = $1", [slug]);
    expect(rows).toHaveLength(1);
  });

  test("kunlik limit (429 o'rniga rate_limited): tushunarli xabar, cheksiz kutish yo'q", async ({ page, context }) => {
    const slug = await vacancy({ profession: "Buxgalter", region: "tashkent_city" });
    await workerReady();
    await sql("update public.app_settings set value = '0'::jsonb where key = 'application_daily_limit'");
    await loginAs(context, USERS.workerB);
    await page.goto(`/jobs/${slug}`);
    await page.getByRole("button", { name: "Ariza yuborish" }).last().click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Ariza yuborish" }).click();
    await expect(page.getByText("Bugungi arizalar limiti tugadi. Ertaga qayta urinib ko'ring.")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Ariza yuborish" })).toBeEnabled();
  });
});

test("#31: ruscha, 150% shrift, uzun kasb nomi — asosiy sahifalar yonga siljimaydi", async ({ page, context }) => {
  const longTitle = "Старший бухгалтер по налоговому учёту и международной финансовой отчётности (МСФО)";
  const slug = await vacancy({ profession: "Buxgalter", region: "tashkent_city", title: longTitle, custom: "Бухгалтер-аналитик по трансфертному ценообразованию" });
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      document.documentElement.style.fontSize = "150%";
    });
  });
  await loginAs(context, USERS.employer);
  await context.addCookies([{ name: "ishuz_locale", value: "ru", domain: host, path: "/" }]);
  const p = await nodeId("Buxgalter");
  for (const path of ["/", `/search?mode=jobs&p=${p}&region=all`, `/jobs/${slug}`, "/post/worker", "/cabinet", "/settings", "/help"]) {
    await page.goto(path);
    await expect(page.locator("main").first()).toBeVisible();
    // 404 ekrani ham "main" — sahifa haqiqatan ochilganini tekshiramiz (kirill slug avval 404 edi)
    await expect(page.getByRole("heading", { name: "Страница не найдена" })).toHaveCount(0);
    if (path.startsWith("/jobs/")) await expect(page.getByRole("heading", { level: 1 })).toContainText("Старший бухгалтер");
    await expect.poll(() => noSideScroll(page), { message: path }).toBe(true);
  }
});
