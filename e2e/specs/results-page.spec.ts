import { expect, test } from "@playwright/test";
import { USERS, asGuest, asMode, loginAs, sql } from "../support";

/**
 * J1 · natijalar sahifasi (ishgo uslubi, o'z tizimimizda): tepada qidiruv qatori va "Filtr", ostida qisqa xulosa,
 * soni va "O'zgartirish"; kompyuterda o'ng panel — "e'lon berish", statistika, yirik ish beruvchilar.
 */

let companyId: string | null = null;

test.beforeEach(async () => {
  await sql("delete from public.vacancies where owner_profile_id = $1", [USERS.employer]);
  await sql("delete from public.companies where name = 'J1 Restoran MChJ'");
  const [c] = await sql<{ id: string }>("insert into public.companies (name, created_by) values ('J1 Restoran MChJ', $1) returning id", [USERS.employer]);
  companyId = c!.id;
  for (const [title, prof] of [["Oshpaz (J1)", "Oshpaz"], ["Ofitsiant (J1)", "Ofitsiant"], ["Kassir (J1)", "Kassir"]] as const) {
    await sql(
      `insert into public.vacancies (owner_profile_id, company_id, title, region_id, district_id, description, status, profession_node_id, salary_from, salary_type, published_at, expires_at)
       select $1, $2, $3, r.id, d.id, 'Sinov e''loni: ' || $3 || ', 9 dan 18 gacha, tushlik bepul', 'active', n.id, 4000000, 'monthly', now(), now() + interval '10 days'
       from public.regions r join public.districts d on d.region_id = r.id and d.name_uz = 'Chilonzor tumani'
       left join lateral (select id from public.profession_nodes where name_uz = $4 and selectable limit 1) n on true
       where r.slug = 'tashkent_city'`,
      [USERS.employer, companyId, title, prof],
    );
  }
});
test.afterEach(async () => {
  await sql("delete from public.vacancies where owner_profile_id = $1", [USERS.employer]);
  if (companyId) await sql("delete from public.companies where id = $1", [companyId]);
});

test("telefon: qidiruv qatori → kasb aniqlanadi, hudud saqlanadi; o'ng panel ko'rinmaydi", async ({ page, context }) => {
  await asGuest(context);
  await asMode(context, "worker");
  await page.goto("/search?mode=jobs&any=1&region=tashkent_city&district=all");
  const main = page.getByRole("main");
  const search = main.getByRole("searchbox", { name: "Qidirish" });
  await expect(search).toHaveAttribute("placeholder", "Kasb yoki lavozim qidirish");
  await expect(main.getByRole("button", { name: "Filtr" })).toBeVisible();
  await expect(main.getByRole("heading", { level: 1 })).toHaveText("Ish e'lonlari: Barcha kasblar · Toshkent shahri · Butun shahar");
  await expect(main.getByText("3 ta e'lon topildi")).toBeVisible();
  await expect(main.getByRole("button", { name: "O'zgartirish" })).toBeVisible();
  // qidiruv qatori birinchi ekranning eng tepasida, birinchi karta undan keyin
  const box = (await search.boundingBox())!;
  expect(box.y).toBeLessThan(120);
  expect((await main.locator("article").first().boundingBox())!.y).toBeLessThan(260);
  // o'ng panel — faqat kompyuterda
  await expect(page.getByRole("complementary", { name: "Statistika" })).toBeHidden();

  // yuborish sahifani qayta yuklamaydi (mijoz routeri): matn → kasb yo'naltirishi ham hujjat so'rovisiz
  const docs: string[] = [];
  page.on("request", (r) => {
    if (r.isNavigationRequest() && r.frame() === page.mainFrame()) docs.push(r.url());
  });
  await search.fill("Oshpaz");
  await search.press("Enter");
  await page.waitForURL((u) => !!u.searchParams.get("p") && u.searchParams.get("region") === "tashkent_city");
  await expect(main.getByRole("heading", { level: 1 })).toHaveText("Ish e'lonlari: Oshpaz · Toshkent shahri · Butun shahar");
  await expect(main.getByRole("searchbox", { name: "Qidirish" })).toHaveValue("Oshpaz");
  await expect(main.locator("article")).toHaveCount(1);
  await expect(main.locator("article").first()).toContainText("Oshpaz (J1)");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  expect(docs).toEqual([]);
});

