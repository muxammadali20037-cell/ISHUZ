import { expect, test, type Page } from "@playwright/test";
import { USERS, asGuest, asMode, loginAs } from "../support";

/**
 * Chat ketma-ketligi (ega, 2026-11-22): bo'sh ekranda ikki katta tugma — «Ish qidiryapman» / «Ishchi qidiryapman»; keyin kasb
 * (avval 3 tasi + «Hammasini ko'rish» + qidiruv) → viloyat (3 tasi + qolgani + qidiruv) → «Endi nima qilamiz?»:
 * ish izlovchiga — mavjud e'lonlar yoki o'zi haqida e'lon; ish beruvchiga — mavjud ishchilar yoki vakansiya joylash.
 * Video-tushuntirish: birinchi marta ochiq, yopilsa — «Qanday ishlaydi?» qatori.
 */

async function blurComposer(page: Page) {
  await page.locator("#start-chat-text").blur();
}

test("ish izlovchi: 2 tugma → kasb (3 ta, qidiruv) → viloyat (3 ta, qidiruv) → «Endi nima qilamiz?» → mavjud e'lonlar", async ({ page, context }) => {
  await asGuest(context);
  await context.clearCookies({ name: "ib_mode" });
  await page.goto("/");
  const empty = page.locator("[data-guided-empty]");
  await expect(empty.getByRole("heading", { level: 1 })).toHaveText("Ish yoki ishchini oson toping");
  // video-tushuntirish ko'rilgan (cookie) — yig'ilgan qator
  await expect(empty.locator("[data-intro-open]")).toContainText("Qanday ishlaydi?");
  await expect(empty.locator("[data-guided-start]")).toHaveCount(2);
  await empty.locator("[data-guided-start='jobs']").click();

  // kasb: savol, 3 ta tugma, "Hammasini ko'rish", qidiruv
  const prof = page.locator("[data-guided-ai='ask-profession']");
  await expect(prof).toContainText("Kasbingiz qanday? Pastdan tanlang yoki yozing.");
  await expect(prof.locator("[data-guided-prof]")).toHaveCount(3);
  await expect(prof.locator("[data-choice-all]")).toContainText("Hammasini ko'rish");
  await prof.locator("[data-choice-search]").fill("buxg");
  await prof.locator("[data-guided-prof]", { hasText: "Buxgalter" }).first().click();

  // viloyat: 3 tasi (Butun O'zbekiston birinchi), qolgani — qidiruv bilan
  const place = page.locator("[data-guided-ai='ask-place']");
  await expect(place.locator("[data-guided-place]")).toHaveCount(3);
  await expect(place.locator("[data-guided-place]").first()).toHaveAttribute("data-guided-place", "all");
  await expect(place.locator("[data-guided-place='samarkand']")).toHaveCount(0);
  await place.locator("[data-choice-search]").fill("samar");
  await place.locator("[data-guided-place='samarkand']").click();

  // keyingi qadam: tanlov (darhol qidirilmaydi)
  const next = page.locator("[data-guided-ai='next']");
  await expect(next).toContainText("Endi nima qilamiz?");
  await expect(next.locator("[data-guided-summary]")).toContainText("Buxgalter");
  await expect(next.locator("[data-guided-summary]")).toContainText("Samarqand");
  await expect(page.locator("[data-guided-ai='results'], [data-guided-ai='none']")).toHaveCount(0);
  await expect(next.locator("[data-guided-next-to='post']")).toContainText("O'zim haqimda e'lon berish");
  await blurComposer(page);
  await next.locator("[data-guided-next-to='see']").click();
  await expect(page.locator("[data-guided-ai='results'], [data-guided-ai='none']").last()).toBeVisible();
  // rol tugma bilan tanlandi — rejim ham yozildi
  await expect.poll(async () => (await context.cookies()).find((c) => c.name === "ib_mode")?.value).toBe("worker");
});

test("ish izlovchi: «O'zim haqimda e'lon berish» — kasb va viloyat bilan, keyingi savol — ism", async ({ page, context }) => {
  await asGuest(context);
  await asMode(context, "worker");
  await page.goto("/");
  await page.locator("[data-guided-start='jobs']").click();
  const prof = page.locator("[data-guided-ai='ask-profession']");
  await prof.locator("[data-choice-search]").fill("buxg");
  await prof.locator("[data-guided-prof]", { hasText: "Buxgalter" }).first().click();
  const place = page.locator("[data-guided-ai='ask-place']");
  await place.locator("[data-choice-search]").fill("samar");
  await place.locator("[data-guided-place='samarkand']").click();
  await blurComposer(page);
  await page.locator("[data-guided-next-to='post']").click();
  await expect(page.locator("[data-guided-ai='post-name']")).toBeVisible();
});

