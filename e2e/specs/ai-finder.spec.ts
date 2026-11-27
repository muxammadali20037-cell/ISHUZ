import { expect, test, type Page } from "@playwright/test";
import { USERS, asGuest, asMode, homeSearch, loginAs, quickSearch, sql } from "../support";

/**
 * D4 / 2026-10 · "AI bilan qidirish" — qidiruv blokida: "Yordamchi" oynasi (suhbat ko'rinishi).
 * 2026-11-16 (ega: "AI uzun matn yozmasin"): matn → so'rovnoma oynasi (kasb, hudud, maosh — matndan oldindan to'ldirilgan,
 * stendda AI kaliti yo'q — lug'at bilan) → "Qidirish" → mos e'lonlar shu yerda; suhbat sahifadan qaytganda saqlanadi;
 * /ai sahifasida — suhbat sahifaning o'zida.
 */

async function nodeId(name: string) {
  const [r] = await sql<{ id: string }>("select id from public.profession_nodes where name_uz = $1 and selectable limit 1", [name]);
  return r!.id;
}

async function vacancy(title: string, profession: string, salaryType: "monthly" | "daily" = "monthly") {
  const [r] = await sql<{ id: string }>("select id from public.regions where slug = 'tashkent_city'");
  const [v] = await sql<{ slug: string }>(
    `insert into public.vacancies (owner_profile_id, title, region_id, description, status, profession_node_id, salary_from, salary_type, published_at, expires_at)
     values ($1, $2, $3, 'Sinov e''loni: ish joyi tavsifi, grafik va shartlar', 'active', $4, 200000, $5, now(), now() + interval '10 days') returning slug`,
    [USERS.employer, title, r!.id, await nodeId(profession), salaryType],
  );
  return v!.slug;
}

// 2026-11-21: bosh sahifa — yangi chat (guided-chat.spec.ts). "Yordamchi" oynasi endi qidiruv natijasi bo'sh bo'lganda
// ("Oddiy so'z bilan qidirish" tugmasi) va /ai sahifasida qoladi — shu testlar o'sha oynani tekshiradi
// stendda e'loni yo'q kasb — natija bo'sh, ostida "Oddiy so'z bilan qidirish"
const empty = async () => `/search?mode=jobs&region=all&p=${await nodeId("Oilaviy shifokor")}`;
const fab = (page: Page) => page.locator("form[data-ai-field][data-hydrated]:visible button[type='submit']").or(page.getByRole("button", { name: "Oddiy so'z bilan qidirish" })).first();

test.beforeEach(async () => {
  await sql("delete from public.vacancies where owner_profile_id = $1", [USERS.employer]);
});
test.afterEach(async () => {
  await sql("delete from public.vacancies where owner_profile_id = $1", [USERS.employer]);
});

