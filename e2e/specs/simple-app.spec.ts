import { expect, test, type Page } from "@playwright/test";
import { USERS, asGuest, asMode, loginAs, quickSearch, sql } from "../support";

/**
 * 2026-11-20 (ega: "ilova chalkash — kirgan odam hech nimani tushunmaydi; pastda faqat Ishchilar, Ishlar, E'lonlarim,
 * Izlash va e'lon berish, Profil; kirgandan keyin chatga kirsin, chatda tanlansin: ish qidirish yoki e'lon berish"):
 *  - pastki menyu — ikkala rejimda (va mehmonda) bir xil 5 ta bo'lim, o'rtada chat;
 *  - kirgan foydalanuvchining asosiy ekrani — /chat ("/" ham shu yerga olib boradi);
 *  - chatda: Izlash → Ish / Ishchi (qidiruv shu yerda) yoki E'lon berish → O'zim haqimda / Vakansiya (forma, rejim savolisiz);
 *  - "Ishchilar" bo'limi ish izlovchiga ham to'siqsiz ochiladi.
 */
test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

const TABS = ["Ishchilar", "Ishlar", "Izlash/E'lon", "E'lonlarim", "Profil"];
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

for (const who of ["worker", "employer", "guest"] as const) {
  test(`pastki menyu — 5 ta bo'lim, hamma uchun bir xil (${who})`, async ({ page, context }) => {
    if (who === "guest") await asGuest(context);
    else await loginAs(context, who === "worker" ? USERS.workerA : USERS.employer);
    await asMode(context, who === "guest" ? "worker" : who);
    await page.goto("/jobs");
    await expect(tabs(page).getByRole("link")).toHaveText(TABS);
    await expect(tabs(page).getByRole("link", { name: "Ishlar" })).toHaveAttribute("aria-current", "page");
    // avvalgi menyular yo'q: "Bosh sahifa", "Ish beruvchilar", "Boshqaruv", alohida "Yordamchi" belgisi
    for (const old of ["Bosh sahifa", "Ish beruvchilar", "Boshqaruv", "Xabarlar"]) await expect(tabs(page).getByRole("link", { name: old })).toHaveCount(0);
    await expect(page.locator("header a[href='/ai']")).toHaveCount(0);
  });
}

test("kirgan foydalanuvchi: «/» → chat; salom, «Nima qilmoqchisiz?», ikkita katta tugma, orqaga tugmasi yo'q", async ({ page, context }) => {
  await loginAs(context, USERS.workerA);
  await asMode(context, "worker");
  await page.goto("/");
  await expect(page).toHaveURL(/\/chat$/);
  const chat = page.locator("[data-start-chat]");
  await expect(chat).toContainText("Assalomu alaykum, Anvar!");
  await expect(chat).toContainText("Nima qilmoqchisiz?");
  await expect(chat.locator("[data-chat-choice='find']")).toContainText("Izlash");
  await expect(chat.locator("[data-chat-choice='post']")).toContainText("E'lon berish");
  await expect(tabs(page).getByRole("link", { name: "Izlash/E'lon" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("link", { name: "Orqaga" })).toHaveCount(0);
  // ish beruvchi ham shu ekranga
  await loginAs(context, USERS.employer);
  await asMode(context, "employer");
  await page.goto("/");
  await expect(page).toHaveURL(/\/chat$/);
  await expect(page.locator("[data-start-chat]")).toContainText("Assalomu alaykum, Dilnoza!");
});

test("mehmon uchun «/» — avvalgidek ochiq bosh sahifa (chatga yo'naltirilmaydi), chat ham ochiladi", async ({ page, context }) => {
  await asGuest(context);
  await asMode(context, "worker");
  await page.goto("/");
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/chat");
  await expect(page.locator("[data-start-chat]")).toContainText("Assalomu alaykum!");
});

test("Izlash → Ish: shu suhbatda so'rovnoma, keyin bazadagi haqiqiy e'lonlar", async ({ page, context }) => {
  await vacancy("Buxgalter", "Buxgalter");
  await loginAs(context, USERS.workerA);
  await asMode(context, "worker");
  await page.goto("/chat");
  const chat = page.locator("[data-start-chat]");
  await expect(page.locator("form[data-hydrated]")).toHaveCount(1);
  await chat.locator("[data-chat-choice='find']").click();
  await expect(chat).toContainText("Nimani izlaysiz?");
  await chat.locator("[data-chat-choice='find_jobs']").click();
  await expect(chat.locator("[data-ai-you]").last()).toHaveText(/Ish qidiryapman/);
  const sheet = page.getByRole("dialog", { name: "Ish qidirish" });
  await sheet.getByLabel("Qanday ish?").fill("Buxgalter");
  const answer = await quickSearch(page, { place: "tashkent_city" });
  await expect(answer.locator("[data-quick-found]")).toHaveText("1 ta ish topildi");
  await expect(answer.locator("article").first()).toContainText("Buxgalter");
});

test("E'lon berish → «Men ish izlayapman» — o'zi haqida e'lon (yordamchi), rejim so'ralmaydi", async ({ page, context }) => {
  await loginAs(context, USERS.workerB);
  await asMode(context, "employer");
  await page.goto("/chat");
  const chat = page.locator("[data-start-chat]");
  await expect(page.locator("form[data-hydrated]")).toHaveCount(1);
  await chat.locator("[data-chat-choice='post']").click();
  await expect(chat).toContainText("Qanday e'lon beramiz?");
  await chat.locator("[data-chat-choice='post_worker']").click();
  await expect(page).toHaveURL(/\/ai\/post$/);
  await expect(page.getByPlaceholder(/Kasbingizni yozing/)).toBeVisible();
  const [p] = await sql<{ active_role: string }>("select active_role from public.profiles where id = $1", [USERS.workerB]);
  expect(p!.active_role).toBe("worker");
});

test("E'lon berish → «Menga ishchi kerak» — vakansiya formasi darhol (ish izlovchi rejimida ham to'siqsiz)", async ({ page, context }) => {
  await loginAs(context, USERS.workerB);
  await asMode(context, "worker");
  await page.goto("/chat");
  const chat = page.locator("[data-start-chat]");
  await expect(page.locator("form[data-hydrated]")).toHaveCount(1);
  await chat.locator("[data-chat-choice='post']").click();
  await chat.locator("[data-chat-choice='post_vacancy']").click();
  await expect(page).toHaveURL(/\/post\/vacancy/);
  await expect(page.locator("#mode-gate-title")).toHaveCount(0);
  await expect(page.getByText("Qanday mutaxassis kerak?")).toBeVisible();
});

test("«Ishchilar» bo'limi ish izlovchiga ham to'siqsiz ochiladi va belgilanadi", async ({ page, context }) => {
  await loginAs(context, USERS.workerA);
  await asMode(context, "worker");
  await page.goto("/chat");
  await tabs(page).getByRole("link", { name: "Ishchilar" }).click();
  await expect(page).toHaveURL(/\/search\?mode=workers/);
  await expect(page.locator("#mode-gate-title")).toHaveCount(0);
  await expect(tabs(page).getByRole("link", { name: "Ishchilar" })).toHaveAttribute("aria-current", "page");
  await expect(tabs(page).getByRole("link", { name: "Ishlar" })).not.toHaveAttribute("aria-current", "page");
});