test("ish beruvchi: «Ishchi qidiryapman» → … → «Vakansiya joylash» — kasb bilan yordamchiga", async ({ page, context }) => {
  await loginAs(context, USERS.employer);
  await asMode(context, "employer");
  await page.goto("/chat");
  await page.locator("[data-guided-start='workers']").click();
  const prof = page.locator("[data-guided-ai='ask-profession']");
  await expect(prof).toContainText("Qanday ishchi kerak?");
  await prof.locator("[data-choice-search]").fill("buxg");
  await prof.locator("[data-guided-prof]", { hasText: "Buxgalter" }).first().click();
  await page.locator("[data-guided-ai='ask-place'] [data-guided-place='all']").click();
  const next = page.locator("[data-guided-ai='next']");
  await expect(next.locator("[data-guided-next-to='see']")).toContainText("Mavjud ishchilarni ko'rish");
  await expect(next.locator("[data-guided-next-to='vacancy']")).toHaveAttribute("href", /^\/post\/vacancy\?ai=1&q=Buxgalter$/);
});

test("«aynan qanday o'qituvchisiz?» — avval 3 tasi, «Hammasini ko'rish» bilan hammasi, qidiruv bilan topiladi", async ({ page, context }) => {
  await asGuest(context);
  await asMode(context, "worker");
  await page.goto("/chat?post=new");
  const ask = page.locator("[data-guided-ai='post-profession']");
  await expect(ask).toBeVisible();
  await page.locator("#start-chat-text").fill("o'qituvchiman");
  await page.locator("#start-chat-text").press("Enter");
  const which = page.locator("[data-guided-ai='post-which']");
  await expect(which.locator("[data-post-choice]")).toHaveCount(3);
  const total = Number((await which.locator("[data-choice-all]").innerText()).match(/(\d+)/)![1]);
  expect(total).toBeGreaterThan(3);
  await blurComposer(page);
  await which.locator("[data-choice-all]").click();
  await expect(which.locator("[data-post-choice]")).toHaveCount(total);
  await which.locator("[data-choice-all]").click();
  await which.locator("[data-choice-search]").fill("ingliz");
  await expect(which.locator("[data-post-choice]").first()).toContainText(/ingliz/i);
});

test("e'lon niyati, rol shu suhbatda tanlanmagan — ikkala variant (rejimdan taxmin qilinmaydi)", async ({ page, context }) => {
  await loginAs(context, USERS.employer);
  await asMode(context, "employer");
  await page.goto("/chat");
  await page.locator("#start-chat-text").fill("e'lon joylamoqchiman");
  await page.locator("#start-chat-text").press("Enter");
  const post = page.locator("[data-guided-ai='post']");
  await expect(post.locator("[data-guided-post-to='worker']")).toBeVisible();
  await expect(post.locator("[data-guided-post-to='employer']")).toBeVisible();
});

test("video-tushuntirish: birinchi marta ochiq, ko'rsatiladi (yozuv almashadi), yopilsa — «Qanday ishlaydi?» va eslab qolinadi", async ({ page, context }) => {
  await asGuest(context);
  await context.clearCookies({ name: "ib_intro_v" });
  await page.goto("/");
  const intro = page.locator("[data-intro]");
  await expect(intro).toBeVisible();
  await expect(intro.locator("[data-intro-ask]")).toBeVisible();
  await expect(intro.locator("[data-intro-caption]")).toHaveText("Assalomu alaykum! Biz sizni ko'rganimizdan mamnunmiz.");
  // ovoz (ega yuborgan, erkak ovozi) — ruxsat so'raladi: "Ha" / "Ovozsiz"; fayl joyida
  await expect(intro.locator("[data-intro-sound='on']")).toBeVisible();
  await expect(intro.locator("audio")).toHaveAttribute("src", "/audio/intro-uz.mp3");
  expect((await page.request.get("/audio/intro-uz.mp3")).status()).toBe(200);
  await intro.locator("[data-intro-sound='off']").click();
  await expect(intro).toHaveAttribute("data-intro-phase", "playing");
  await expect(intro.locator("[data-intro-caption]")).toHaveText("Bu — Ish topdim: bu yerda ish ham, ishchi ham topiladi.", { timeout: 8_000 });
  // rol tugmalari baribir ekranda
  await expect(page.locator("[data-guided-start]")).toHaveCount(2);
  await intro.locator("[data-intro-close]").click();
  await expect(page.locator("[data-intro-open]")).toBeVisible();
  expect((await context.cookies()).find((c) => c.name === "ib_intro_v")?.value).toBe("1");
  await page.reload();
  await expect(page.locator("[data-intro]")).toHaveCount(0);
  await expect(page.locator("[data-intro-open]")).toBeVisible();
});
