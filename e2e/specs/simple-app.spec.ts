import { expect, test, type Page } from "@playwright/test";
import { USERS, asGuest, asMode, loginAs, quickSearch, sql } from "../support";

/**
 * Pastki menyu (ega, 2026-11-21, master prompt): 3 ta bo'lim — Qidiruv · E'lonlarim · Profil, ikkala rejimda bir xil.
 * "Sizga mos" (ish izlovchi) va "Arizalar" (ish beruvchi) — E'lonlarim ichida. Chatdan ochiladigan ro'yxatlar va
 * e'lonlar (/jobs, /search, /listing) — "Qidiruv" bo'limida.
 *  - kirgan foydalanuvchining asosiy ekrani — /chat ("/" ham shu yerga olib boradi);
 *  - chat rolga mos: Ish izlash (pastga strelka, yoziladi, natija; topilmasa "+ E'lon qoldiring") / E'lon berish.
 */
test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

const TABS = ["Qidiruv", "E'lonlarim", "Profil"];
const tabs = (page: Page) => page.locator("nav[data-app-tabs]");

async function nodeId(name: string) {
  const [r] = await sql<{ id: string }>("select id from public.profession_nodes where name_uz = $1 and selectable limit 1", [name]);
  return r!.id;
}

async function vacancy(title: string, profession: string) {
  const [r] = await sql<{ id: string }>("select id from public.regions where slug = 'tashkent_city'");
  await sql(
    `insert into public.vacancies (owner_profile_id, title, region_id, description, status, profession_node_id, salary_from, salary_type, published_at, expires_at)
     values ($1, $2, $3, 'Sinov e''loni: ish joyi tavsifi, grafik va shartlar', 'active', $4, 3000000, 'monthly', now(), now() + interval '10 days')`,
    [USERS.employer, title, r!.id, await nodeId(profession)],
  );
}

test.beforeEach(async () => {
  await sql("delete from public.vacancies where owner_profile_id = $1", [USERS.employer]);
});
test.afterEach(async () => {
  await sql("delete from public.vacancies where owner_profile_id = $1", [USERS.employer]);
});