test("rejim tanlangan: /search — darhol 307 (oqimdagi <meta> emas), sahifa bir marta yuklanadi; kirganda ham", async ({ page, context }) => {
  const docs: string[] = [];
  page.on("request", (r) => {
    if (r.isNavigationRequest() && r.frame() === page.mainFrame()) docs.push(new URL(r.url()).pathname + new URL(r.url()).search);
  });
  for (const signedIn of [false, true]) {
    await asGuest(context);
    await asMode(context, "worker");
    if (signedIn) await loginAs(context, USERS.workerB);
    const r = await context.request.get("/search?region=tashkent_city", { maxRedirects: 0 });
    expect(r.status()).toBe(307);
    expect(r.headers().location).toBe("/search?mode=jobs&region=tashkent_city");

    docs.length = 0;
    const res = await page.goto("/search");
    // goto javobi — yo'naltirilgan manzilniki (oldin: /search 200, yo'naltirish keyin <meta> bilan)
    expect(res!.url()).toMatch(/\/search\?mode=jobs$/);
    expect(res!.request().redirectedFrom()?.url()).toMatch(/\/search$/);
    await expect(page).toHaveURL(/\/search\?mode=jobs$/);
    await expect(page.getByRole("main")).toBeVisible();
    // darhol boshqa sahifaga o'tish bekor bo'lmaydi; oraliqda qayta yuklash yo'q (307 → manzil → /help)
    await page.goto("/help");
    await expect(page).toHaveURL(/\/help$/);
    expect(docs).toEqual(["/search", "/search?mode=jobs", "/help"]);
  }
});

test("kompyuter: o'ng panel — e'lon berish, statistika, yirik ish beruvchilar (rejimga mos)", async ({ page, context }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await asGuest(context);
  await asMode(context, "worker");
  await page.goto("/search?mode=jobs&any=1&region=all");
  const aside = page.getByRole("complementary", { name: "Statistika" });
  await expect(aside).toBeVisible();
  await expect(aside.getByRole("link", { name: "Rezyume joylash" })).toHaveAttribute("href", "/post/worker");
  const stats = aside.locator("dl");
  for (const label of ["Ish o'rinlari", "Rezyumelar", "Kompaniyalar"]) await expect(stats.locator("dt", { hasText: label })).toBeVisible();
  // statistika qidiruvdagi son bilan bir xil
  const found = await page.getByRole("main").getByText(/ta e'lon topildi$/).first().textContent();
  const jobs = await stats.locator("div", { has: page.locator("dt", { hasText: "Ish o'rinlari" }) }).locator("dd").textContent();
  expect(Number(jobs!.replace(/\D/g, ""))).toBe(Number(found!.replace(/\D/g, "")));
  // yirik ish beruvchilar: kompaniya va uning faol ish o'rinlari soni (aniq)
  const company = aside.getByRole("link", { name: /J1 Restoran MChJ/ });
  await expect(company).toContainText("Ish o'rinlari: 3");
  await expect(company).toHaveAttribute("href", /^\/company\//);
  // ro'yxat bitta ustunda (ishgo kabi), yonga siljimaydi
  const cards = page.getByRole("main").locator("article");
  const [a, b] = [(await cards.nth(0).boundingBox())!, (await cards.nth(1).boundingBox())!];
  expect(b.x).toBe(a.x);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(1280);

  // ish beruvchi rejimida — "Vakansiya joylashtirish"
  await loginAs(context, USERS.employer);
  await asMode(context, "employer");
  await page.goto("/search?mode=workers&any=1&region=all");
  await expect(page.getByRole("complementary", { name: "Statistika" }).getByRole("link", { name: "Vakansiya joylashtirish" })).toHaveAttribute("href", "/post/vacancy");
});

test("faol filtrlar (R-C): har biri alohida olib tashlanadi, 'Hammasini tozalash' — barchasi; sarlavhada takrorlanmaydi", async ({ page, context }) => {
  await asGuest(context);
  await asMode(context, "worker");
  const url = "/search?mode=jobs&any=1&region=tashkent_city&district=all&salary=3000000&noexp=1";
  await page.goto(url);
  const group = page.getByRole("group", { name: "Faol filtrlar" });
  await expect(group.getByRole("link", { name: /^Filtrni olib tashlash/ })).toHaveCount(2);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ish e'lonlari: Barcha kasblar · Toshkent shahri · Butun shahar");
  await expect(page.locator("main article")).toHaveCount(3);

  // bittasi: faqat maosh olib tashlanadi, "tajribasiz" qoladi
  await group.getByRole("link", { name: "Filtrni olib tashlash: 3 mln so'mdan yuqori" }).click();
  await page.waitForURL((u) => !new URL(u).searchParams.has("salary"));
  expect(new URL(page.url()).searchParams.get("noexp")).toBe("1");
  await expect(group.getByRole("link", { name: /^Filtrni olib tashlash/ })).toHaveCount(1);
  await expect(group.getByRole("link", { name: "Hammasini tozalash" })).toHaveCount(0);

  // hammasi: kasb va hudud saqlanadi
  await page.goto(url);
  await group.getByRole("link", { name: "Hammasini tozalash" }).click();
  await page.waitForURL((u) => {
    const p = new URL(u).searchParams;
    return !p.has("salary") && !p.has("noexp");
  });
  await expect(group).toHaveCount(0);
  const p = new URL(page.url()).searchParams;
  expect([p.get("any"), p.get("region"), p.get("district")]).toEqual(["1", "tashkent_city", "all"]);
  await expect(page.locator("main article")).toHaveCount(3);
});
