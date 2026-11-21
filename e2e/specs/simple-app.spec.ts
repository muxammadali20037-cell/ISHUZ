import { expect, test, type Page } from "@playwright/test";
import { USERS, asGuest, asMode, loginAs, sql } from "../support";

/**
 * Pastki menyu (ega, 2026-11-21, master prompt): 3 ta bo'lim — Qidiruv · E'lonlarim · Profil, ikkala rejimda bir xil.
 * "Sizga mos" (ish izlovchi) va "Arizalar" (ish beruvchi) — E'lonlarim ichida. Chatdan ochiladigan ro'yxatlar va
 * e'lonlar (/jobs, /search, /listing) — "Qidiruv" bo'limida.
 *  - asosiy ekran — chat: kirgan foydalanuvchi /chat ga ("/" yo'naltiradi), mehmonga "/" ning o'zi chat;
 *  - AI maqsadni matndan aniqlaydi, yetishmaganini bittadan so'raydi (batafsil — guided-chat.spec.ts).
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
  // 2026-11-21 (3-bosqich): e'lon chatning o'zida
  await expect(invite.getByRole("link", { name: "E'lon berish" })).toHaveAttribute("href", "/chat?post=new");
});

test("kirgan foydalanuvchi: «/» → chat; bitta yozuv va strelka, ko'rsatma rolga qarab, orqaga tugmasi yo'q", async ({ page, context }) => {
  await loginAs(context, USERS.workerA);
  await asMode(context, "worker");
  await page.goto("/");
  await expect(page).toHaveURL(/\/chat$/);
  const chat = page.locator("[data-start-chat]");
  // 2026-11-21 kechqurun (ega): "ortiqcha narsalar kerakmas" — bitta yozuv va pastga strelka; qatorlar, misollar yo'q
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("O'zingizga mos ishni yoki ishchini toping");
  await expect(chat.locator("[data-guided-arrow]")).toBeVisible();
  await expect(chat.locator("[data-chat-choices], [data-guided-example]")).toHaveCount(0);
  await expect(page.locator("#start-chat-text")).toHaveAttribute("placeholder", "Masalan: men oshpazman");
  await expect(tabs(page).getByRole("link", { name: "Qidiruv" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("link", { name: "Orqaga" })).toHaveCount(0);
  // ish beruvchi ham shu ekranga — o'z savoli bilan
  await loginAs(context, USERS.employer);
  await asMode(context, "employer");
  await page.goto("/");
  await expect(page).toHaveURL(/\/chat$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("O'zingizga mos ishni yoki ishchini toping");
  await expect(page.locator("#start-chat-text")).toHaveAttribute("placeholder", "Masalan: menga sotuvchi kerak");
});

test("mehmon uchun «/» — darhol chat (yo'naltirishsiz); /chat ham o'sha", async ({ page, context }) => {
  await asGuest(context);
  await page.goto("/");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("O'zingizga mos ishni yoki ishchini toping");
  await page.goto("/chat");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("O'zingizga mos ishni yoki ishchini toping");
});

test("ish izlovchi: kasb → hudud (tugma) → haqiqiy e'lonlar; topilmasa — «+ O'zingiz haqingizda e'lon qoldiring»", async ({ page, context }) => {
  await vacancy("Buxgalter", "Buxgalter");
  await loginAs(context, USERS.workerA);
  await asMode(context, "worker");
  await context.clearCookies({ name: "ib_place" });
  await page.goto("/chat");
  await expect(page.locator("form[data-hydrated]")).toHaveCount(1);
  const box = page.locator("#start-chat-text");
  const settled = () => expect(page.locator("[data-guided-ai='thinking'], [data-guided-ai='searching']")).toHaveCount(0, { timeout: 20_000 });
  const last = () => page.locator("[data-guided-ai]").last();
  // ish izlovchida "Universal ustalar" havolasi yo'q (u ishchi qidiruvchilar uchun)
  await expect(page.locator("[data-chat-choice='find_masters']")).toHaveCount(0);
  await box.fill("Buxgalter");
  await box.press("Enter");
  await settled();
  await expect(last()).toHaveAttribute("data-guided-ai", "ask-place");
  await page.locator("[data-guided-place='tashkent_city']").click();
  await settled();
  await expect(last()).toHaveAttribute("data-guided-ai", "results");
  await expect(last()).toContainText("Mana, 1 ta ish topdim:");
  await expect(last().locator("article").first()).toContainText("Buxgalter");
  // topilmagan holat: tushunilmagan kasb — bir marta aniqlashtiriladi; keyin o'sha so'z bilan qidiriladi
  await box.fill("Kosmonavt");
  await box.press("Enter");
  await settled();
  await expect(last()).toHaveAttribute("data-guided-ai", "ask-profession");
  await expect(last()).toContainText("«Kosmonavt» degan kasbni tushunmadim.");
  await box.fill("Kosmonavt");
  await box.press("Enter");
  await settled();
  await expect(last()).toHaveAttribute("data-guided-ai", "none");
  // "O'zingiz haqingizda e'lon qoldiring" — shu chatda, qidirilgan so'z bilan boshlanadi (3-bosqich)
  const post = last().locator("[data-quick-post='worker']");
  await expect(post).toContainText("O'zingiz haqingizda e'lon qoldiring");
  // telefon emulyatsiyasi: yozish maydoni fokusda (klaviatura "ochiq", pastki menyu yashirin) — sichqoncha bosganda fokus
  // ketib, menyu qaytadi va tugma joyidan siljiydi; haqiqiy telefonda bosish tegilgan joyga tushadi. Avval klaviatura yopiladi
  await page.locator("#start-chat-text").blur();
  await expect(page.locator("nav.bottom-nav")).toBeVisible();
  await post.click();
  await settled();
  await expect(last()).toHaveAttribute("data-guided-ai", "post-profession");
  await expect(last()).toContainText("«Kosmonavt» degan kasbni tushunmadim.");
  await expect(page).toHaveURL(/\/chat$/);
});

test("«Universal ustalar» — Profilda (chat juda sodda; ega, 2026-11-21: «Profil ichiga»), mehmonga ham", async ({ page, context }) => {
  await asGuest(context);
  await page.goto("/cabinet");
  await expect(page.locator("main [data-cabinet-masters]")).toHaveAttribute("href", "/ustalar");
  await loginAs(context, USERS.employer);
  await asMode(context, "employer");
  await page.goto("/chat");
  await expect(page.locator("[data-start-chat] [data-chat-choice='find_masters']")).toHaveCount(0);
  await page.goto("/cabinet");
  await page.locator("main [data-fold='more'] [data-fold-toggle]").click();
  const row = page.locator("main [data-cabinet-masters]");
  await expect(row).toContainText("Universal ustalar");
  await row.click();
  await expect(page).toHaveURL(/\/ustalar$/);
});

test("E'lon berish (ish izlovchi): «O'zim haqimda e'lon bermoqchiman» → shu chatda savollar (3-bosqich; to'liq yo'l — chat-post.spec)", async ({ page, context }) => {
  await loginAs(context, USERS.workerB);
  await asMode(context, "worker");
  await page.goto("/chat");
  const box = page.locator("form[data-hydrated] #start-chat-text");
  await box.fill("O'zim haqimda e'lon bermoqchiman");
  await box.press("Enter");
  // alohida ekranga o'tmaydi — shu chatda "Qanday ish qilasiz?"
  await expect(page.locator("[data-guided-ai]").last()).toHaveAttribute("data-guided-ai", "post-profession");
  await expect(page.locator("[data-guided-ai]").last()).toContainText("Qanday ish qilasiz?");
  await expect(page).toHaveURL(/\/chat$/);
});

test("E'lon berish (ish beruvchi): «Vakansiya joylamoqchiman» → yordamchi bilan vakansiya (alohida ekran)", async ({ page, context }) => {
  await loginAs(context, USERS.employer);
  await asMode(context, "employer");
  await page.goto("/chat");
  const box = page.locator("form[data-hydrated] #start-chat-text");
  await box.fill("Vakansiya joylamoqchiman");
  await box.press("Enter");
  await expect(page.locator("[data-guided-post-to='worker']")).toHaveCount(0);
  await page.locator("[data-guided-post-to='employer']").click();
  await expect(page).toHaveURL(/\/post\/vacancy\?ai=1/);
  await expect(page.locator("#mode-gate-title")).toHaveCount(0);
  await expect(page.locator("[data-vacancy-guide]")).toBeVisible();
});
