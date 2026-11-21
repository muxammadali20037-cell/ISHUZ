import { expect, test, type Page } from "@playwright/test";
import { USERS, asGuest, asMode, loginAs, sql } from "../support";

/**
 * 3-bosqich (master prompt; ega, 2026-11-21: "kasb, viloyat, ism, tajriba — tajriba bormi degan joyiga yozsin; raqamingizni
 * to'lagan deyilmasin"): ishchi e'loni chatning o'zida — savollar bittadan (kasb yoziladi, viloyat — tugmalar, ism yoziladi,
 * tajriba — yoziladi yoki tugma, telefon — yoziladi, majburiy), keyin tayyor e'lon kartasi, "Joylash" va uning ostida rozilik
 * yozuvi (to'lov haqida so'z yo'q). Mehmon — bir marta kirib qaytadi va o'sha karta qaytadi. Vakansiya — alohida ekran.
 */

test.use({ serviceWorkers: "block" });

test.afterEach(async () => {
  await sql("delete from public.worker_listing_phones where worker_id in (select id from public.worker_profiles where profile_id = $1)", [USERS.workerB]);
  await sql("delete from public.worker_profiles where profile_id = $1", [USERS.workerB]);
  await sql("update public.profiles set first_name = 'Botir', last_name = 'Boboyev' where id = $1", [USERS.workerB]);
});

const box = (page: Page) => page.locator("form[data-hydrated] #start-chat-text");
const lastAi = (page: Page) => page.locator("[data-guided-ai]").last();
async function send(page: Page, text: string) {
  await box(page).fill(text);
  await box(page).press("Enter");
}
const settled = (page: Page) => expect(page.locator("[data-guided-ai='thinking'], [data-guided-ai='searching']")).toHaveCount(0, { timeout: 20_000 });

