import { expect, test } from "@playwright/test";
import { USERS, asGuest, asMode, sql } from "../support";

/**
 * 2.0 (2026-11-11, egasi: "AI bilan qidirganda tushunsin, bazadan topsin, «yo'q» deb o'tirmasin"):
 *  - bosh sahifada BITTA qidiruv maydoni: yozilgan matn darhol yordamchiga yuboriladi, bosqichlarsiz natija;
 *  - aniq so'rov bo'sh chiqsa — qidiruv birma-bir kengaytiriladi (tuman → viloyat → butun O'zbekiston) va bu ochiq aytiladi;
 *  - kasblar ro'yxatida yo'q so'z (do'kon yoki kompaniya nomi, erkin lavozim) — e'lon matnlaridan qidiriladi va qaysi so'z
 *    bo'yicha topilgani aytiladi;
 *  - umuman yo'q bo'lsa — halol javob va keyingi qadam: yozgan matni tayyor turgan Telegram xabari, o'zi e'lon berishi;
 *  - sekin telefon: sahifa skriptlari yuklanmasdan "Topish" bosilsa ham boshi berk yo'q — matn /ai?q=… sahifasiga boradi va
 *    savol o'sha yerda o'zi yuboriladi.
 */

const TITLE = "Oshpaz — Samarqand (AI kengaytirish)";

async function seed() {
  await sql("delete from public.vacancies where title = $1", [TITLE]);
  await sql(
    `insert into public.employer_profiles (profile_id, employer_type, display_name, onboarding_completed_at)
     values ($1, 'person', 'Dilnoza opa', now()) on conflict (profile_id) do nothing`,
    [USERS.employer],
  );
  await sql(
    `insert into public.vacancies (owner_profile_id, title, region_id, category_id, profession_node_id, description, status, salary_from, salary_type, published_at, expires_at)
     select $1, $2, r.id, c.id, n.id, 'Milliy taomlar oshpazi kerak, smena 2/2, ovqat bilan. Tajriba 1 yildan.', 'active', 5000000, 'monthly', now(), now() + interval '10 days'
     from public.regions r
     cross join (select id from public.categories where slug = 'restaurant') c
     cross join (select id from public.profession_nodes where name_uz = 'Oshpaz' and selectable order by depth limit 1) n
     where r.slug = 'samarkand'`,
    [USERS.employer, TITLE],
  );
}

// boshqa spec'lardan qolgan sinov e'lonlari natijaga aralashmasin (shu ish beruvchining e'lonlari har testda tozalanadi)
test.beforeEach(async () => {
  await sql("delete from public.vacancies where owner_profile_id = $1", [USERS.employer]);
});
test.afterAll(async () => {
  await sql("delete from public.vacancies where owner_profile_id = $1", [USERS.employer]);
});

async function ask(page: import("@playwright/test").Page, text: string) {
  await page.goto("/");
  // [data-hydrated] — skriptlar yuklangan: natija shu sahifadagi oynada (undan oldin yuborilsa — /ai sahifasida, pastdagi test)
  const field = page.locator("form[data-ai-field][data-hydrated] input[name='q']");
  await expect(field).toBeVisible();
  await field.fill(text);
  await field.press("Enter");
  return page.getByRole("dialog");
}

test("bosh sahifa: bitta qidiruv maydoni, nol ko'rsatkich va fon surati yo'q", async ({ page, context }) => {
  await asGuest(context);
  await asMode(context, "worker");
  await page.goto("/");
  const hero = page.locator("[data-home='seeker-v2']");
  await expect(hero.getByRole("heading", { level: 1 })).toHaveText("Qanday ish qidiryapsiz?");
  await expect(hero.locator("form[data-ai-field]")).toHaveCount(1);
  await expect(hero.locator("input[type='search']")).toHaveCount(1);
  await expect(hero.locator("img")).toHaveCount(0);
  // 4 ta tez yo'l, har biri ishlaydigan havola
  await expect(hero.getByRole("navigation").getByRole("listitem")).toHaveCount(4);
});

test("Chilonzorda oshpaz → tumanda ham, Toshkentda ham yo'q → butun O'zbekistondan topadi va buni aytadi", async ({ page, context }) => {
  await seed();
  try {
    await asGuest(context);
    await asMode(context, "worker");
    const dialog = await ask(page, "Chilonzorda oshpaz ish kerak");
    const notes = dialog.locator("[data-ai-relaxed]");
    await expect(notes).toBeVisible({ timeout: 20_000 });
    await expect(notes).toContainText("butun O'zbekiston bo'yicha ko'rsatildi");
    await expect(dialog.getByText(TITLE).first()).toBeVisible();
    await expect(dialog.locator("[data-ai-empty-actions]")).toHaveCount(0);
    // aynan so'ralgani (Chilonzorda) yo'q edi — o'shanaqasi chiqsa xabar olish taklifi, yozgan matni bilan
    await expect(dialog.locator("[data-ai-relaxed-alert]")).toHaveAttribute("href", /\/ai-alerts\?role=worker&q=Chilonzorda\+oshpaz\+ish\+kerak/);
  } finally {
    await sql("delete from public.vacancies where title = $1", [TITLE]);
  }
});

const BRAND_TITLE = "Sotuvchi — Yulduzcha supermarketi";