test("pastki menyu — ish izlovchida: Qidiruv, E'lonlarim, Profil; «Sizga mos» — E'lonlarim ichida", async ({ page, context }) => {
  await loginAs(context, USERS.workerA);
  await asMode(context, "worker");
  await page.goto("/jobs");
  await expect(tabs(page).getByRole("link")).toHaveText(TABS);
  // ishlar ro'yxati chatdan ochiladi — "Qidiruv" bo'limi belgilanadi
  await expect(tabs(page).getByRole("link", { name: "Qidiruv" })).toHaveAttribute("aria-current", "page");
  // bo'lim ochilganda "Orqaga" yo'q
  await expect(page.getByRole("link", { name: "Orqaga" })).toHaveCount(0);
  for (const old of ["Sizga mos", "Ishlar", "Ishchilar", "Arizalar", "Bosh sahifa", "Xabarlar"]) await expect(tabs(page).getByRole("link", { name: old, exact: true })).toHaveCount(0);
  await expect(page.locator("header a[href='/ai']")).toHaveCount(0);
  // "Sizga mos" — E'lonlarim ichida
  await tabs(page).getByRole("link", { name: "E'lonlarim" }).click();
  await expect(page).toHaveURL(/\/cabinet\/elonlar$/);
  await page.locator("[data-my-listings-link='matches']").click();
  await expect(page).toHaveURL(/\/cabinet\/matches$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sizga mos ishlar");
  await expect(tabs(page).getByRole("link", { name: "E'lonlarim" })).toHaveAttribute("aria-current", "page");
});

test("pastki menyu — ish beruvchida: Qidiruv, E'lonlarim, Profil; arizalar yo'q (bog'lanish faqat telefon orqali)", async ({ page, context }) => {
  await loginAs(context, USERS.employer);
  await asMode(context, "employer");
  await page.goto("/chat");
  await expect(tabs(page).getByRole("link")).toHaveText(TABS);
  await expect(tabs(page).getByRole("link", { name: "Qidiruv" })).toHaveAttribute("aria-current", "page");
  await tabs(page).getByRole("link", { name: "E'lonlarim" }).click();
  await page.waitForURL(/\/cabinet\/elonlar$/);
  // 2026-11-21 (ega): "bir-biriga ariza topshirish bo'lmaydi" — E'lonlarimda "Arizalar" bo'limi yo'q, menyuda son belgisi yo'q
  await expect(page.locator("[data-my-listings-more]")).toHaveCount(0);
  await expect(tabs(page).locator("a span.bg-destructive")).toHaveCount(0);
  await page.goto("/search?mode=workers&any=1&region=all");
  await expect(tabs(page).getByRole("link", { name: "Qidiruv" })).toHaveAttribute("aria-current", "page");
});

test("mehmon: «Sizga mos» kirishga majburlamaydi — e'lon berishga taklif", async ({ page, context }) => {
  await asGuest(context);
  await asMode(context, "worker");
  await page.goto("/jobs");
  await expect(tabs(page).getByRole("link")).toHaveText(TABS);
  await page.goto("/cabinet/matches");
  const invite = page.locator("[data-matches-invite='worker']");
  await expect(invite).toContainText("O'zingiz haqingizda e'lon bering");
  await expect(invite.getByRole("link", { name: "E'lon berish" })).toHaveAttribute("href", "/ai/post");
});

test("kirgan foydalanuvchi: «/» → chat; salom, «Nima qilmoqchisiz?», rolga mos ikkita tugma, orqaga tugmasi yo'q", async ({ page, context }) => {
  await loginAs(context, USERS.workerA);
  await asMode(context, "worker");
  await page.goto("/");
  await expect(page).toHaveURL(/\/chat$/);
  const chat = page.locator("[data-start-chat]");
  await expect(chat).toContainText("Assalomu alaykum, Anvar!");
  await expect(chat).toContainText("Nima qilmoqchisiz?");
  await expect(chat.locator("[data-chat-choice='find']")).toContainText("Ish izlash");
  await expect(chat.locator("[data-chat-choice='post']")).toHaveText("E'lon berish");
  // ixcham: ikkita qator, tagida izoh yo'q (2026-11-21)
  await expect(chat.locator("[data-chat-choices] > *")).toHaveCount(2);
  await expect(chat.locator("[data-chat-choice='find']")).toHaveText("Ish izlash");
  // "ish yoki ishchi" degan umumiy matn yo'q
  await expect(chat).not.toContainText("Ish yoki ishchi");
  await expect(tabs(page).getByRole("link", { name: "Qidiruv" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("link", { name: "Orqaga" })).toHaveCount(0);
  // ish beruvchi ham shu ekranga — o'z tugmalari bilan
  await loginAs(context, USERS.employer);
  await asMode(context, "employer");
  await page.goto("/");
  await expect(page).toHaveURL(/\/chat$/);
  await expect(chat).toContainText("Assalomu alaykum, Dilnoza!");
  await expect(chat.locator("[data-chat-choice='find']")).toContainText("Ishchi izlash");
  await expect(chat.locator("[data-chat-choice='post']")).toContainText("Vakansiya berish");
});

test("mehmon uchun «/» — avvalgidek ochiq bosh sahifa (chatga yo'naltirilmaydi), chat ham ochiladi", async ({ page, context }) => {
  await asGuest(context);
  await asMode(context, "worker");
  await page.goto("/");
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/chat");
  await expect(page.locator("[data-start-chat]")).toContainText("Assalomu alaykum!");
});

test("Ish izlash → pastga strelka, yoziladi → so'rovnoma → haqiqiy e'lonlar; topilmasa — «+ O'zingiz haqingizda e'lon qoldiring»", async ({ page, context }) => {
  await vacancy("Buxgalter", "Buxgalter");
  await loginAs(context, USERS.workerA);
  await asMode(context, "worker");
  await page.goto("/chat");
  const chat = page.locator("[data-start-chat]");
  await expect(page.locator("form[data-hydrated]")).toHaveCount(1);
  await chat.locator("[data-chat-choice='find']").click();
  await expect(chat).toContainText("O'zingiz xohlagan ishni pastga yozing va toping.");
  await expect(chat.locator("[data-point-down]")).toBeVisible();
  // ish izlovchida "Usta" yo'q (u ish beruvchi uchun)
  await expect(chat.locator("[data-chat-choice='find_masters']")).toHaveCount(0);
  const box = page.locator("#start-chat-text");
  await box.fill("Buxgalter");
  await box.press("Enter");
  const answer = await quickSearch(page, { place: "tashkent_city" });
  await expect(answer.locator("[data-quick-found]")).toHaveText("1 ta ish topildi");
  await expect(answer.locator("article").first()).toContainText("Buxgalter");
  // topilmagan holat: o'zi haqida e'lon qoldirish tugmasi (yozgani bilan)
  await box.fill("Kosmonavt");
  await box.press("Enter");
  const none = await quickSearch(page, { place: "tashkent_city" });
  await expect(none.locator("[data-quick-none]")).toBeVisible();
  const post = none.locator("a[data-quick-post='worker']");
  await expect(post).toContainText("O'zingiz haqingizda e'lon qoldiring");
  await expect(post).toHaveAttribute("href", "/ai/post?q=Kosmonavt");
});

test("Ishchi izlash (ish beruvchi): yozish so'raladi, «Ustalar» — kichik havola", async ({ page, context }) => {
  await loginAs(context, USERS.employer);
  await asMode(context, "employer");
  await page.goto("/chat");
  const chat = page.locator("[data-start-chat]");
  await expect(page.locator("form[data-hydrated]")).toHaveCount(1);
  await chat.locator("[data-chat-choice='find']").click();
  await expect(chat).toContainText("Qanday ishchi kerak? Pastga yozing va toping.");
  // bosilgan zahoti yozish maydoni fokusda
  await expect(page.locator("#start-chat-text")).toBeFocused();
  await expect(chat.locator("[data-chat-choice='find_masters']")).toHaveAttribute("href", "/ustalar");
  await expect(page.locator("#start-chat-text")).toHaveAttribute("placeholder", "Kim kerak: kasb, tuman…");
});

test("E'lon berish (ish izlovchi) → darhol alohida ekran — yordamchi bilan o'zi haqida e'lon", async ({ page, context }) => {
  await loginAs(context, USERS.workerB);
  await asMode(context, "worker");
  await page.goto("/chat");
  await page.locator("[data-start-chat] [data-chat-choice='post']").click();
  await expect(page).toHaveURL(/\/ai\/post$/);
});

test("E'lon berish (ish beruvchi) → darhol yordamchi bilan vakansiya (alohida ekran)", async ({ page, context }) => {
  await loginAs(context, USERS.employer);
  await asMode(context, "employer");
  await page.goto("/chat");
  await page.locator("[data-start-chat] [data-chat-choice='post']").click();
  await expect(page).toHaveURL(/\/post\/vacancy\?ai=1$/);
  await expect(page.locator("#mode-gate-title")).toHaveCount(0);
  await expect(page.locator("[data-vacancy-guide]")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Qanday xodim kerak?");
});
