import { expect, test } from "@playwright/test";
import { USERS, asGuest, asMode, quickSearch, sql } from "../support";

/**
 * 2.0 (2026-11-11, egasi: "AI bilan qidirganda tushunsin, bazadan topsin, «yo'q» deb o'tirmasin"):
 *  - 2026-11-21: bosh sahifa — chat (guided-chat.spec.ts); "Yordamchi" oynasi (so'rovnoma bilan) — /ai sahifasida;
 *  - 2026-11-16 (ega: "AI uzun matn yozmasin"): yozilgandan keyin so'rovnoma oynasi (kasb, hudud, maosh) va "Qidirish";
 *  - aniq so'rov bo'sh chiqsa — bitta qisqa "Hozircha bunday ish yo'q" (mehmonga — "kirsangiz, xabar beramiz") va pastda
 *    "Shunga yaqin ishlar" (yaqin kasblar yoki shu kasb boshqa hududlarda);
 *  - kasblar ro'yxatida yo'q so'z (do'kon yoki kompaniya nomi, erkin lavozim) — e'lon matnlaridan qidiriladi;
 *  - sekin telefon: bosh sahifa chatida skriptlar yuklanmasdan yuborilsa ham boshi berk yo'q — matn /?q=… bilan qaytadi va
 *    yuklangach o'zi yuboriladi; /ai?q=… — o'sha yerda.
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
  // 2026-11-21: bosh sahifa — chat (guided-chat.spec.ts); "Yordamchi" (so'rovnoma oynasi bilan) — /ai sahifasida
  await page.goto("/ai");
  // [data-hydrated] — skriptlar yuklangan
  const field = page.locator("form[data-hydrated]").getByLabel("Nima qidiryapsiz?");
  await expect(field).toBeVisible();
  await field.fill(text);
  await field.press("Enter");
  return page.getByRole("main");
}

test("Chilonzorda oshpaz → oynada «Oshpaz» va Chilonzor; tumanda yo'q → qisqa «yo'q» va pastda shunga yaqin ishlar (Samarqanddagi)", async ({ page, context }) => {
  await seed();
  try {
    await asGuest(context);
    await asMode(context, "worker");
    const dialog = await ask(page, "Chilonzorda oshpaz ish kerak");
    const sheet = page.locator("[data-quick-sheet]");
    await expect(sheet.locator("[data-quick-profession]")).toHaveValue("Oshpaz", { timeout: 20_000 });
    await expect(sheet.locator("[data-quick-place] option:checked")).toHaveText("Toshkent shahri, Chilonzor tumani");
    const answer = await quickSearch(page);
    await expect(answer.locator("[data-quick-none]")).toContainText("Hozircha bunday ish yo'q.");
    await expect(answer.locator("[data-quick-similar]")).toContainText("Shunga yaqin ishlar");
    await expect(answer.locator("[data-quick-similar]").getByText(TITLE)).toBeVisible();
    await expect(dialog.locator("[data-ai-reply]")).toHaveCount(0);
  } finally {
    await sql("delete from public.vacancies where title = $1", [TITLE]);
  }
});

const BRAND_TITLE = "Sotuvchi — Yulduzcha supermarketi";

test("kasblar ro'yxatida yo'q so'z (do'kon nomi) → oynada shu so'z; e'lon matnlaridan topadi; boshqa hududda bo'lsa — pastda", async ({ page, context }) => {
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
    await expect(page.locator("[data-quick-sheet] [data-quick-profession]")).toHaveValue(/^yulduzcha/, { timeout: 20_000 });
    let answer = await quickSearch(page);
    await expect(answer.locator("[data-quick-found]")).toHaveText("1 ta ish topildi");
    await expect(dialog.getByText(BRAND_TITLE).first()).toBeVisible();

    // hudud aytilgan (hudud nomi kasb deb olinmaydi), u yerda yo'q: pastda — boshqa hududdagisi
    dialog = await ask(page, "Toshkentda yulduzchaga ishga kirmoqchiman");
    await expect(page.locator("[data-quick-sheet] [data-quick-profession]")).toHaveValue(/^yulduzcha/, { timeout: 20_000 });
    await expect(page.locator("[data-quick-sheet] [data-quick-place]")).toHaveValue("tashkent_city");
    answer = await quickSearch(page);
    await expect(answer.locator("[data-quick-none]")).toBeVisible();
    await expect(answer.locator("[data-quick-similar]").getByText(BRAND_TITLE)).toBeVisible();
  } finally {
    await sql("delete from public.vacancies where title = $1", [BRAND_TITLE]);
  }
});

test("umuman yo'q → bitta qisqa xabar; mehmonga — «kirsangiz, xabar beramiz» va «Kirish» (uzun matn va boshqa tugmalar yo'q)", async ({ page, context }) => {
  await asGuest(context);
  await asMode(context, "worker");
  const dialog = await ask(page, "Toshkentda kosmonavt kerak");
  const answer = await quickSearch(page);
  const none = answer.locator("[data-quick-none]");
  await expect(none).toHaveText(/Hozircha bunday ish yo'q\.\s*Kirsangiz — shu bo'yicha yangi ish chiqsa, xabar beramiz\.\s*Kirish/);
  await expect(none.getByRole("link", { name: "Kirish" })).toHaveAttribute("href", "/auth?next=%2Fai");
  await expect(answer.locator("[data-quick-similar]")).toHaveCount(0);
  await expect(dialog.locator("[data-ai-reply], [data-ai-suggestions], [data-ai-demos]")).toHaveCount(0);
});

test("eski «mos ish chiqsa — Telegram xabari» sahifasi olib tashlandi — Profilga", async ({ page, context }) => {
  const { loginAs } = await import("../support");
  await loginAs(context, USERS.workerB);
  await page.goto("/ai-alerts?role=worker&q=Toshkentda%20kosmonavt%20kerak");
  await expect(page).toHaveURL(/\/cabinet(\?|$)/);
});

test("bosh sahifa chati: skriptlar yuklanmasdan yuborilsa — matn yo'qolmaydi (?q=…), yuklangach o'zi yuboriladi va manzildan olinadi", async ({ page, context }) => {
  await asGuest(context);
  await asMode(context, "worker");
  // "sahifa ko'rindi, lekin hali jonlanmagan" holati: ilova skriptlari (chunk'lar) yuklanmaydi — sahifa matni oqim bilan keladi
  await page.route("**/_next/static/chunks/**", (route) => route.abort());
  await page.goto("/");
  // 2026-11-23 (C varianti): bosh ekranda yozish — qidiruv qatorida (kasb + hudud)
  const form = page.locator("form[data-home-search]");
  await expect(form).toBeVisible();
  await expect(form).not.toHaveAttribute("data-hydrated", "");
  // 2026-11-23: suhbat — /chat da ("/" — Bosh sahifa); skriptlarsiz ham o'sha yerga
  await expect(form).toHaveAttribute("action", "/chat");
  await form.locator("[data-home-q]").fill("Samarqandda oshpaz");
  await form.locator("[data-home-submit]").click();
  await page.waitForURL((u) => new URL(u).pathname === "/chat" && new URL(u).searchParams.get("q") === "Samarqandda oshpaz" && new URL(u).searchParams.get("region") === "all");
  // skriptlar keldi: savol o'zi yuboriladi, manzildan q olib tashlanadi (yangilansa qayta yuborilmaydi)
  await page.unroute("**/_next/static/chunks/**");
  await page.reload();
  await expect(page.locator("[data-ai-you]")).toHaveText(["Siz: Samarqandda oshpaz"]);
  await expect(page).toHaveURL((u) => u.pathname === "/chat" && !u.searchParams.has("q") && !u.searchParams.has("region"));
  // matnda viloyat aytilgan — o'shanisi (qatordagi "Butun O'zbekiston" emas)
  await expect(page.locator("[data-guided-summary]").last()).toContainText("Samarqand", { timeout: 20_000 });
  await expect(page.locator("[data-guided-ai='thinking'], [data-guided-ai='searching']")).toHaveCount(0, { timeout: 20_000 });
  await page.reload();
  await expect(page.locator("[data-ai-you]")).toHaveText(["Siz: Samarqandda oshpaz"]);
});

test("/ai?q=… — savol o'zi yuboriladi, natija shu sahifada; manzildan q olib tashlanadi (yangilansa qayta yuborilmaydi)", async ({ page, context }) => {
  await seed();
  try {
    await asGuest(context);
    await asMode(context, "worker");
    await page.goto("/ai?q=Samarqandda%20oshpaz");
    const main = page.getByRole("main");
    await expect(main.getByText("Siz: Samarqandda oshpaz")).toBeVisible();
    // so'rovnoma o'zi ochiladi (hudud — Samarqand)
    await expect(page.locator("[data-quick-sheet] [data-quick-place]")).toHaveValue("samarkand");
    await quickSearch(page);
    await expect(main.locator("article").filter({ hasText: TITLE })).toHaveCount(1);
    await expect(page).toHaveURL(/\/ai$/);
    await page.reload();
    // suhbat qurilmada saqlangan — savol bitta (qayta yuborilmagan)
    await expect(main.getByText("Siz: Samarqandda oshpaz")).toHaveCount(1);
  } finally {
    await sql("delete from public.vacancies where title = $1", [TITLE]);
  }
});
