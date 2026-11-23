import { expect, test } from "@playwright/test";
import { USERS, asGuest, asMode, homeSearch, loginAs, sql } from "../support";

/**
 * E1/E3/R-C/S1 · ish izlovchi va ish beruvchi: rejim tanlanmagan mehmon — bosh sahifa (chat), maqsad yozilganidan aniqlanadi
 * (2026-11-21); keyin shu rejimning qidiruvi va e'loni; boshqa rejim e'loni — tasdiq bilan; "Yaqin atrofda" — joylashuvdan
 * eng yaqin tuman.
 */

// 2026-11-21 (ega, master prompt): pastki menyu ikkala rejimda bir xil — Qidiruv · E'lonlarim · Profil
const TABS = ["Qidiruv", "E'lonlarim", "Profil"];

test("mehmon (rejim tanlanmagan): bosh sahifa — chat; rejim almashtirgich yo'q; maqsad yozilganidan aniqlanib eslab qolinadi", async ({ page, context }) => {
  await asGuest(context);
  await page.goto("/");
  // 2026-11-21 (ega): bosh sahifa — chat; ikki yo'l kartalari va rejim almashtirgichi yo'q — AI maqsadni o'zi aniqlaydi
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ishingiz shu yerdan boshlanadi!");
  await expect(page.getByRole("radiogroup", { name: "Rejim" })).toHaveCount(0);
  // ko'rish rejim tanlovini o'zi yozmaydi
  expect((await context.cookies()).find((c) => c.name === "ib_mode")).toBeUndefined();
  // pastki menyu: Qidiruv · E'lonlarim · Profil
  const nav = page.getByRole("navigation").last();
  await expect(nav.getByRole("link")).toHaveText(TABS);
  await expect(nav.getByRole("link", { name: "Qidiruv" })).toHaveAttribute("href", "/chat");
  await expect(nav.getByRole("link", { name: "E'lonlarim" })).toHaveAttribute("href", "/cabinet/elonlar");
  await expect(nav.getByRole("link", { name: "Profil" })).toHaveAttribute("href", "/cabinet");

  await homeSearch(page, "Men sotuvchiman, ish kerak");
  await expect.poll(async () => (await context.cookies()).find((c) => c.name === "ib_mode")?.value).toBe("worker");
  // hudud qidiruv qatorida tanlangan ("Butun O'zbekiston") — savolsiz natija; pastdagi yozuv endi ish izlovchiniki
  await expect(page.locator("[data-guided-ai]").last()).toHaveAttribute("data-guided-ai", /^(results|none)$/, { timeout: 20_000 });
  await expect(page.locator("#start-chat-text")).toHaveAttribute("placeholder", "Masalan: men oshpazman");
  // keyingi ochilishda (yangi oyna — suhbat yangi) — ish izlovchining yozish maydoni (misol ko'rsatmasi rejimga mos)
  const fresh = await context.newPage();
  await fresh.goto("/chat");
  await expect(fresh.locator("#start-chat-text")).toHaveAttribute("placeholder", "Masalan: men oshpazman");
});