test("matn → so'rovnoma (kasb va hudud oldindan to'ldirilgan) → «Qidirish» → mos e'lonlar oyna ichida; e'lon bosilsa — sahifasi ochiladi", async ({ page, context }) => {
  const slug = await vacancy("Buxgalter", "Buxgalter");
  await vacancy("Oshpaz", "Oshpaz");
  await asGuest(context);
  await page.goto(await empty());
  await fab(page).click();
  const dialog = page.getByRole("dialog", { name: "Yordamchi" });
  await expect(dialog.getByText("Ish e'lonlari ichidan qidiriladi")).toBeVisible();
  await dialog.getByLabel("Nima qidiryapsiz?").fill("Toshkent shahrida buxgalter");
  await dialog.getByRole("button", { name: "Topish" }).click();
  // so'rovnoma: "Qanday ish?", "Qaysi hududda?" — yozilganidan to'ldirilgan; oylik maosh so'ralmaydi (ega, 2026-11-17)
  const sheet = page.getByRole("dialog", { name: "Ish qidirish" });
  await expect(sheet.getByLabel("Qanday ish?")).toHaveValue("Buxgalter");
  await expect(sheet.getByLabel("Qaysi hududda?")).toHaveValue("tashkent_city");
  await expect(sheet.getByRole("radiogroup", { name: "Oylik maosh qancha bo'lsin?" })).toHaveCount(0);
  const answer = await quickSearch(page);
  // AI javob matni yozilmaydi — qisqa xulosa va kartalar
  await expect(dialog.locator("[data-ai-reply]")).toHaveCount(0);
  await expect(answer.locator("[data-quick-summary]")).toContainText("Buxgalter");
  await expect(answer.locator("[data-quick-summary]")).toContainText("Toshkent shahri");
  await expect(answer.locator("[data-quick-found]")).toHaveText("1 ta ish topildi");
  const cards = dialog.locator("article");
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toContainText("Buxgalter");
  await cards.first().getByRole("heading").getByRole("link").click();
  await page.waitForURL(`**/jobs/${slug}`);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("kasbi ro'yxatdan tanlanmagan kirillcha e'lon («Ўқитувчи») — «Men oqituvchiman menga ish kerak» bilan topiladi (0082)", async ({ page, context }) => {
  // ega, 2026-11-18: prod'dagi "Ўқитувчи" e'loni (kasb tuguni yo'q, nomi kirillcha) AI qidiruvda chiqmasdi
  const [r] = await sql<{ id: string }>("select id from public.regions where slug = 'tashkent_city'");
  await sql(
    `insert into public.vacancies (owner_profile_id, title, region_id, description, status, salary_negotiable, published_at, expires_at)
     values ($1, 'Ўқитувчи', $2, 'Sinov e''loni: maktabga matematika o''qituvchisi kerak', 'active', true, now(), now() + interval '10 days')`,
    [USERS.employer, r!.id],
  );
  await vacancy("Oshpaz", "Oshpaz");
  await asGuest(context);
  await page.goto(await empty());
  await fab(page).click();
  const dialog = page.getByRole("dialog", { name: "Yordamchi" });
  await dialog.getByLabel("Nima qidiryapsiz?").fill("Men oqituvchiman menga ish kerak");
  await dialog.getByRole("button", { name: "Topish" }).click();
  const answer = await quickSearch(page);
  const cards = dialog.locator("article");
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toContainText("Ўқитувчи");
  await expect(answer.locator("[data-quick-found]")).toHaveText("1 ta ish topildi");
});

test("'kunlik ish' tushuniladi — oynada «Kunlik ishlar» sharti (maosh so'ralmaydi), faqat kunliklar; tushunarsiz matn — qisqa «yo'q»", async ({ page, context }) => {
  await vacancy("Yuk tashuvchi", "Buxgalter", "daily");
  await vacancy("Buxgalter", "Buxgalter", "monthly");
  await asGuest(context);
  await page.goto(await empty());
  await fab(page).click();
  const dialog = page.getByRole("dialog", { name: "Yordamchi" });
  await dialog.getByLabel("Nima qidiryapsiz?").fill("kunlik ish");
  await dialog.getByRole("button", { name: "Topish" }).click();
  const sheet = page.locator("[data-quick-sheet]");
  await expect(sheet.locator("[data-quick-filters]")).toContainText("Kunlik ishlar");
  await expect(sheet.locator("[data-quick-salary]")).toHaveCount(0);
  const answer = await quickSearch(page);
  await expect(answer.locator("[data-quick-summary]")).toContainText("Kunlik ishlar");
  await expect(dialog.locator("article")).toHaveCount(1);
  await expect(dialog.locator("article").first()).toContainText("Yuk tashuvchi");
  await expect(dialog.locator("article").first()).toContainText("/kun");

  // hech narsa yo'q: bitta qisqa xabar (uzun matn yo'q); mehmon — "kirsangiz, xabar beramiz" va "Kirish"
  await dialog.getByLabel("Nima qidiryapsiz?").fill("qwerty asdf");
  await dialog.getByRole("button", { name: "Topish" }).click();
  const none = await quickSearch(page);
  await expect(none.locator("[data-quick-none]")).toContainText("Hozircha bunday ish yo'q.");
  await expect(none.locator("[data-quick-none]")).toHaveAttribute("data-save", "login");
  await expect(none.getByRole("link", { name: "Kirish" })).toHaveAttribute("href", "/auth?next=%2Fai");
  await expect(none.locator("article")).toHaveCount(0);
  await expect(dialog.locator("[data-ai-reply]")).toHaveCount(0);
});

test("ish beruvchi (kirgan): asosiy ekran — chat; yozilgan so'z ishchilar ichida qidiriladi", async ({ page, context }) => {
  await sql(
    `insert into public.employer_profiles (profile_id, employer_type, display_name, onboarding_completed_at)
     values ($1, 'person', 'Dilnoza opa', now()) on conflict (profile_id) do nothing`,
    [USERS.employer],
  );
  await sql("update public.profiles set active_role = 'employer' where id = $1", [USERS.employer]);
  await loginAs(context, USERS.employer);
  // 2026-11-21: kirgan foydalanuvchining "/" — chat; ish beruvchida yozilgan kasb ishchilar ichida qidiriladi.
  // 2026-11-23 (C varianti): bosh ekranda qidiruv qatori — hudud qatorda tanlanadi ("Butun O'zbekiston"), savolsiz natija
  // 2026-11-23: "/" — Bosh sahifa; qidiruv natijasi "Qidiruv" (/chat) da yangi suhbat bo'lib ochiladi
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Ishingiz shu yerdan boshlanadi!" })).toBeVisible();
  await expect(page.locator("[data-home-q]")).toHaveAttribute("placeholder", "O'zingizga mos ish va ishchini toping");
  await homeSearch(page, "oshpaz");
  const res = page.locator("[data-guided-ai]").last();
  await expect(res).toHaveAttribute("data-guided-ai", /^(results|none)$/, { timeout: 20_000 });
  await expect(res).toContainText(/ta ishchi topdim|bunday ishchi topilmadi/);
  await expect(res.locator("[data-guided-summary]")).toContainText("Butun O'zbekiston");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

const dialogOf = (page: Page) => page.getByRole("dialog", { name: "Yordamchi" });

test("suhbat: salomlashuv va misol → so'rovnoma → javob; «O'zgartirish» oynani qayta ochadi (maosh); 'Yangi suhbat' tozalaydi", async ({ page, context }) => {
  await vacancy("Buxgalter (oylik)", "Buxgalter", "monthly");
  await vacancy("Buxgalter (kunlik)", "Buxgalter", "daily");
  await asGuest(context);
  await asMode(context, "worker");
  await page.goto(await empty());
  await fab(page).click();
  const dialog = dialogOf(page);
  // bo'sh suhbat: yordamchi o'zini tanishtiradi va bosiladigan misollar beradi
  await expect(dialog.getByText(/Qanday ish qidiryapsiz\?/)).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Toshkentda buxgalter" })).toBeVisible();
  await dialog.getByRole("button", { name: "Toshkentda buxgalter" }).click();
  await expect(dialog.getByText("Siz: Toshkentda buxgalter")).toBeVisible();
  const answer = await quickSearch(page);
  await expect(answer.locator("[data-quick-summary]")).toContainText("Buxgalter");
  await expect(answer.locator("[data-quick-found]")).toHaveText("2 ta ish topildi");
  await expect(dialog.locator("article")).toHaveCount(2);

  // "O'zgartirish": oyna oldingi javoblar bilan qayta ochiladi; Samarqandda — stenddagi e'lonlar (Toshkentda) chiqmaydi,
  // "yo'q" va pastda — shunga yaqin ishlar (boshqa hududda). Maosh so'ralmaydi (ega, 2026-11-17)
  await answer.getByRole("button", { name: "O'zgartirish" }).click();
  await expect(page.locator("[data-quick-sheet] [data-quick-profession]")).toHaveValue("Buxgalter");
  await expect(page.locator("[data-quick-sheet] [data-quick-salary]")).toHaveCount(0);
  const again = await quickSearch(page, { place: "samarkand" });
  await expect(again.locator("[data-quick-summary]")).toContainText("Samarqand");
  await expect(again.locator("[data-quick-none]")).toContainText("Hozircha bunday ish yo'q.");
  await expect(again.locator("[data-quick-similar]")).toContainText("Shunga yaqin ishlar");
  await expect(again.locator("[data-quick-similar] article")).toHaveCount(2);

  await dialog.getByRole("button", { name: "Yangi suhbat" }).click();
  await expect(dialog.locator("article")).toHaveCount(0);
  await expect(dialog.getByText(/Qanday ish qidiryapsiz\?/)).toBeVisible();
});

test("suhbat saqlanadi: e'lon ochilib, orqaga qaytilganda oynada oldingi javob turadi", async ({ page, context }) => {
  const slug = await vacancy("Buxgalter", "Buxgalter");
  await asGuest(context);
  await asMode(context, "worker");
  await page.goto(await empty());
  await fab(page).click();
  const dialog = dialogOf(page);
  await dialog.getByLabel("Nima qidiryapsiz?").fill("Toshkent shahrida buxgalter");
  await dialog.getByRole("button", { name: "Topish" }).click();
  await quickSearch(page);
  await expect(dialog.locator("article")).toHaveCount(1);
  await dialog.locator("article").first().getByRole("heading").getByRole("link").click();
  await page.waitForURL(`**/jobs/${slug}`);
  await page.goBack();
  await page.waitForURL((u) => new URL(u).pathname === "/search");
  await fab(page).click();
  await expect(dialogOf(page).getByText("Siz: Toshkent shahrida buxgalter")).toBeVisible();
  await expect(dialogOf(page).locator("article")).toHaveCount(1);
});

test("ovoz yo'q (ega, 2026-11-15: «kerak emas»): brauzer qo'llasa ham mikrofon, «Ovoz bilan javob», «O'qib berish» chiqmaydi", async ({ page, context }) => {
  await vacancy("Buxgalter", "Buxgalter");
  // ovozli kiritish ham, o'qib berish ham "bor" brauzer — baribir tugmalar ko'rinmasligi kerak
  await context.addInitScript(() => {
    class FakeRecognition {
      start() {}
      stop() {}
      abort() {}
    }
    Object.assign(window, { SpeechRecognition: FakeRecognition, webkitSpeechRecognition: FakeRecognition });
  });
  await asGuest(context);
  await asMode(context, "worker");
  await page.goto(await empty());
  await fab(page).click();
  const dialog = dialogOf(page);
  const field = dialog.getByLabel("Nima qidiryapsiz?");
  await expect(field).toBeVisible();
  await expect(dialog.getByRole("button", { name: /Ovoz bilan|Gapirib/ })).toHaveCount(0);
  await expect(dialog.getByRole("switch")).toHaveCount(0);
  await field.fill("Toshkent shahrida buxgalter");
  await dialog.getByRole("button", { name: "Topish" }).click();
  await expect(dialog.getByText("Siz: Toshkent shahrida buxgalter")).toBeVisible();
  await quickSearch(page);
  await expect(dialog.locator("article")).toHaveCount(1);
  await expect(dialog.getByRole("button", { name: "O'qib berish" })).toHaveCount(0);
  await expect(dialog.getByText(/mikrofon/i)).toHaveCount(0);
});

test("/ai sahifasi: suhbat sahifaning o'zida (oyna emas), natija shu yerda", async ({ page, context }) => {
  await vacancy("Buxgalter", "Buxgalter");
  await asGuest(context);
  await asMode(context, "worker");
  await page.goto("/ai");
  await expect(page.getByRole("heading", { level: 1, name: "Yordamchi" })).toBeVisible();
  await page.getByLabel("Nima qidiryapsiz?").fill("Toshkentda buxgalter");
  await page.getByRole("button", { name: "Topish", exact: true }).click();
  const answer = await quickSearch(page);
  await expect(answer.locator("[data-quick-summary]")).toContainText("Buxgalter");
  // natija kartasi suhbatda (salomlashuvdagi "Yangi ishlar" ro'yxati yo'qoladi)
  await expect(page.locator("main article")).toHaveCount(1);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
