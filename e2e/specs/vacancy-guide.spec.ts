import { expect, test, type Page } from "@playwright/test";
import { USERS, asMode, loginAs, sql } from "../support";

/**
 * "AI bilan oson joylash" (2026-11-16, ega: "ish beruvchi panelida ajralib tursin; menga shunaqa kerak desa — ekranda savol
 * chiqsin, tanlab-tanlab sen bergan variantni o'tkazsin, yozuvlar kam va tushunarli bo'lsin").
 * Stendda AI kaliti yo'q — gap lug'at bilan tushuniladi (prod'da AI qo'shimcha to'ldiradi); savollar va joylash bir xil.
 */

test.beforeEach(async () => {
  await sql("delete from public.vacancies where owner_profile_id = $1", [USERS.employer]);
});
test.afterAll(async () => {
  await sql("delete from public.vacancies where owner_profile_id = $1", [USERS.employer]);
});

const h1 = (page: Page) => page.getByRole("heading", { level: 1 });
const choice = (page: Page, key: string) => page.locator(`[data-guide-choice="${key}"]`);
/** qoralama o'qildi va sahifa jonlandi — shundan keyin yoziladi (aks holda yozilgan matn jonlanishda o'chadi) */
async function ready(page: Page) {
  await expect(page.locator("[data-vacancy-guide]")).toBeVisible();
  await expect(page.locator("[data-vacancy-guide][aria-busy]")).toHaveCount(0);
}

/** ish beruvchi turi va ismi profilda bor (boshqa testlar ham shunday qoldiradi) — natija testlar tartibiga bog'liq bo'lmasin */
async function knownEmployer() {
  await sql(
    `insert into public.employer_profiles (profile_id, employer_type, display_name, onboarding_completed_at) values ($1, 'person', 'Dilnoza', now())
     on conflict (profile_id) do update set employer_type = 'person', display_name = 'Dilnoza'`,
    [USERS.employer],
  );
}