test("kirgan foydalanuvchi: almashtirgich yo'q (rol kirishda tanlangan); rol — Profildagi «Boshqa sozlamalar» ichida, bir bosishda", async ({ page, context }) => {
  // profili tayyor ish izlovchi (yangi foydalanuvchi emas — rol almashganda ro'yxatdan o'tish oqimiga tushmaydi)
  const RET = "7e2e0000-0000-4000-8000-000000000073";
  await sql(
    `insert into auth.users (id, phone, phone_confirmed_at, raw_user_meta_data) values ($1, '+998901110073', now(), '{"first_name":"Bobur","last_name":"Rolov"}')
     on conflict (id) do nothing`,
    [RET],
  );
  await sql("delete from public.worker_profiles where profile_id = $1", [RET]);
  await sql(
    `insert into public.worker_profiles (profile_id, headline, category_id, region_id, experience_level, onboarding_completed_at, is_public)
     select $1, 'Sotuvchi', c.id, r.id, '1_2y', now(), true from public.categories c, public.regions r where c.slug = 'sales' and r.slug = 'tashkent_city'`,
    [RET],
  );
  await sql("update public.profiles set active_role = 'worker' where id = $1", [RET]);
  try {
    await loginAs(context, RET);
    await asMode(context, "worker");
    // 2026-11-20: kirgan foydalanuvchining asosiy ekrani — chat
    await page.goto("/");
    await page.waitForURL(/\/chat$/);
    // bosh ekran: qidiruv qatori — ish izlovchiniki
    await expect(page.getByPlaceholder("Kasb: oshpaz, haydovchi…")).toBeVisible();
    await expect(page.getByRole("radiogroup", { name: "Rejim" })).toHaveCount(0);

    await page.goto("/cabinet");
    await expect(page.getByRole("radiogroup", { name: "Rejim" })).toHaveCount(0);
    // 2026-11-21: rol almashtirish — Profildagi "Boshqa sozlamalar" ichida
    await page.locator("main [data-fold='more'] [data-fold-toggle]").click();
    await page.locator("main [data-role-switch]").click();
    // 2026-11-18 (ega): butun ekranda ~3 s yumshoq katta yozuv — joriy tilda; o'zi yo'qoladi
    const splash = page.locator("[data-role-splash]");
    await expect(splash).toHaveAttribute("data-role-splash", "employer");
    await expect(splash).toHaveText("Siz ish beruvchi paneliga o'tdingiz");
    await page.waitForURL((u) => new URL(u).pathname === "/chat");
    // chat endi ishchilar qidiruvi bilan ochiladi (ish beruvchi rejimi)
    await expect(page.getByPlaceholder("Kim kerak: oshpaz, haydovchi…")).toBeVisible();
    await expect(splash).toHaveCount(0, { timeout: 6_000 });
    // ish beruvchi paneli — o'z rangida (to'q ko'k, K1; avval binafsha)
    await expect(page.locator("html")).toHaveAttribute("data-panel", "employer");
    const colors = await page.evaluate(() => {
      const cs = getComputedStyle(document.documentElement);
      return { primary: cs.getPropertyValue("--primary").trim(), employer: cs.getPropertyValue("--panel-employer").trim(), worker: cs.getPropertyValue("--panel-worker").trim() };
    });
    expect(colors.primary).toBe(colors.employer);
    expect(colors.primary).not.toBe(colors.worker);
    await expect(page.getByRole("radiogroup", { name: "Rejim" })).toHaveCount(0);
    expect((await context.cookies()).find((c) => c.name === "ib_mode")?.value).toBe("employer");
    const [after] = await sql<{ active_role: string }>("select active_role from public.profiles where id = $1", [RET]);
    expect(after!.active_role).toBe("employer");
  } finally {
    await sql("delete from public.worker_profiles where profile_id = $1", [RET]);
  }
});

test("ish izlovchi ishchilar qidiruviga (havola orqali) kirsa — to'siqsiz ochiladi", async ({ page, context }) => {
  await asGuest(context);
  await asMode(context, "worker");
  await page.goto("/search?mode=workers&any=1&region=all");
  await expect(page.getByRole("heading", { level: 1, name: "Bu bo'lim ish beruvchilar uchun" })).toHaveCount(0);
  await expect(page.locator("#mode-gate-title")).toHaveCount(0);
  // ish izlovchi menyusida "Ishchilar" yo'q (2026-11-20 kechqurun) — hech bir bo'lim belgilanmaydi
  await expect(page.getByRole("navigation").last().getByRole("link", { name: "Ishchilar" })).toHaveCount(0);
  // rejim o'zi almashmaydi (tanlov — foydalanuvchiniki)
  expect((await context.cookies()).find((c) => c.name === "ib_mode")?.value).toBe("worker");

  // "Qidirish" — "ish yoki ishchi?" so'ralmaydi, darhol shu rejim
  await page.goto("/search");
  await page.waitForURL(/\/search\?mode=jobs/);
});

test("e'lon berish: avval o'zini tasdiqlaydi; 'yo'q' — kerakli e'longa", async ({ page, context }) => {
  await asGuest(context);
  await page.goto("/post/vacancy");
  await expect(page.getByRole("heading", { level: 1, name: "Sizga xodim kerakmi?" })).toBeVisible();
  await expect(page.getByLabel("Kasb yoki sohani qidiring")).toHaveCount(0);
  await page.getByRole("button", { name: "Ha, menga xodim kerak" }).click();
  await expect(page.getByLabel("Kasb yoki sohani qidiring")).toBeVisible();

  // ish beruvchi o'zi haqida (ish izlovchi) e'lon ochsa — so'raladi
  await page.goto("/post/worker");
  await expect(page.getByRole("heading", { level: 1, name: "Siz ish qidiryapsizmi?" })).toBeVisible();
  await page.getByRole("button", { name: "Yo'q, menga xodim kerak" }).click();
  await page.waitForURL(/\/post\/vacancy$/);
  await expect(page.getByLabel("Kasb yoki sohani qidiring")).toBeVisible();
});

