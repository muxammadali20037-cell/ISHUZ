import { expect, test, type Page } from "@playwright/test";
import { USERS, asGuest, asMode, homeSearch, loginAs, sql } from "../support";

/**
 * Pastki menyu (ega, 2026-11-21, master prompt): Qidiruv · E'lonlarim · Profil, ikkala rejimda bir xil; 2026-11-23 (ega) —
 * boshida "Bosh sahifa" ("/", kirgan foydalanuvchi ham shu yerda; suhbat — /chat).
 * "Arizalar" (ish beruvchi) — E'lonlarim ichida; "Sizga mos" 2026-11-22 dan yo'q. Chatdan ochiladigan ro'yxatlar va
 * e'lonlar (/jobs, /search, /listing) — "Qidiruv" bo'limida.
 *  - kirgandan keyin — chat (/chat); "/" — Bosh sahifa (qidiruv va tugmalar /chat da yangi suhbat ochadi);
 *  - AI maqsadni matndan aniqlaydi, yetishmaganini bittadan so'raydi (batafsil — guided-chat.spec.ts).
 */
test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

const TABS = ["Bosh sahifa", "Qidiruv", "E'lonlarim", "Profil"];
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

test("pastki menyu — ish izlovchida: Qidiruv, E'lonlarim, Profil; «Sizga mos» yo'q", async ({ page, context }) => {
  await loginAs(context, USERS.workerA);
  await asMode(context, "worker");
  await page.goto("/jobs");
  await expect(tabs(page).getByRole("link")).toHaveText(TABS);
  // ishlar ro'yxati chatdan ochiladi — "Qidiruv" bo'limi belgilanadi
  await expect(tabs(page).getByRole("link", { name: "Qidiruv" })).toHaveAttribute("aria-current", "page");
  // bo'lim ochilganda "Orqaga" yo'q
  await expect(page.getByRole("link", { name: "Orqaga" })).toHaveCount(0);
  for (const old of ["Sizga mos", "Ishlar", "Ishchilar", "Arizalar", "Xabarlar"]) await expect(tabs(page).getByRole("link", { name: old, exact: true })).toHaveCount(0);
  await expect(page.locator("header a[href='/ai']")).toHaveCount(0);
  // "Sizga mos" olib tashlandi (ega, 2026-11-22: "moslik umuman kerak emas") — E'lonlarimda ham yo'q
  await tabs(page).getByRole("link", { name: "E'lonlarim" }).click();
  await expect(page).toHaveURL(/\/cabinet\/elonlar$/);
  await expect(page.locator("[data-my-listings-link='matches']")).toHaveCount(0);
  await expect(page.getByRole("main")).not.toContainText("Sizga mos");
  // eski havola — E'lonlarimga
  await page.goto("/cabinet/matches");
  await expect(page).toHaveURL(/\/cabinet\/elonlar$/);
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

test("mehmon: eski «Sizga mos» havolasi — E'lonlarimga (u yerdan kirishga)", async ({ page, context }) => {
  await asGuest(context);
  await asMode(context, "worker");
  await page.goto("/jobs");
  await expect(tabs(page).getByRole("link")).toHaveText(TABS);
  await page.goto("/cabinet/matches");
  await page.waitForURL(/\/auth/);
  expect(new URL(page.url()).searchParams.get("next")).toBe("/cabinet/elonlar");
});

test("kirgan foydalanuvchi: «/» — Bosh sahifa (qidiruv qatori, uchta tugma); /chat — bitta yozuv va strelka, ko'rsatma rolga qarab", async ({ page, context }) => {
  await loginAs(context, USERS.workerA);
  await asMode(context, "worker");
  // 2026-11-23 (ega): pastki menyuda "Bosh sahifa" — kirgan foydalanuvchi ham "/" da qoladi
  await page.goto("/");
  await expect(page).toHaveURL(/\/$/);
  const home = page.locator("main [data-start-home]");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ishingiz shu yerdan boshlanadi!");
  await expect(home.locator("[data-guided-start]")).toHaveCount(3);
  await expect(home.locator("[data-chat-choices], [data-guided-example]")).toHaveCount(0);
  await expect(page.locator("[data-home-q]")).toHaveAttribute("placeholder", "Yozing, o'zingizga mosini toping");
  // Bosh sahifada suhbat maydoni yo'q — u "Qidiruv" (/chat) da
  await expect(page.locator("#start-chat-text")).toHaveCount(0);
  await expect(tabs(page).getByRole("link", { name: "Bosh sahifa" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("link", { name: "Orqaga" })).toHaveCount(0);
  await tabs(page).getByRole("link", { name: "Qidiruv" }).click();
  await page.waitForURL(/\/chat$/);
  await expect(page.locator("#start-chat-text")).toHaveAttribute("placeholder", "Masalan: men oshpazman");
  await expect(tabs(page).getByRole("link", { name: "Qidiruv" })).toHaveAttribute("aria-current", "page");
  // ish beruvchi ham shu ekranga — o'z savoli bilan
  await loginAs(context, USERS.employer);
  await asMode(context, "employer");
  await page.goto("/");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ishingiz shu yerdan boshlanadi!");
  await expect(page.locator("[data-home-q]")).toHaveAttribute("placeholder", "Yozing, o'zingizga mosini toping");
  await page.goto("/chat");
  await expect(page.locator("#start-chat-text")).toHaveAttribute("placeholder", "Masalan: menga sotuvchi kerak");
});

test("mehmon uchun «/» — darhol chat (yo'naltirishsiz); /chat ham o'sha", async ({ page, context }) => {
  await asGuest(context);
  await page.goto("/");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ishingiz shu yerdan boshlanadi!");
  await page.goto("/chat");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ishingiz shu yerdan boshlanadi!");
});

test("ish izlovchi: kasb → hudud (tugma) → haqiqiy e'lonlar; topilmasa — «+ O'zingiz haqingizda e'lon qoldiring»", async ({ page, context }) => {
  await vacancy("Buxgalter", "Buxgalter");
  await loginAs(context, USERS.workerA);
  await asMode(context, "worker");
  await context.clearCookies({ name: "ib_place" });
  await page.goto("/chat");
  await expect(page.locator("form[data-home-search][data-hydrated]")).toBeVisible();
  const box = page.locator("#start-chat-text");
  const settled = () => expect(page.locator("[data-guided-ai='thinking'], [data-guided-ai='searching']")).toHaveCount(0, { timeout: 20_000 });
  const last = () => page.locator("[data-guided-ai]").last();
  // ish izlovchida "Universal ustalar" havolasi yo'q (u ishchi qidiruvchilar uchun)
  await expect(page.locator("[data-chat-choice='find_masters']")).toHaveCount(0);
  // 2026-11-23: bosh ekrandagi qidiruv qatori — kasb va viloyat bir joyda, savolsiz natija
  await homeSearch(page, "Buxgalter", "tashkent_city");
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
  // savolga javob berildi — avval tanlov, keyin natija (topilmadi)
  await expect(last()).toHaveAttribute("data-guided-ai", "next");
  await box.blur();
  await last().locator("[data-guided-next-to='see']").click();
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

test("«Universal ustalar» — hozircha yashirin (ega, 2026-11-24): Profilda yo'q, eski havola (/ustalar) esa ochilaveradi", async ({ page, context }) => {
  await asGuest(context);
  await page.goto("/cabinet");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator("main [data-cabinet-masters]")).toHaveCount(0);
  await loginAs(context, USERS.employer);
  await asMode(context, "employer");
  await page.goto("/chat");
  await expect(page.locator("[data-start-chat] [data-chat-choice='find_masters']")).toHaveCount(0);
  await expect(page.locator("[data-home-quick] a[href='/ustalar']")).toHaveCount(0);
  await page.goto("/cabinet");
  await page.locator("main [data-fold='more'] [data-fold-toggle]").click();
  await expect(page.locator("main [data-cabinet-masters]")).toHaveCount(0);
  await expect(page.locator("[data-masters-entry]")).toHaveCount(0);
  // e'lonlar bazada qoladi — to'g'ridan-to'g'ri havola ishlaydi
  await page.goto("/ustalar");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("E'lon berish (ish izlovchi): «O'zim haqimda e'lon bermoqchiman» → shu chatda savollar (3-bosqich; to'liq yo'l — chat-post.spec)", async ({ page, context }) => {
  await loginAs(context, USERS.workerB);
  await asMode(context, "worker");
  await page.goto("/chat");
  await homeSearch(page, "O'zim haqimda e'lon bermoqchiman");
  // alohida ekranga o'tmaydi — shu chatda "Qanday ish qilasiz?"
  await expect(page.locator("[data-guided-ai]").last()).toHaveAttribute("data-guided-ai", "post-profession");
  await expect(page.locator("[data-guided-ai]").last()).toContainText("Qanday ish qilasiz?");
  await expect(page).toHaveURL(/\/chat$/);
});

test("E'lon berish (ish beruvchi): «Vakansiya joylamoqchiman» → yordamchi bilan vakansiya (alohida ekran)", async ({ page, context }) => {
  await loginAs(context, USERS.employer);
  await asMode(context, "employer");
  await page.goto("/chat");
  await homeSearch(page, "Vakansiya joylamoqchiman");
  await expect(page.locator("[data-guided-post-to='worker']")).toHaveCount(0);
  await page.locator("[data-guided-post-to='employer']").click();
  await expect(page).toHaveURL(/\/post\/vacancy\?ai=1/);
  await expect(page.locator("#mode-gate-title")).toHaveCount(0);
  await expect(page.locator("[data-vacancy-guide]")).toBeVisible();
});