test("kasblar ro'yxatida yo'q so'z (do'kon nomi) → e'lon matnlaridan topadi va qaysi so'z bo'yicha topganini aytadi", async ({ page, context }) => {
  await sql("delete from public.vacancies where title = $1", [BRAND_TITLE]);
  await sql(
    `insert into public.vacancies (owner_profile_id, title, region_id, description, status, salary_from, salary_type, published_at, expires_at)
     select $1, $2, r.id, 'Yangi ochilgan do''konga sotuvchilar kerak. Smena 2/2, tushlik bepul.', 'active', 4000000, 'monthly', now(), now() + interval '10 days'
     from public.regions r where r.slug = 'samarkand'`,
    [USERS.employer, BRAND_TITLE],
  );
  try {
    await asGuest(context);
    await asMode(context, "worker");
    // kasb ham, hudud ham aytilmagan: "yulduzcha" — kasb emas, do'kon nomi
    let dialog = await ask(page, "yulduzchaga ishga kirmoqchiman");
    await expect(dialog.locator("[data-ai-relaxed]")).toContainText("«yulduzcha» so'zi bo'yicha e'lon matnlaridan topdim", { timeout: 20_000 });
    await expect(dialog.getByText(BRAND_TITLE).first()).toBeVisible();
    await expect(dialog.getByText("Kasbni aniqlay olmadim")).toHaveCount(0);
    await expect(dialog.locator("[data-ai-empty-actions]")).toHaveCount(0);

    // hudud aytilgan, u yerda yo'q: butun O'zbekistondan topiladi — ikkalasi ham aytiladi
    dialog = await ask(page, "Toshkentda yulduzchaga ishga kirmoqchiman");
    // oldingi javob ixchamlashadi: to'liq natijalar havolasi — o'sha so'z bo'yicha matnli qidiruv
    await expect(dialog.getByRole("link", { name: "Natijalarni ochish" }).first()).toHaveAttribute("href", /\/search\?mode=jobs&q=yulduzcha&region=all/);
    const notes = dialog.locator("[data-ai-relaxed]").last();
    await expect(notes).toContainText("e'lon matnlaridan topdim", { timeout: 20_000 });
    await expect(notes).toContainText("butun O'zbekiston bo'yicha ko'rsatildi");
    await expect(dialog.getByText(BRAND_TITLE).first()).toBeVisible();
  } finally {
    await sql("delete from public.vacancies where title = $1", [BRAND_TITLE]);
  }
});

test("umuman yo'q → halol javob, yozgan matni bilan Telegram xabari va o'zi e'lon berish", async ({ page, context }) => {
  await asGuest(context);
  await asMode(context, "worker");
  const dialog = await ask(page, "Toshkentda kosmonavt kerak");
  const actions = dialog.locator("[data-ai-empty-actions]");
  await expect(actions).toBeVisible({ timeout: 20_000 });
  const alert = actions.getByRole("link", { name: "Yangisi chiqsa xabar olish" });
  await expect(alert).toHaveAttribute("href", /\/ai-alerts\?role=worker&q=Toshkentda\+kosmonavt\+kerak/);
  await expect(actions.getByRole("link", { name: "O'zim haqimda e'lon berish" })).toHaveAttribute("href", "/post/worker");
});

test("Telegram xabari sahifasi yozilgan matnni tayyor ko'rsatadi", async ({ page, context }) => {
  const { loginAs } = await import("../support");
  await loginAs(context, USERS.workerB);
  await page.goto("/ai-alerts?role=worker&q=Toshkentda%20kosmonavt%20kerak");
  await expect(page.locator("textarea").first()).toHaveValue("Toshkentda kosmonavt kerak");
});

test("skriptlar yuklanmasdan yuborilsa: forma /ai?q=… ga boradi (sahifa shunchaki qayta ochilib qolmaydi)", async ({ page, context }) => {
  await asGuest(context);
  await asMode(context, "worker");
  // "sahifa ko'rindi, lekin hali jonlanmagan" holati: ilova skriptlari (chunk'lar) yuklanmaydi — sahifa matni oqim bilan keladi
  await page.route("**/_next/static/chunks/**", (route) => route.abort());
  await page.goto("/");
  const form = page.locator("form[data-ai-field]");
  await expect(form).toBeVisible();
  await expect(form).not.toHaveAttribute("data-hydrated", "");
  await expect(form).toHaveAttribute("action", "/ai");
  await form.locator("input[name='q']").fill("Samarqandda oshpaz");
  await form.getByRole("button", { name: "Topish" }).click();
  await page.waitForURL((u) => new URL(u).pathname === "/ai" && new URL(u).searchParams.get("q") === "Samarqandda oshpaz");
});

test("/ai?q=… — savol o'zi yuboriladi, natija shu sahifada; manzildan q olib tashlanadi (yangilansa qayta yuborilmaydi)", async ({ page, context }) => {
  await seed();
  try {
    await asGuest(context);
    await asMode(context, "worker");
    await page.goto("/ai?q=Samarqandda%20oshpaz");
    const main = page.getByRole("main");
    await expect(main.getByText("Siz: Samarqandda oshpaz")).toBeVisible();
    await expect(main.locator("article").filter({ hasText: TITLE })).toHaveCount(1);
    await expect(page).toHaveURL(/\/ai$/);
    await page.reload();
    // suhbat qurilmada saqlangan — savol bitta (qayta yuborilmagan)
    await expect(main.getByText("Siz: Samarqandda oshpaz")).toHaveCount(1);
  } finally {
    await sql("delete from public.vacancies where title = $1", [TITLE]);
  }
});