test("chat: rejim tanlangan bo'lsa — rol qayta so'ralmaydi, shu rejim ichida qidiradi (ish beruvchi — ishchilar)", async ({ page, context }) => {
  await asGuest(context);
  await asMode(context, "employer");
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ishingiz shu yerdan boshlanadi!");
  // bosh ekrandagi qidiruv qatori — ishchilar (hudud qatorda: "Butun O'zbekiston")
  await expect(page.getByRole("searchbox", { name: "Qanday ishchi kerak" })).toBeVisible();
  await homeSearch(page, "oshpaz");
  const res = page.locator("[data-guided-ai]").last();
  await expect(res).toHaveAttribute("data-guided-ai", /^(results|none)$/, { timeout: 20_000 });
  await expect(res).toContainText(/ta ishchi topdim|bunday ishchi topilmadi/);
  await expect(page.locator("[data-guided-roles]")).toHaveCount(0);
});

test.describe("yaqin atrofda", () => {
  const CHILONZOR = { latitude: 41.2753, longitude: 69.204 };
  test.beforeEach(async () => {
    await sql("delete from public.vacancies where owner_profile_id = $1", [USERS.employer]);
    await sql(
      `insert into public.vacancies (owner_profile_id, title, region_id, district_id, description, status, salary_from, salary_type, published_at, expires_at)
       select $1, 'Sotuvchi — Chilonzor bozori', r.id, d.id, 'Sinov e''loni: bozorda sotuvchi kerak, 9 dan 18 gacha', 'active', 3000000, 'monthly', now(), now() + interval '10 days'
       from public.regions r join public.districts d on d.region_id = r.id where r.slug = 'tashkent_city' and d.name_uz = 'Chilonzor tumani'`,
      [USERS.employer],
    );
  });
  test.afterEach(async () => {
    await sql("delete from public.vacancies where owner_profile_id = $1", [USERS.employer]);
  });

  test("«Yaqin atrofda» havolasidan: joylashuv → eng yaqin tuman, barcha kasblar; tuman eslab qolinadi", async ({ page, context }) => {
    await asGuest(context);
    await asMode(context, "worker");
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation(CHILONZOR);
    await page.goto("/search?mode=jobs&near=1");
    await expect(page.getByRole("heading", { level: 1, name: "Yaqin atrofdagi ishlarni ko'rsatamiz" })).toBeVisible();
    await page.getByRole("button", { name: "Joylashuvni aniqlash" }).click();
    await page.waitForURL(/region=tashkent_city&district=[0-9a-f-]{36}&any=1/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Barcha kasblar");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Chilonzor");
    await expect(page.locator("main article").filter({ hasText: "Sotuvchi — Chilonzor bozori" })).toHaveCount(1);
    expect((await context.cookies()).find((c) => c.name === "ib_place")?.value).toMatch(/^tashkent_city~[0-9a-f-]{36}$/);

    // ikkinchi marta — so'ramasdan darhol natijalar
    await page.goto("/search?mode=jobs&near=1");
    await page.waitForURL(/district=[0-9a-f-]{36}&any=1/);
    await expect(page.locator("main article").filter({ hasText: "Sotuvchi — Chilonzor bozori" })).toHaveCount(1);
  });

  test("viloyat qadamida 'Joylashuvim bo'yicha' va eslab qolingan hudud birinchi turadi", async ({ page, context }) => {
    await asGuest(context);
    await asMode(context, "worker");
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation(CHILONZOR);
    const [n] = await sql<{ id: string }>("select id from public.profession_nodes where name_uz = 'Buxgalter' and selectable limit 1");
    await page.goto(`/search?mode=jobs&p=${n!.id}`);
    await page.getByRole("button", { name: "Joylashuvim bo'yicha" }).click();
    await page.waitForURL(/region=tashkent_city&district=[0-9a-f-]{36}/);
    expect(new URL(page.url()).searchParams.get("p")).toBe(n!.id);
    await page.goto(`/search?mode=jobs&p=${n!.id}`);
    await expect(page.getByRole("link", { name: /Sizning hududingiz.*Chilonzor tumani/ })).toBeVisible();
  });
});