test("kirgan ish izlovchi: «o'zim haqimda e'lon» → kasb → viloyat → tajriba (yozib) → telefon → karta, «Joylash» va rozilik → joylandi", async ({ page, context }) => {
  test.setTimeout(90_000);
  await sql("delete from public.worker_profiles where profile_id = $1", [USERS.workerB]);
  await loginAs(context, USERS.workerB);
  await asMode(context, "worker");
  await context.clearCookies({ name: "ib_place" });
  await page.goto("/chat");

  await send(page, "O'zim haqimda e'lon bermoqchiman");
  await settled(page);
  // alohida ekranga o'tmaydi — shu chatda, bittadan savol
  await expect(page).toHaveURL(/\/chat$/);
  await expect(lastAi(page)).toHaveAttribute("data-guided-ai", "post-profession");
  await expect(lastAi(page)).toContainText("O'zingiz haqingizda e'lonni shu yerda tayyorlaymiz");
  await expect(lastAi(page)).toContainText("Qanday ish qilasiz? Kasbingizni yozing");

  // tushunilmagan so'z — yozilganidek qaytariladi va yana so'raladi
  await send(page, "Qwertyzx");
  await settled(page);
  await expect(lastAi(page)).toHaveAttribute("data-guided-ai", "post-profession");
  await expect(lastAi(page)).toContainText("«Qwertyzx» degan kasbni tushunmadim.");

  await send(page, "oshpaz");
  await settled(page);
  // viloyat — tugmalar (yozilmaydi)
  await expect(lastAi(page)).toHaveAttribute("data-guided-ai", "post-region");
  await expect(lastAi(page)).toContainText("Qaysi viloyatda ishlamoqchisiz? Pastdan tanlang.");
  await page.locator("[data-post-region]", { hasText: "Toshkent shahri" }).click();
  await settled(page);
  // ism hisobda bor (Botir) — so'ralmaydi; tajriba — yoziladi
  await expect(lastAi(page)).toHaveAttribute("data-guided-ai", "post-experience");
  await expect(lastAi(page)).toContainText("Tajribangiz bormi?");
  await expect(lastAi(page).locator("[data-post-exp]")).toHaveCount(4);
  await send(page, "bilmadim");
  await expect(lastAi(page)).toContainText("Tushunmadim. Necha yil ishlaganingizni yozing");
  await send(page, "2 yil");
  await settled(page);
  // telefon — yoziladi, majburiy; chala bo'lsa — qayta
  await expect(lastAi(page)).toHaveAttribute("data-guided-ai", "post-phone");
  await send(page, "90 123");
  await expect(lastAi(page)).toContainText("Raqam to'liq emas.");
  await send(page, "90 123 45 67");
  await settled(page);

  // tayyor karta: kasb, ism, joy, matn, yopiq raqam; "Joylash" va ostida rozilik (to'lov haqida so'z yo'q)
  const preview = lastAi(page);
  await expect(preview).toHaveAttribute("data-guided-ai", "post-preview");
  const card = preview.locator("[data-post-card]");
  await expect(card).toContainText("Oshpaz");
  await expect(card).toContainText("Botir B.");
  await expect(card).toContainText("Toshkent shahri");
  await expect(card).toContainText("Oshpaz sifatida ish qidiryapman. Tajribam — 1–3 yil. Hudud: Toshkent shahri.");
  await expect(card.locator("[data-post-phone]")).toHaveText("+998 90 ••• •• 67");
  await expect(preview.locator("[data-post-publish]")).toHaveText("Joylash");
  const consent = preview.locator("[data-post-consent]");
  await expect(consent).toHaveText("«Joylash»ni bossangiz, e'loningiz va telefon raqamingiz ish beruvchilarga ko'rsatilishiga rozilik bildirasiz.");
  await expect(consent).not.toContainText(/to'la/i);
  // rozilik yozuvi — tugma ostida
  expect((await consent.boundingBox())!.y).toBeGreaterThan((await preview.locator("[data-post-publish]").boundingBox())!.y);
  await expect(preview.locator("[data-post-login-note]")).toHaveCount(0);

  await preview.locator("[data-post-publish]").click();
  const done = page.locator("[data-guided-ai='post-done']");
  await expect(done).toContainText("Tabriklaymiz! E'loningiz joylandi", { timeout: 30_000 });
  await expect(done.getByRole("link", { name: "E'lonlarim" })).toHaveAttribute("href", "/cabinet/elonlar");
  await expect(page.locator("[data-post-publish]")).toHaveCount(0);

  const [w] = await sql<{ name: string; experience_level: string; is_public: boolean }>(
    `select n.name_uz as name, w.experience_level::text as experience_level, w.is_public
       from public.worker_profiles w join public.profession_nodes n on n.id = w.profession_node_id where w.profile_id = $1`,
    [USERS.workerB],
  );
  expect(w).toMatchObject({ name: "Oshpaz", is_public: true });
  const phones = await sql<{ phone: string }>("select phone from public.worker_listing_phones where worker_id in (select id from public.worker_profiles where profile_id = $1)", [USERS.workerB]);
  expect(phones.map((p) => p.phone)).toContain("+998901234567");
});

test("mehmon: gapda kasb aytilgan — so'ralmaydi; ism yoziladi; «Joylash» — bir marta kirib qaytadi va o'sha karta qaytadi", async ({ page, context }) => {
  test.setTimeout(90_000);
  await sql("delete from public.worker_profiles where profile_id = $1", [USERS.workerB]);
  await asGuest(context);
  await asMode(context, "worker");
  await context.clearCookies({ name: "ib_place" });
  await page.goto("/");

  await send(page, "Men oshpazman, o'zim haqimda e'lon bermoqchiman");
  await settled(page);
  await expect(lastAi(page)).toHaveAttribute("data-guided-ai", "post-region");
  await page.locator("[data-post-region]", { hasText: "Samarqand" }).click();
  await settled(page);
  await expect(lastAi(page)).toHaveAttribute("data-guided-ai", "post-name");
  await expect(lastAi(page)).toContainText("Ismingiz nima?");
  await send(page, "90 123 45 67");
  await expect(lastAi(page)).toContainText("Ismingizni harflar bilan yozing");
  await send(page, "Mening ismim botir");
  await settled(page);
  await expect(lastAi(page)).toHaveAttribute("data-guided-ai", "post-experience");
  // tugma bilan ham bo'ladi
  await lastAi(page).locator("[data-post-exp='3plus']").click();
  await settled(page);
  await send(page, "+998 90 123 45 67");
  await settled(page);
  const preview = lastAi(page);
  await expect(preview).toHaveAttribute("data-guided-ai", "post-preview");
  await expect(preview.locator("[data-post-card]")).toContainText("Botir");
  await expect(preview.locator("[data-post-card]")).toContainText("Samarqand");
  await expect(preview.locator("[data-post-login-note]")).toHaveText("Joylash uchun bir marta kirasiz — javoblaringiz saqlanib qoladi.");

  await preview.locator("[data-post-publish]").click();
  await page.waitForURL(/\/auth/);
  const url = new URL(page.url());
  expect(url.searchParams.get("next")).toBe("/chat?post=1");
  expect(url.searchParams.get("phone")).toBe("+998901234567");

  await loginAs(context, USERS.workerB);
  await page.goto("/chat?post=1");
  // kirgach — o'sha karta; "Joylash" endi darhol joylaydi
  const back = page.locator("[data-guided-ai='post-preview']");
  await expect(back.locator("[data-post-card]")).toContainText("Tajribam — 3 yildan ko'p.");
  await expect(page).toHaveURL(/\/chat$/);
  await back.locator("[data-post-publish]").click();
  await expect(page.locator("[data-guided-ai='post-done']")).toContainText("Tabriklaymiz! E'loningiz joylandi", { timeout: 30_000 });
});

test("guruh kasbi («men o'qituvchiman») — «aynan qaysi biri?» tugmalari; yangi maqsad yozilsa e'lon to'xtaydi", async ({ page, context }) => {
  await loginAs(context, USERS.workerB);
  await asMode(context, "worker");
  await page.goto("/chat");
  await send(page, "O'zim haqimda e'lon bermoqchiman");
  await settled(page);
  await send(page, "men o'qituvchiman");
  await settled(page);
  await expect(lastAi(page)).toHaveAttribute("data-guided-ai", "post-which");
  await expect(lastAi(page)).toContainText("Aynan qanday o'qituvchisiz?");
  await lastAi(page).locator("[data-post-choice]", { hasText: "Matematika o'qituvchisi" }).click();
  await settled(page);
  await expect(page.locator("[data-ai-you]").last()).toHaveText("Siz: Matematika o'qituvchisi");
  await expect(lastAi(page)).toHaveAttribute("data-guided-ai", /^post-(region|experience)$/);

  // e'lon o'rniga qidirmoqchi bo'lsa — oddiy so'rov
  await send(page, "Menga Toshkentdan haydovchi kerak");
  await settled(page);
  await expect(lastAi(page)).toHaveAttribute("data-guided-ai", /^(results|none)$/);
});

test("«E'lonlarim» → «+ E'lon joylash» — chatda savollar darhol boshlanadi; vakansiya — alohida ekran", async ({ page, context }) => {
  await loginAs(context, USERS.workerB);
  await asMode(context, "worker");
  await page.goto("/cabinet/elonlar");
  await page.locator("main [data-my-listings-post]").click();
  await page.waitForURL((u) => new URL(u).pathname === "/chat");
  await expect(page.locator("[data-ai-you]").first()).toHaveText("Siz: O'zim haqimda e'lon bermoqchiman");
  await expect(lastAi(page)).toHaveAttribute("data-guided-ai", "post-profession");

  await send(page, "Vakansiya joylamoqchiman");
  await settled(page);
  await expect(lastAi(page)).toHaveAttribute("data-guided-ai", "post");
  await expect(page.locator("[data-guided-post-to='employer']")).toHaveAttribute("href", /^\/post\/vacancy\?ai=1/);
});