test("bosh sahifada alohida kirish → bir gap → faqat tushunilmagani so'raladi (variant bosib) → bir ekranda tekshirib joylanadi", async ({ page, context }) => {
  await knownEmployer();
  await loginAs(context, USERS.employer);
  await asMode(context, "employer");
  await page.goto("/");
  const entry = page.locator("[data-guide-entry]");
  // 2026-11-17: bitta katta "Vakansiya joylash" tugmasi — yordamchi bilan (avvalgi "AI bilan oson joylash" kartasi o'rnida)
  await expect(entry).toHaveText("Vakansiya joylash");
  await entry.click();
  await page.waitForURL(/\/post\/vacancy\?ai=1/);
  await expect(h1(page)).toHaveText("Qanday xodim kerak?");
  await ready(page);

  await page.locator("[data-guide-sentence]").fill("Chilonzordagi kafemizga oshpaz kerak, oyligi 5 mln, ovqat bilan");
  await page.locator("[data-guide-start]").click();

  // kasb, tuman va maosh gapdan tushunildi — qayta so'ralmaydi; birinchi savol — ish vaqti
  await expect(h1(page)).toHaveText("Ish vaqti qanday?");
  const understood = page.locator("[data-guide-understood]");
  await expect(understood).toContainText("Oshpaz");
  await expect(understood).toContainText("Chilonzor");
  await expect(understood).toContainText("5 mln");
  // kasb, tuman (ikkalasi), maosh — gapdan; ish beruvchi, ismi, telefon — profildan
  await expect(page.locator("[data-guide-progress]")).toHaveText("7/10");
  await choice(page, "2_2").click();

  await expect(h1(page)).toHaveText("Tajriba kerakmi?");
  await choice(page, "0").click();

  // ish beruvchi, ism va telefon profildan — so'ralmaydi (oxirgi ekranda ko'rinadi, o'zgartirish mumkin);
  // e'lon matni gap va tanlovlardan (o'ylab topilgan narsa yo'q)
  await expect(h1(page)).toHaveText("E'lon matni. Ma'qulmi?");
  const desc = page.locator("[data-guide-description]");
  await expect(desc).toContainText("Chilonzordagi kafemizga oshpaz kerak, oyligi 5 mln, ovqat bilan.");
  await expect(desc).toContainText("Ish vaqti: 2/2.");
  await expect(desc).toContainText("Tajriba shart emas.");
  await choice(page, "ok").click();

  await expect(h1(page)).toHaveText("Hammasi tayyor");
  const done = page.locator("[data-guide-done]");
  await expect(done).toContainText("Oshpaz");
  await expect(done).toContainText("Chilonzor");
  await expect(done).toContainText("Dilnoza");
  await page.locator("[data-guide-publish]").click();
  await expect(h1(page)).toHaveText(/E'loningiz joylandi|joylandi/i, { timeout: 20_000 });

  const [v] = await sql<{ title: string; district: string; salary_from: number; salary_type: string; schedule: string; experience_min_months: number; description: string }>(
    `select v.title, d.name_uz as district, v.salary_from, v.salary_type::text, v.schedule::text, v.experience_min_months, v.description
     from public.vacancies v left join public.districts d on d.id = v.district_id where v.owner_profile_id = $1`,
    [USERS.employer],
  );
  expect(v).toMatchObject({ title: "Oshpaz", district: "Chilonzor tumani", salary_from: 5_000_000, salary_type: "monthly", schedule: "2_2", experience_min_months: 0 });
  expect(v!.description).toContain("kafemizga oshpaz kerak");
});

test("kasb aniq bo'lmasa — variantlar; viloyat → tuman tugmalari, «Orqaga» — oldingi savol; kunlik haq; «Oddiy forma» javoblarni saqlaydi", async ({ page, context }) => {
  // ish beruvchi turi va ismi profilda bor — so'ralmaydi (oxirgi ekranda "O'zgartirish" bilan almashtiriladi)
  await knownEmployer();
  await loginAs(context, USERS.employer);
  await asMode(context, "employer");
  await page.goto("/post/vacancy?ai=1");
  await expect(h1(page)).toHaveText("Qanday xodim kerak?");
  await ready(page);
  await page.locator("[data-guide-sentence]").fill("kuryer kerak");
  await page.locator("[data-guide-start]").click();

  // "kuryer" — bir nechta kasb: o'zi tanlab qo'ymaydi, variant beradi
  await expect(h1(page)).toHaveText("Qaysi biri?");
  const opts = page.locator("[data-guide-choices] [data-guide-choice]");
  expect(await opts.count()).toBeGreaterThan(2);
  await expect(choice(page, "other")).toHaveText("Boshqa kasb");
  await opts.first().click();

  await expect(h1(page)).toHaveText("Ish qayerda?");
  await page.locator("[data-guide-choices]").getByRole("button", { name: "Samarqand", exact: true }).click();
  await expect(h1(page)).toHaveText("Qaysi tuman?");
  // adashdi — orqaga: viloyat savoli qaytadi
  await page.locator("[data-guide-back]").click();
  await expect(h1(page)).toHaveText("Ish qayerda?");
  await page.locator("[data-guide-choices]").getByRole("button", { name: "Toshkent shahri", exact: true }).click();
  await expect(h1(page)).toHaveText("Qaysi tuman?");
  await choice(page, "whole").click();

  await expect(h1(page)).toHaveText("Oylik qancha?");
  await page.locator("[data-guide-pay-switch]").click();
  await expect(h1(page)).toHaveText("Kunlik haq qancha?");
  await choice(page, "200000").click();
  await expect(h1(page)).toHaveText("Ish vaqti qanday?");
  await choice(page, "any").click();
  await expect(h1(page)).toHaveText("Tajriba kerakmi?");
  await choice(page, "12").click();
  await expect(h1(page)).toHaveText("E'lon matni. Ma'qulmi?");
  await choice(page, "ok").click();
  await expect(h1(page)).toHaveText("Hammasi tayyor");
  const done = page.locator("[data-guide-done]");
  await expect(done).toContainText("Dilnoza");
  // oxirgi ekrandan o'zgartirish: faqat shu savol qayta chiqadi, keyin yana tayyor ekran
  await done.getByRole("button", { name: "O'zgartirish" }).nth(5).click();
  await expect(h1(page)).toHaveText("Kim ish beradi?");
  await choice(page, "company").click();
  await expect(h1(page)).toHaveText("Tashkilot nomi?");
  await page.locator("[data-guide-input]").fill("Tez Yetkaz");
  await page.locator("[data-guide-next]").click();
  await expect(h1(page)).toHaveText("Hammasi tayyor");
  await expect(page.locator("[data-guide-done]")).toContainText("Tez Yetkaz");
  await expect(page.locator("[data-guide-done]")).toContainText("Kunlik");

  // oddiy formaga o'tsa — javoblar yo'qolmaydi
  await page.locator("[data-guide-classic]").click();
  await expect(page).not.toHaveURL(/ai=1/);
  await expect(page.getByText("4/4")).toBeVisible();
  await expect(page.getByRole("main")).toContainText("Toshkent shahri");
  await expect(page.getByRole("main")).toContainText("kuryer", { ignoreCase: true });
  await expect(page.getByRole("main")).toContainText("Tez Yetkaz");
});

test("«Boshqa kasb» — yozib topadi (xato bilan ham); oddiy formadagi 1-qadamda ham kirish bor", async ({ page, context }) => {
  await loginAs(context, USERS.employer);
  await asMode(context, "employer");
  await page.goto("/post/vacancy?step=1");
  const row = page.locator("[data-guide-open]");
  await expect(row).toContainText("AI bilan oson joylash");
  await row.click();
  await expect(h1(page)).toHaveText("Qanday xodim kerak?");
  await ready(page);
  // bosiladigan tayyor misol
  await choice(page, "ex4").click();
  await expect(h1(page)).toHaveText("Ish qayerda?");
  await expect(page.locator("[data-guide-understood]")).toContainText("Farrosh");
  // kasbni o'zgartirish: orqaga → misollar ekrani; yangi gap — kasb aytilmagan → kasb savoli tez variantlar bilan
  await page.locator("[data-guide-back]").click();
  await expect(h1(page)).toHaveText("Qanday xodim kerak?");
  await page.locator("[data-guide-sentence]").fill("Yunusobodda ishchi kerak");
  await page.locator("[data-guide-start]").click();
  await expect(h1(page)).toHaveText("Qaysi kasb?");
  await expect(page.locator("[data-guide-choices]")).toContainText("Sotuvchi");
  await choice(page, "other").click();
  await page.locator("[data-guide-input]").fill("santexnk");
  await page.locator("[data-guide-next]").click();
  await expect(h1(page)).toHaveText("Oylik qancha?");
  await expect(page.locator("[data-guide-understood]")).toContainText("Santexnik");
  await expect(page.locator("[data-guide-understood]")).toContainText("Yunusobod");
});
