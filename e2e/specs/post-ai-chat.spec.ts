import { expect, test, type Page } from "@playwright/test";
import { USERS, asGuest, asMode, formReady, loginAs } from "../support";

/**
 * "Tez va qulay e'lon — AI yordamchi bilan" (ish izlovchi, 1-qadam): bir gap → yordamchi kerakli narsalarni birma-bir so'raydi
 * (tugmalar yoki matn) → oxirida qoralama to'ldiriladi va tekshirish sahifasi ochiladi. Stendda AI kaliti yo'q — lug'at rejimi.
 */
const chat = (page: Page) => page.locator("[data-listing-chat]");
const lastBot = (page: Page) => chat(page).locator("[data-chat-msg=bot]").last();
const chip = (page: Page, label: string | RegExp) => chat(page).locator("[data-chat-chips]").getByRole("button", { name: label });

async function answer(page: Page, text: string) {
  await chat(page).getByLabel("Javobingiz").fill(text);
  await chat(page).getByRole("button", { name: "Yuborish" }).click();
}

test("mehmon: 'kuryerlikdan ish qidirmoqchiman' → kasb variantlari → joy, tajriba, grafik, maosh, ism, telefon → tekshirish", async ({ page, context }) => {
  await asGuest(context);
  await asMode(context, "worker");
  await page.goto("/post/worker");
  await formReady(page);
  await expect(page.getByRole("region", { name: "Tez va qulay e'lon — AI yordamchi bilan" })).toBeVisible();
  // sahifaning asosiy sarlavhasi — kasb savoli (karta sarlavha tartibini buzmaydi)
  await expect(page.getByRole("heading", { level: 1 }).or(page.getByRole("heading", { level: 2 })).first()).toContainText("Qaysi kasb bo'yicha ish qidiryapsiz?");
  // oddiy usul ham shu sahifada
  await expect(page.getByLabel("Kasb yoki sohani qidiring")).toBeVisible();

  await chat(page).getByLabel("AI yordamchiga yozing: qanday ish qidiryapsiz?").fill("Men kuryerlikdan ish qidirmoqchiman");
  await chat(page).getByRole("button", { name: "Boshlash" }).click();
  // suhbat ochildi — kasblar ro'yxati yashirindi (ekran ikkiga bo'linmaydi)
  await expect(page.getByLabel("Kasb yoki sohani qidiring")).toHaveCount(0);
  await expect(chat(page).locator("[data-chat-msg=you]").first()).toHaveText("Men kuryerlikdan ish qidirmoqchiman");
  // "kuryer" — bir nechta kasb: o'zi tanlamaydi, so'raydi (dispetcher emas)
  await expect(lastBot(page)).toContainText("Aniqrog'i qaysi biri?");
  await expect(chip(page, "Moto kuryer")).toBeVisible();
  await expect(chip(page, /dispetcher/i)).toHaveCount(0);
  await chip(page, "Moto kuryer").click();
  await expect(lastBot(page)).toContainText("Kasb: Moto kuryer ✓");
  await expect(lastBot(page)).toContainText("Qaysi viloyat yoki shaharda ishlamoqchisiz?");

  // joy: matn bilan ("Chilonzor" — viloyat va tuman birga tushuniladi)
  await answer(page, "Toshkent, Chilonzor");
  await expect(lastBot(page)).toContainText("Joy: Toshkent shahri, Chilonzor tumani ✓");
  await expect(lastBot(page)).toContainText("Bu ishda tajribangiz qancha?");
  await chip(page, "1–3 yil").click();
  await expect(lastBot(page)).toContainText("Qaysi ish grafigi sizga qulay?");
  await chip(page, "Smenali").click();
  await expect(lastBot(page)).toContainText("Oyiga qancha maosh kutyapsiz?");
  // tushunilmagan javob — savol qayta beriladi
  await answer(page, "ko'proq");
  await expect(lastBot(page)).toContainText("Summani tushunmadim.");
  await answer(page, "6 mln");
  await expect(lastBot(page)).toContainText("Maosh:");
  await expect(lastBot(page)).toContainText("Ismingiz nima?");
  await answer(page, "Mening ismim Aziz");
  await expect(lastBot(page)).toContainText("Ism: Aziz ✓");
  await answer(page, "123");
  await expect(lastBot(page)).toContainText("Raqamni tushunmadim.");
  await answer(page, "90 123 45 67");
  await expect(lastBot(page)).toContainText("Oxirgi savol");
  await chip(page, "Javoblarimdan tuzib ber").click();
  await expect(lastBot(page)).toContainText("Tayyor!");

  const summary = chat(page).locator("[data-chat-summary]");
  await expect(summary).toContainText("Moto kuryer");
  await expect(summary).toContainText("Toshkent shahri, Chilonzor tumani");
  await expect(summary).toContainText("Smenali");
  await summary.getByRole("button", { name: "Tekshirish va joylash" }).click();

  // tekshirish sahifasi: hammasi qoralamada, "AI tayyorladi" belgisi, hech narsa o'zi joylanmagan
  await expect(page.getByRole("heading", { name: "E'loningizni tekshiring" })).toBeVisible();
  const main = page.getByRole("main");
  await expect(main).toContainText("AI e'loningizni tayyorladi");
  await expect(main).toContainText("Moto kuryer");
  await expect(main).toContainText("Chilonzor tumani");
  await expect(main).toContainText("Aziz");
  await expect(main).toContainText("Moto kuryer bo'lib ishlamoqchiman. Tajribam: 1–3 yil. Ish joyi: Toshkent shahri, Chilonzor tumani. Qulay grafik: Smenali.");
  await expect(page.getByRole("button", { name: "Kirish va e'lonni joylash" })).toBeVisible();
});

test("kirgan ish izlovchi: ism va telefon profildan — so'ralmaydi; taqiqlangan matn qabul qilinmaydi; qaytadan boshlash", async ({ page, context }) => {
  await loginAs(context, USERS.workerB, "aal2");
  await asMode(context, "worker");
  await page.goto("/post/worker");
  await formReady(page);
  await chat(page).getByLabel("AI yordamchiga yozing: qanday ish qidiryapsiz?").fill("giyohvand sotaman");
  await chat(page).getByRole("button", { name: "Boshlash" }).click();
  await expect(lastBot(page)).toContainText("faqat ish va ishchi qidirish e'lonlarini qabul qiladi");
  await chat(page).locator("[data-chat-restart]").click();
  await expect(page.getByLabel("Kasb yoki sohani qidiring")).toBeVisible();

  await chat(page).getByLabel("AI yordamchiga yozing: qanday ish qidiryapsiz?").fill("Samarqandda oshpaz bo'lib ishlamoqchiman, 3 yil tajribam bor");
  await chat(page).getByRole("button", { name: "Boshlash" }).click();
  // birinchi gapdan: kasb, viloyat, tajriba — qayta so'ralmaydi
  await expect(lastBot(page)).toContainText("Kasb: Oshpaz ✓");
  await expect(lastBot(page)).toContainText("Tajriba: 3 yildan ko'p ✓");
  await expect(lastBot(page)).toContainText(/Samarqand[^:\n]*: qaysi tumanda\?/);
  await chip(page, "Butun viloyat").click();
  await chip(page, "Farqi yo'q").click();
  await chip(page, "Kelishiladi").click();
  // ism va telefon profildan — to'g'ridan-to'g'ri oxirgi savol
  await expect(lastBot(page)).toContainText("Oxirgi savol");
  await answer(page, "Milliy taomlar, osh va somsa tayyorlayman");
  await expect(lastBot(page)).toContainText("Tayyor!");
});
