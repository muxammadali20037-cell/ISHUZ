import { expect, test, type Page } from "@playwright/test";
import { USERS, asGuest, asMode, loginAs, sql } from "../support";

/**
 * E1/E3/R-C/S1 · ish izlovchi va ish beruvchi alohida: rejim tanlanmagan mehmon — bosh sahifa (maqsad), keyin faqat shu rejimning
 * oynalari, qidiruvi va e'loni; boshqa rejim bo'limi — tushuntirish va tasdiq bilan; "Yaqin atrofda" — joylashuvdan eng yaqin tuman.
 */

const windows = (page: Page) => page.getByRole("region", { name: "Tezkor bo'limlar" }).getByRole("link");
const modeRadio = (page: Page, name: string) => page.getByRole("radiogroup", { name: "Rejim" }).getByRole("radio", { name });

test("mehmon (rejim tanlanmagan): bosh sahifa — avval maqsad; 'Ish qidiraman' → faqat ish qidiruvchi bo'limlari", async ({ page, context }) => {
  await asGuest(context);
  await page.goto("/");
  // bosh sahifa: sarlavha, ikki aniq yo'l, shu yerning o'zida qidiruv va haqiqiy e'lonlar (rejim almashtirgich yo'q)
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("O'zingizga mos ishni toping yoki eng yaxshi xodimni toping!");
  await expect(page.getByRole("searchbox", { name: "Kasb yoki lavozim" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Yangi ishlar" })).toBeVisible();
  await expect(page.getByRole("radiogroup", { name: "Rejim" })).toHaveCount(0);
  // ko'rish rejim tanlovini o'zi yozmaydi (tanlov faqat foydalanuvchi bosganda)
  expect((await context.cookies()).find((c) => c.name === "ib_mode")).toBeUndefined();

  await page.getByRole("main").getByRole("button", { name: /^Ish qidiraman/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("O'zingizga mos ishni toping");
  await expect(modeRadio(page, "Ish izlovchi")).toHaveAttribute("aria-checked", "true");
  await expect(windows(page)).toHaveCount(3);
  await expect(windows(page).nth(0)).toContainText("Endi o'zingizga mos ish topish oson");
  await expect(windows(page).nth(1)).toContainText("Kunlik ishlar");
  await expect(windows(page).nth(2)).toContainText("Yaqin atrofdagi ishlar");
  // ishchi topish va vakansiya berish — ish izlovchiga ko'rsatilmaydi
  await expect(page.getByText("Endi xodim topish oson")).toHaveCount(0);
  await expect(page.locator("main a[href='/post/vacancy']")).toHaveCount(0);
  await expect(page.locator("main a[href='/post/worker']:visible").first()).toBeVisible();
  // pastki menyu (2026-10): Ishlar · Saqlangan · Arizalar · Profil (chat va bildirishnomalar — yuqori panelda)
  const nav = page.getByRole("navigation").last();
  await expect(nav.getByRole("link")).toHaveText(["Ishlar", "Saqlangan", "Arizalar", "Profil"]);
  await expect(nav.getByRole("link", { name: "Ishlar" })).toHaveAttribute("href", "/");
  await expect(nav.getByRole("link", { name: "Saqlangan" })).toHaveAttribute("href", "/saved");
  await expect(nav.getByRole("link", { name: "Arizalar" })).toHaveAttribute("href", "/applications");
  await expect(nav.getByRole("link", { name: "Profil" })).toHaveAttribute("href", "/cabinet");
  expect((await context.cookies()).find((c) => c.name === "ib_mode")?.value).toBe("worker");
});

test("rejim almashtirgich: tasdiqsiz almashmaydi; tasdiqlansa — ish beruvchi bo'limlari", async ({ page, context }) => {
  await asGuest(context);
  await asMode(context, "worker");
  await page.goto("/");
  await modeRadio(page, "Ish beruvchi").click();
  const dialog = page.getByRole("dialog", { name: "Ish beruvchi rejimiga o'tasizmi?" });
  await dialog.getByRole("button", { name: "Qolish" }).click();
  await expect(modeRadio(page, "Ish izlovchi")).toHaveAttribute("aria-checked", "true");

  await modeRadio(page, "Ish beruvchi").click();
  await dialog.getByRole("button", { name: "Ha, o'tish" }).click();
  await expect(modeRadio(page, "Ish beruvchi")).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Xodim toping");
  await expect(windows(page).nth(0)).toContainText("Endi xodim topish oson");
  await expect(page.getByText("Endi o'zingizga mos ish topish oson")).toHaveCount(0);
  await expect(page.getByRole("main").getByRole("link", { name: "Vakansiya joylash", exact: true })).toBeVisible();
  expect((await context.cookies()).find((c) => c.name === "ib_mode")?.value).toBe("employer");
  // ish beruvchi menyusi (2026-10): Boshqaruv · Vakansiyalar · Nomzodlar · Profil
  await expect(page.getByRole("navigation").last().getByRole("link")).toHaveText(["Boshqaruv", "Vakansiyalar", "Nomzodlar", "Profil"]);
  await expect(page.getByRole("navigation").last().getByRole("link", { name: "Nomzodlar" })).toHaveAttribute("href", "/search?mode=workers");
});

test("kirgan foydalanuvchi: almashtirgich yo'q (rol kirishda tanlangan); rol — Kabinetim → 'Rolni o'zgartirish' → o'sha rol ekrani", async ({ page, context }) => {
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
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("O'zingizga mos ishni toping");
    await expect(page.getByRole("radiogroup", { name: "Rejim" })).toHaveCount(0);

    await page.goto("/cabinet");
    await expect(page.getByRole("radiogroup", { name: "Rejim" })).toHaveCount(0);
    await page.getByRole("link", { name: "Rolni o'zgartirish" }).click();
    await page.waitForURL("**/start/rol?next=%2F");
    await expect(page.getByRole("radio", { name: /Ish qidiryapman/ })).toBeChecked();
    await page.getByText("Ishchi qidiryapman", { exact: true }).click();
    await page.getByRole("button", { name: "Davom etish" }).click();
    await page.waitForURL((u) => new URL(u).pathname === "/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Xodim toping");
    await expect(page.getByRole("radiogroup", { name: "Rejim" })).toHaveCount(0);
    expect((await context.cookies()).find((c) => c.name === "ib_mode")?.value).toBe("employer");
    const [after] = await sql<{ active_role: string }>("select active_role from public.profiles where id = $1", [RET]);
    expect(after!.active_role).toBe("employer");
  } finally {
    await sql("delete from public.worker_profiles where profile_id = $1", [RET]);
  }
});

test("ish izlovchi ishchilar qidiruviga kirsa — tushuntirish; 'qaytish' o'z bo'limiga, 'o'tish' — rejim almashadi", async ({ page, context }) => {
  await asGuest(context);
  await asMode(context, "worker");
  await page.goto("/search?mode=workers");
  await expect(page.getByRole("heading", { level: 1, name: "Bu bo'lim ish beruvchilar uchun" })).toBeVisible();
  await page.getByRole("link", { name: "Ish e'lonlariga qaytish" }).click();
  await page.waitForURL(/\/search\?mode=jobs/);

  // "Qidirish" — "ish yoki ishchi?" so'ralmaydi, darhol shu rejim
  await page.goto("/search");
  await page.waitForURL(/\/search\?mode=jobs/);

  await page.goto("/search?mode=workers");
  await page.getByRole("button", { name: "Men xodim qidiryapman — o'tish" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Bu bo'lim ish beruvchilar uchun" })).toHaveCount(0);
  await expect(page.getByText("Ishchi qidiraman").first()).toBeVisible();
  expect((await context.cookies()).find((c) => c.name === "ib_mode")?.value).toBe("employer");
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

test("AI qidiruv: rejim tanlangan bo'lsa — faqat shu rejim ichida qidiradi", async ({ page, context }) => {
  await asGuest(context);
  await asMode(context, "employer");
  await page.goto("/");
  await page.getByRole("button", { name: "AI bilan qidirish" }).click();
  const dialog = page.getByRole("dialog", { name: "O'zingizga mosini toping" });
  await expect(dialog.getByText("Ishchilar ichidan qidiriladi")).toBeVisible();
  await expect(dialog.getByRole("radio")).toHaveCount(0);
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

  test("bosh sahifadan: joylashuv → eng yaqin tuman, barcha kasblar; tuman eslab qolinadi", async ({ page, context }) => {
    await asGuest(context);
    await asMode(context, "worker");
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation(CHILONZOR);
    await page.goto("/");
    await windows(page).filter({ hasText: "Yaqin atrofdagi ishlar" }).click();
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
