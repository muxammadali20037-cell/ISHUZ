import { expect, test, type Page } from "@playwright/test";
import { USERS, asMode, homeSearch, loginAs, next, pickProfession, pickWholeRegion, sql } from "../support";

/**
 * "AI bilan oson joylash" (2026-11-16, ega: "ish beruvchi panelida ajralib tursin; menga shunaqa kerak desa — ekranda savol
 * chiqsin, tanlab-tanlab sen bergan variantni o'tkazsin, yozuvlar kam va tushunarli bo'lsin").
 * Stendda AI kaliti yo'q — gap lug'at bilan tushuniladi (prod'da AI qo'shimcha to'ldiradi); savollar va joylash bir xil.
 */

test.beforeEach(async () => {
  await sql("delete from public.vacancies where owner_profile_id = $1", [USERS.employer]);
  // e'lon rasmlari (qoralamalar ham) va ularning kunlik hisoblagichi — har yugurish toza
  await sql("delete from public.listing_images where owner_profile_id = $1", [USERS.employer]);
  await sql("delete from public.rate_limits where key like 'listing_images:%'");
});
test.afterAll(async () => {
  await sql("delete from public.vacancies where owner_profile_id = $1", [USERS.employer]);
  await sql("delete from public.listing_images where owner_profile_id = $1", [USERS.employer]);
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

test("asosiy ekrandan (chat) kirish → bir gap → faqat tushunilmagani so'raladi (variant bosib) → bir ekranda tekshirib joylanadi", async ({ page, context }) => {
  await knownEmployer();
  await loginAs(context, USERS.employer);
  await asMode(context, "employer");
  // kirgan ish beruvchining asosiy ekrani — chat: "vakansiya joylamoqchiman" → "Vakansiya joylash" → alohida ekran (yordamchi)
  await page.goto("/");
  await homeSearch(page, "Vakansiya joylamoqchiman");
  await page.locator("[data-guided-post-to='employer']").click();
  await page.waitForURL(/\/post\/vacancy\?ai=1/);
  await expect(h1(page)).toHaveText("Qanday xodim kerak?");
  await ready(page);
  await page.locator("[data-guide-sentence]").fill("Chilonzordagi kafemizga oshpaz kerak, oyligi 5 mln, ovqat bilan");
  await page.locator("[data-guide-start]").click();

  // kasb, tuman, maosh va joy turi ("kafe") gapdan tushunildi — qayta so'ralmaydi; oshpazga xos savol — sanitar daftarcha
  await expect(h1(page)).toHaveText("Sanitar daftarcha (tibbiy kitobcha) kerakmi?");
  const understood = page.locator("[data-guide-understood]");
  await expect(understood).toContainText("Oshpaz");
  await expect(understood).toContainText("Kafe");
  await expect(understood).toContainText("Chilonzor");
  await expect(understood).toContainText("5 mln");
  // kasb, joy turi, tuman (ikkalasi), maosh — gapdan; ish beruvchi, ismi, telefon — profildan
  await expect(page.locator("[data-guide-progress]")).toHaveText("8/16");
  await choice(page, "required").click();
  await expect(h1(page)).toHaveText("Ish grafigi qanday?");
  await choice(page, "5_2").click();

  // ish vaqti (ega, 2026-11-24): tayyor oraliqlar yoki o'zi; jinsi; yoshi — aniq emas, chegaralar
  await expect(h1(page)).toHaveText("Soat nechadan nechagacha ishlaydi?");
  await choice(page, "other").click();
  await page.locator("[data-guide-time='from']").fill("08:30");
  await page.locator("[data-guide-time='to']").fill("17:30");
  await page.locator("[data-guide-next]").click();
  await expect(h1(page)).toHaveText("Erkak kerakmi yoki ayol?");
  await choice(page, "female").click();
  await expect(h1(page)).toHaveText("Yoshi qancha bo'lsin?");
  await expect(page.locator("[data-guide-choices]")).toContainText("18–35 yosh");
  await choice(page, "other").click();
  await page.locator("[data-guide-age='from']").fill("40");
  await page.locator("[data-guide-age='to']").fill("20");
  await expect(page.locator("[data-guide-next]")).toBeDisabled();
  await page.locator("[data-guide-age='from']").fill("20");
  await page.locator("[data-guide-age='to']").fill("40");
  await page.locator("[data-guide-next]").click();

  await expect(h1(page)).toHaveText("Tajriba kerakmi?");
  await choice(page, "0").click();

  // izoh (ega, 2026-11-22: "obed, yo'lkira tekin shunga o'xshash narsalar — chiroyli e'lon qilib taxlash"): tayyor variant
  // tanlanadi va/yoki o'zi yoziladi; tanlamasdan va yozmasdan "Davom etish" bosilmaydi
  await expect(h1(page)).toHaveText("Qo'shimcha izoh bormi?");
  await expect(page.locator("[data-guide-next]")).toBeDisabled();
  await page.locator("[data-guide-note='dorm']").click();
  await expect(page.locator("[data-guide-note='dorm']")).toHaveAttribute("aria-pressed", "true");
  await page.locator("[data-guide-notes] [data-guide-input]").fill("obed, yo'lkira tekin. Tel: 90 123 45 67");
  await page.locator("[data-guide-next]").click();

  // ish beruvchi, ism va telefon profildan — so'ralmaydi (oxirgi ekranda ko'rinadi, o'zgartirish mumkin);
  // e'lon matni gap va tanlovlardan (o'ylab topilgan narsa yo'q); izoh — oxirida ✅ ro'yxat, raqamsiz
  await expect(h1(page)).toHaveText("E'lon matni. Ma'qulmi?");
  const desc = page.locator("[data-guide-description]");
  await expect(desc).toContainText("Chilonzordagi kafemizga oshpaz kerak, oyligi 5 mln, ovqat bilan.");
  await expect(desc).toContainText("Ish grafigi: 5/2.");
  await expect(desc).toContainText("Tajriba shart emas.");
  await expect(desc).toContainText("✅ Ish joyi: kafe");
  await expect(desc).toContainText("✅ Sanitar daftarcha (tibbiy kitobcha) bo'lishi shart");
  await expect(desc).toContainText("✅ Yotoqxona bor");
  await expect(desc).toContainText("✅ Obed tekin");
  await expect(desc).toContainText("✅ Yo'lkira tekin");
  await expect(desc).not.toContainText("123");
  await choice(page, "ok").click();

  await expect(h1(page)).toHaveText("Hammasi tayyor");
  const done = page.locator("[data-guide-done]");
  await expect(done).toContainText("Oshpaz");
  await expect(done).toContainText("Chilonzor");
  await expect(done).toContainText("Dilnoza");
  await expect(done).toContainText("08:30–17:30");
  await expect(done).toContainText("Ayol");
  await expect(done).toContainText("20–40 yosh");
  // e'lon rasmi — JOYLASHDAN OLDIN (ega, 2026-11-22: "ma'qul kelsa joylash kerak"): yaratish → ko'rish → boshqasi → joylash
  // (stendda soxta OpenAI)
  const image = page.locator("[data-listing-image]");
  await expect(image).toHaveAttribute("data-listing-image", "ask");
  await image.locator("[data-listing-image-create]").click();
  await expect(image).toHaveAttribute("data-listing-image", "ready", { timeout: 30_000 });
  const first = await image.locator("[data-listing-image-preview]").getAttribute("src");
  await image.locator("[data-listing-image-again]").click();
  await expect(image).toHaveAttribute("data-listing-image", "ready", { timeout: 30_000 });
  const chosen = await image.locator("[data-listing-image-preview]").getAttribute("src");
  expect(chosen).not.toBe(first);
  // Google Play: AI rasmi haqida ilova ichidan xabar berish (0092) — adminning shikoyatlar navbatiga tushadi
  await sql("delete from public.reports where target_type = 'ai_content' and reporter_profile_id = $1", [USERS.employer]);
  await image.locator("[data-ai-report]").click();
  const sheet = page.getByRole("dialog");
  await expect(sheet).toContainText("AI natijasi haqida xabar");
  await expect(sheet.locator("[data-ai-report-send]")).toBeDisabled();
  await sheet.getByText("Haqoratli yoki nomaqbul").click();
  await sheet.locator("#ai-report-details").fill("sinov");
  await sheet.locator("[data-ai-report-send]").click();
  await expect(page.getByText("Shikoyat yuborildi. Moderatorlar ko'rib chiqadi.")).toBeVisible();
  const [rep] = await sql<{ target_id: string; reason: string; details: string }>(
    "select target_id, reason::text, details from public.reports where target_type = 'ai_content' and reporter_profile_id = $1",
    [USERS.employer],
  );
  expect(rep!.target_id).toMatch(/^listing_image:[0-9a-f]{32}$/);
  expect(rep!.reason).toBe("abuse");
  expect(rep!.details).toBe(`[listing_image]\n${chosen}\n— sinov`);
  await page.locator("[data-guide-publish]").click();
  await expect(h1(page)).toHaveText(/E'loningiz joylandi|joylandi/i, { timeout: 20_000 });
  // joylangandan keyin savol yo'q — tanlangan rasm e'lonning o'zida
  await expect(page.locator("[data-listing-image]")).toHaveCount(0);
  const [img] = await sql<{ image_url: string; status: string }>(
    "select li.image_url, li.status from public.listing_images li join public.vacancies v on v.id = li.entity_id where li.entity = 'vacancy' and v.owner_profile_id = $1",
    [USERS.employer],
  );
  expect(img).toEqual({ image_url: chosen, status: "ready" });

  const [v] = await sql<{ title: string; district: string; salary_from: number; salary_type: string; schedule: string; experience_min_months: number; description: string; gender: string; age_min: number; age_max: number; work_from: string; work_to: string; status: string }>(
    `select v.title, d.name_uz as district, v.salary_from, v.salary_type::text, v.schedule::text, v.experience_min_months, v.description,
            v.gender::text, v.age_min, v.age_max, to_char(v.work_time_from, 'HH24:MI') as work_from, to_char(v.work_time_to, 'HH24:MI') as work_to, v.status::text
     from public.vacancies v left join public.districts d on d.id = v.district_id where v.owner_profile_id = $1`,
    [USERS.employer],
  );
  expect(v).toMatchObject({ title: "Oshpaz", district: "Chilonzor tumani", salary_from: 5_000_000, salary_type: "monthly", schedule: "5_2", experience_min_months: 0 });
  // jinsi, yosh chegarasi, ish vaqti — bazada; e'lon holati o'zgarmaydi (qayta moderatsiyaga tushmaydi)
  expect(v).toMatchObject({ gender: "female", age_min: 20, age_max: 40, work_from: "08:30", work_to: "17:30", status: "active" });
  expect(v!.description).toContain("kafemizga oshpaz kerak");
  expect(v!.description).toMatch(/\n\n✅ Ish joyi: kafe\n✅ Sanitar daftarcha \(tibbiy kitobcha\) bo'lishi shart\n✅ Yotoqxona bor\n✅ Obed tekin\n✅ Yo'lkira tekin$/);

  // e'lon sahifasida izoh — yashil belgili ro'yxat
  const [pub] = await sql<{ slug: string }>("select slug from public.vacancies where owner_profile_id = $1", [USERS.employer]);
  await page.goto(`/jobs/${pub!.slug}`);
  const list = page.locator("[data-notes-list]");
  await expect(list.locator("li")).toHaveText(["Ish joyi: kafe", "Sanitar daftarcha (tibbiy kitobcha) bo'lishi shart", "Yotoqxona bor", "Obed tekin", "Yo'lkira tekin"]);
  // talablar va ish vaqti — e'lon sahifasida
  const main = page.getByRole("main");
  await expect(main).toContainText("20–40 yosh");
  await expect(main).toContainText("Ayol");
  await expect(main).toContainText("08:30–17:30");
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
  // kuryer — kasbga xos savol: nimada yetkazadi (ega, 2026-11-24)
  await opts.filter({ hasText: /^Ekspress kuryer$/ }).click();
  await expect(h1(page)).toHaveText("Kuryer nimada yetkazadi?");
  await choice(page, "moto").click();

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
  await expect(h1(page)).toHaveText("Ish grafigi qanday?");
  // smenali — ish vaqti so'ralmaydi
  await choice(page, "shift").click();
  await expect(h1(page)).toHaveText("Erkak kerakmi yoki ayol?");
  await choice(page, "any").click();
  await expect(h1(page)).toHaveText("Yoshi qancha bo'lsin?");
  await choice(page, "any").click();
  await expect(h1(page)).toHaveText("Tajriba kerakmi?");
  await choice(page, "12").click();
  // izohsiz ham bo'ladi
  await expect(h1(page)).toHaveText("Qo'shimcha izoh bormi?");
  await page.locator("[data-guide-notes-skip]").click();
  await expect(h1(page)).toHaveText("E'lon matni. Ma'qulmi?");
  // izoh yo'q — faqat kasbga xos javob ✅ bilan
  await expect(page.locator("[data-guide-description]")).toContainText("✅ Mototsiklda yetkazadi");
  await choice(page, "ok").click();
  await expect(h1(page)).toHaveText("Hammasi tayyor");
  const done = page.locator("[data-guide-done]");
  await expect(done).toContainText("Dilnoza");
  await expect(done).toContainText("Mototsikl");
  // smenali grafikda ish vaqti qatori yo'q
  await expect(done).not.toContainText("Ish vaqti");
  // oxirgi ekrandan o'zgartirish: faqat shu savol qayta chiqadi, keyin yana tayyor ekran
  await done.getByText("Kim e'lon beryapti?", { exact: true }).locator("xpath=../..").getByRole("button", { name: "O'zgartirish" }).click();
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

test("«shifokor kerak», «doktor kerak» — turli shifokorlar variant (doktorant emas; ega, 2026-11-23)", async ({ page, context }) => {
  await knownEmployer();
  await loginAs(context, USERS.employer);
  await asMode(context, "employer");
  for (const text of ["shifokor kerak", "doktor kerak"]) {
    await page.goto("/post/vacancy?ai=1");
    await ready(page);
    await page.locator("[data-guide-sentence]").fill(text);
    await page.locator("[data-guide-start]").click();
    await expect(h1(page)).toHaveText("Qaysi biri?");
    const opts = page.locator("[data-guide-choices] [data-guide-choice]");
    // har yo'nalishdan: terapevt, kardiolog, pediatr, jarroh … (12 tagacha) va «Boshqa kasb»
    for (const name of ["Terapevt", "Kardiolog", "Pediatr", "Umumiy jarroh"]) await expect(opts.filter({ hasText: new RegExp(`^${name}$`) })).toHaveCount(1);
    await expect(page.locator("[data-guide-choices]")).not.toContainText(/doktorant/i);
    await expect(choice(page, "other")).toHaveText("Boshqa kasb");
  }
});

test("«menejer kerak», «meneger kerak» — «Qanday menejer kerak?»: avval 12 tasi, «Hammasi» — barchasi; aniq aytilgani — darhol (ega, 2026-11-24)", async ({ page, context }) => {
  await knownEmployer();
  await loginAs(context, USERS.employer);
  await asMode(context, "employer");
  const opts = page.locator("[data-guide-choices] [data-guide-choice]");
  // avval "meneger" tushunilmasdi, "menejer" esa tasodifiy "Tadbir tashkilotchisi (event menejer)" bo'lib qolardi
  for (const text of ["menejer kerak", "meneger kerak", "Нужен менеджер"]) {
    await page.goto("/post/vacancy?ai=1");
    await ready(page);
    await page.locator("[data-guide-sentence]").fill(text);
    await page.locator("[data-guide-start]").click();
    await expect(h1(page)).toHaveText("Qanday menejer kerak?");
    // ko'p so'raladiganlari: 12 ta + «Hammasi» + «Boshqa kasb»
    await expect(opts).toHaveCount(14);
    await expect(opts.first()).toHaveText("Savdo menejeri");
    for (const name of ["Ofis menejeri", "HR menejer", "Loyiha menejeri", "SMM menejer", "Restoran menejeri"]) await expect(opts.filter({ hasText: new RegExp(`^${name}$`) })).toHaveCount(1);
    await expect(page.locator("[data-guide-choices]")).not.toContainText(/event/i);
    await expect(choice(page, "all")).toHaveText(/^Hammasi · \d+ ta$/);
    await expect(choice(page, "other")).toHaveText("Boshqa kasb");
  }
  await choice(page, "all").click();
  await expect(choice(page, "all")).toHaveCount(0);
  await expect(opts.filter({ hasText: /^Banket menejeri$/ })).toHaveCount(1);
  await expect(opts.filter({ hasText: /event menejer/ })).toHaveCount(1);
  expect(await opts.count()).toBeGreaterThan(40);
  await opts.filter({ hasText: /^Ofis menejeri$/ }).click();
  await expect(page.locator("[data-guide-understood]")).toContainText("Ofis menejeri");
  await expect(h1(page)).not.toHaveText("Qanday menejer kerak?");

  // qaysi menejerligi aytilgan — so'ralmaydi (imlo xatosi bilan ham)
  for (const [text, name] of [
    ["savdo menejeri kerak", "Savdo menejeri"],
    ["restoranga meneger kerak", "Restoran menejeri"],
  ] as const) {
    await page.goto("/post/vacancy?ai=1");
    await ready(page);
    await page.locator("[data-guide-sentence]").fill(text);
    await page.locator("[data-guide-start]").click();
    await expect(page.locator("[data-guide-understood]")).toContainText(name);
    await expect(h1(page)).not.toHaveText(/Qanday menejer kerak\?|Qaysi biri\?/);
  }
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
  // farrosh — kasbga xos savol: qayerda tozalaydi (ega, 2026-11-24: "hamma kasblardan aniq so'rash")
  await expect(h1(page)).toHaveText("Qayerda tozalaydi?");
  await expect(page.locator("[data-guide-understood]")).toContainText("Farrosh");
  await choice(page, "office").click();
  await expect(h1(page)).toHaveText("Ish doimiymi yoki bir martalik?");
  await choice(page, "permanent").click();
  await expect(h1(page)).toHaveText("Ish qayerda?");
  // kasbni o'zgartirish: "Orqaga" — javoblar teskari tartibda bekor bo'ladi, oxiri misollar ekrani;
  // yangi gap — kasb aytilmagan → kasb savoli tez variantlar bilan
  await page.locator("[data-guide-back]").click();
  await expect(h1(page)).toHaveText("Ish doimiymi yoki bir martalik?");
  await page.locator("[data-guide-back]").click();
  await expect(h1(page)).toHaveText("Qayerda tozalaydi?");
  await page.locator("[data-guide-back]").click();
  await expect(h1(page)).toHaveText("Qanday xodim kerak?");
  await page.locator("[data-guide-sentence]").fill("Yunusobodda ishchi kerak");
  await page.locator("[data-guide-start]").click();
  await expect(h1(page)).toHaveText("Qaysi kasb?");
  await expect(page.locator("[data-guide-choices]")).toContainText("Sotuvchi");
  await choice(page, "other").click();
  await page.locator("[data-guide-input]").fill("santexnk");
  await page.locator("[data-guide-next]").click();
  // usta — kasbga xos savol: doimiy yoki bir martalik (ega, 2026-11-24: "usta kerak desa — shunga qarab ish vaqtini so'raydi")
  await expect(h1(page)).toHaveText("Ish doimiymi yoki bir martalik?");
  await expect(page.locator("[data-guide-understood]")).toContainText("Santexnik");
  await expect(page.locator("[data-guide-understood]")).toContainText("Yunusobod");
  await choice(page, "once").click();
  await expect(h1(page)).toHaveText("Oylik qancha?");
  await choice(page, "negotiable").click();
  // bir martalik — ish grafigi ham, ish vaqti ham so'ralmaydi
  await expect(h1(page)).toHaveText("Erkak kerakmi yoki ayol?");
});

test("kasbga qarab savol (ega, 2026-11-24): gapdan guvohnoma, ish vaqti, jinsi va yosh tushuniladi — faqat qolgani so'raladi; bazada saqlanadi", async ({ page, context }) => {
  await knownEmployer();
  await loginAs(context, USERS.employer);
  await asMode(context, "employer");
  await page.goto("/post/vacancy?ai=1");
  await ready(page);
  await page.locator("[data-guide-sentence]").fill("Yunusobodga C toifa haydovchi kerak, yigitlar, 25-45 yosh, soat 8 dan 17 gacha");
  await page.locator("[data-guide-start]").click();

  // haydovchi: guvohnoma toifasi gapda bor — so'ralmaydi; mashina kimniki — so'raladi (kasbdan keyin darhol)
  await expect(h1(page)).toHaveText("Mashina kimniki bo'ladi?");
  const understood = page.locator("[data-guide-understood]");
  for (const x of ["Haydovchi", "Yunusobod", "C toifa", "08:00–17:00", "Erkak", "25–45 yosh"]) await expect(understood).toContainText(x);
  await choice(page, "own").click();
  await expect(h1(page)).toHaveText("Oylik qancha?");
  await choice(page, "6000000").click();
  await expect(h1(page)).toHaveText("Ish grafigi qanday?");
  await choice(page, "6_1").click();
  // ish vaqti, jinsi va yosh — gapdan: qayta so'ralmaydi
  await expect(h1(page)).toHaveText("Tajriba kerakmi?");
  await choice(page, "36").click();
  await expect(h1(page)).toHaveText("Qo'shimcha izoh bormi?");
  await page.locator("[data-guide-notes-skip]").click();
  await expect(h1(page)).toHaveText("E'lon matni. Ma'qulmi?");
  const desc = page.locator("[data-guide-description]");
  await expect(desc).toContainText("✅ Haydovchilik guvohnomasi: C toifa");
  await expect(desc).toContainText("✅ O'z mashinasi bilan ishlaydi");
  await choice(page, "ok").click();
  await expect(h1(page)).toHaveText("Hammasi tayyor");
  const done = page.locator("[data-guide-done]");
  for (const x of ["C toifa", "O'z mashinasi bilan", "08:00–17:00", "Erkak", "25–45 yosh"]) await expect(done).toContainText(x);
  await page.locator("[data-guide-publish]").click();
  await expect(h1(page)).toHaveText(/joylandi/i, { timeout: 20_000 });

  const [v] = await sql<{ gender: string; age_min: number; age_max: number; work_from: string; work_to: string; description: string }>(
    `select gender::text, age_min, age_max, to_char(work_time_from, 'HH24:MI') as work_from, to_char(work_time_to, 'HH24:MI') as work_to, description
       from public.vacancies where owner_profile_id = $1`,
    [USERS.employer],
  );
  expect(v).toMatchObject({ gender: "male", age_min: 25, age_max: 45, work_from: "08:00", work_to: "17:00" });
  expect(v!.description).toMatch(/✅ Haydovchilik guvohnomasi: C toifa\n✅ O'z mashinasi bilan ishlaydi$/);
});

test("IT: «masofadan» deyilgan — joy ham, «qayerda ishlaydi?» ham, ish vaqti ham so'ralmaydi", async ({ page, context }) => {
  await knownEmployer();
  await loginAs(context, USERS.employer);
  await asMode(context, "employer");
  await page.goto("/post/vacancy?ai=1");
  await ready(page);
  await page.locator("[data-guide-sentence]").fill("Frontend dasturchi kerak, masofadan");
  await page.locator("[data-guide-start]").click();
  // IT: format "masofadan" — gapdan; daraja so'raladi
  await expect(h1(page)).toHaveText("Qaysi darajadagi mutaxassis kerak?");
  await choice(page, "middle").click();
  await expect(h1(page)).toHaveText("Oylik qancha?");
  await expect(page.locator("[data-guide-understood]")).toContainText("Masofadan");
  await choice(page, "negotiable").click();
  await expect(h1(page)).toHaveText("Ish grafigi qanday?");
  await choice(page, "5_2").click();
  await expect(h1(page)).toHaveText("Erkak kerakmi yoki ayol?");
});

test("audit (ega, 2026-11-24): asosiy «E'lon berish» — savollar bilan; oddiy formada ham kasbga xos savol, jinsi, yosh, ish vaqti", async ({ page, context }) => {
  await knownEmployer();
  await loginAs(context, USERS.employer);
  await asMode(context, "employer");
  // /post/vacancy (asosiy tugma) — savollar bilan ochiladi
  await page.goto("/post/vacancy");
  await expect(h1(page)).toHaveText("Qanday xodim kerak?");
  await ready(page);
  // "Oddiy forma" — 4 qadam; 3-qadamda "Talablar"
  await page.locator("[data-guide-classic]").click();
  await expect(page).toHaveURL(/step=1/);
  await pickProfession(page, "Buxgalter", "Buxgalter");
  await next(page);
  await pickWholeRegion(page);
  await next(page);
  const req = page.locator("[data-vacancy-requirements]");
  await expect(req.locator("[data-vacancy-extra='fin_soft']")).toContainText("Qaysi dasturni bilishi kerak?");
  await req.locator("[data-vacancy-extra='fin_soft']").getByRole("radio", { name: "1C" }).click();
  await req.locator("[data-vacancy-gender]").getByRole("radio", { name: "Ayol" }).click();
  await req.locator("[data-vacancy-age]").getByRole("radio", { name: "25–45 yosh" }).click();
  await req.locator("[data-vacancy-hours]").getByRole("radio", { name: "09:00–18:00" }).click();
  await page.getByRole("radio", { name: "O'zim uchun" }).click();
  await page.locator("#org").fill("Dilnoza");
  await page.locator("#phone").fill("90 111 22 33");
  await page.locator("#desc").fill("Buxgalter kerak, hisobotlar va soliq.");
  await page.locator("#salary-from").fill("6000000");
  await next(page);
  await expect(page.getByRole("main")).toContainText("Ish vaqti: 09:00–18:00");
  await expect(page.getByRole("main")).toContainText("Jinsi: Ayol");
  await expect(page.getByRole("main")).toContainText("25–45 yosh");
  await page.getByRole("button", { name: "E'lonni joylash" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/joylandi/i, { timeout: 20_000 });
  const [v] = await sql<{ gender: string; age_min: number; age_max: number; work_from: string; description: string }>(
    "select gender::text, age_min, age_max, to_char(work_time_from, 'HH24:MI') as work_from, description from public.vacancies where owner_profile_id = $1",
    [USERS.employer],
  );
  expect(v).toMatchObject({ gender: "female", age_min: 25, age_max: 45, work_from: "09:00" });
  expect(v!.description).toMatch(/\n\n✅ 1C dasturini bilishi shart$/);
});
