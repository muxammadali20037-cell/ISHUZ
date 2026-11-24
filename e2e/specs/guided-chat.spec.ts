import { expect, test, type Page } from "@playwright/test";
import { USERS, asGuest, asMode, homeSearch, loginAs, sql } from "../support";

/**
 * Asosiy ekran — chat (ega, 2026-11-21, master prompt + tanlovlar; "muloyim, aniq, jaydari so'zlar bilan so'rasin —
 * odamlar nima haqda so'ralayotganini aniq bilsin"):
 *  - bosh sahifa ("/") mehmonga ham darhol chat: "Ish yoki ishchini oson toping" va pastga strelka (2026-11-21
 *    kechqurun: misollar va boshqa ortiqcha narsalar olib tashlandi);
 *  - AI maqsadni yozilgan matndan aniqlaydi; aniq bo'lmasa — bitta savol, ikki tugma;
 *  - yetishmagan narsa bittadan: kasb — yoziladi, hudud — tugmalardan tanlanadi (yozilmaydi), tanlov eslab qolinadi;
 *  - natijalar shu chatda kartalar bilan (birinchi 3 tasi, "Yana N tasini ko'rsatish");
 *  - e'lon berish niyati — e'lon berishga yo'naltiradi; suhbat boshqa hisobga ko'rinmaydi.
 */
test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

const TAG = "Chat sinovi";
const box = (page: Page) => page.locator("form[data-hydrated] #start-chat-text");
async function send(page: Page, text: string) {
  await box(page).fill(text);
  await box(page).press("Enter");
  await settled(page);
}
/** bosh ekrandagi qidiruv qatoridan (suhbatning birinchi xabari; 2026-11-23 — C varianti) */
async function search(page: Page, text: string) {
  await homeSearch(page, text);
  await settled(page);
}
async function settled(page: Page) {
  await expect(page.locator("[data-guided-ai='thinking'], [data-guided-ai='searching']")).toHaveCount(0, { timeout: 20_000 });
}
const lastAi = (page: Page) => page.locator("[data-guided-ai]").last();

async function seedWorkers(n: number) {
  const [r] = await sql<{ id: string }>("select id from public.regions where slug = 'tashkent_city'");
  const [node] = await sql<{ id: string }>("select id from public.profession_nodes where name_uz = 'Haydovchi' and selectable limit 1");
  for (let i = 0; i < n; i++) {
    const id = `7e2e0000-0000-4000-8000-0000000009${String(10 + i)}`;
    await sql(
      `insert into auth.users (id, phone, phone_confirmed_at, raw_user_meta_data) values ($1, $2, now(), $3) on conflict (id) do nothing`,
      [id, `+99890777${String(1000 + i)}`, JSON.stringify({ first_name: `${TAG} ${i}`, last_name: "Haydovchi" })],
    );
    await sql(
      `insert into public.worker_profiles (profile_id, headline, region_id, is_public, onboarding_completed_at, profession_node_id)
       select $1, 'Haydovchi', $2, true, now(), $3 where not exists (select 1 from public.worker_profiles where profile_id = $1)`,
      [id, r!.id, node!.id],
    );
  }
}

test.afterAll(async () => {
  await sql("delete from public.worker_profiles where profile_id in (select id from auth.users where raw_user_meta_data->>'first_name' like $1)", [`${TAG}%`]);
});

test("mehmon: bosh sahifa — darhol chat: sarlavha, qidiruv qatori va uchta tugma (ortiqcha hech narsa yo'q)", async ({ page, context }) => {
  await asGuest(context);
  await page.goto("/");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ishingiz shu yerdan boshlanadi!");
  // ega (2026-11-22): "ish qidiryapman / ishchi qidiryapman"; 2026-11-23 (C varianti): + sariq "E'lon berish"
  await expect(page.locator("[data-guided-start='jobs']")).toContainText("Ish qidiryapman");
  await expect(page.locator("[data-guided-start='workers']")).toContainText("Ishchi qidiryapman");
  await expect(page.locator("[data-guided-start='post']")).toContainText("E'lon berish");
  // eski reklama sahifasi, "Ishchi izlash / Vakansiya berish" qatorlari va misollar yo'q (ega, 2026-11-21 kechqurun)
  await expect(page.locator("[data-chat-choices], [data-guided-example]")).toHaveCount(0);
  // yozish — qidiruv qatorida (kasb + hudud); pastdagi yozish maydoni suhbat boshlangach chiqadi
  await expect(page.getByRole("searchbox", { name: "Kasb yoki lavozim" })).toHaveAttribute("placeholder", "Yozing, o'zingizga mosini toping");
  await expect(page.getByRole("combobox", { name: "Hudud" })).toHaveValue("all");
  await expect(page.locator("#start-chat-text")).toBeHidden();
  await expect(page.locator("[data-guided-thread]")).toHaveCount(0);
});

test("maqsad aniq emas — savolsiz ikki tugma; hudud — tugmalardan, «Endi nima qilamiz?», keyin natija", async ({ page, context }) => {
  await seedWorkers(1);
  await asGuest(context);
  // qidiruv qatori ish qidirish tomoniga qaraydi; yozish maydonidan (yoki havoladan, ?q=) — maqsad aniq bo'lmasa so'raladi
  await page.goto("/chat?q=haydovchi");
  await settled(page);
  // ega (2026-11-22): "so'ramasin — 2 ta variant chiqsin ekranga"
  await expect(lastAi(page)).toHaveAttribute("data-guided-ai", "ask-role");
  await expect(lastAi(page).locator("[data-guided-role]")).toHaveCount(2);
  await page.locator("[data-guided-role='workers']").click();
  await settled(page);
  await expect(page.locator("[data-ai-you]").last()).toHaveText(/Ishchi qidiryapman/);
  // hudud — yozilmaydi, tanlanadi
  await expect(lastAi(page)).toHaveAttribute("data-guided-ai", "ask-place");
  await expect(lastAi(page)).toContainText("Ishchi qaysi viloyatdan bo'lsin? Pastdan tanlang.");
  await expect(page.locator("[data-guided-place='remote']")).toHaveCount(0);
  await page.locator("[data-guided-place='tashkent_city']").click();
  await settled(page);
  // savol-javob bilan kelindi — tanlov; "Mavjud ishchilarni ko'rish" → natija
  await expect(lastAi(page)).toHaveAttribute("data-guided-ai", "next");
  await box(page).blur();
  await lastAi(page).locator("[data-guided-next-to='see']").click();
  await settled(page);
  await expect(lastAi(page)).toHaveAttribute("data-guided-ai", "results");
  await expect(lastAi(page)).toContainText(/Mana, \d+ ta ishchi topdim/);
  await expect(page.locator("[data-guided-summary]").last()).toContainText("Toshkent shahri");
  // e'lonlar ostida kichik "+ E'lon joylash" (ega, 2026-11-22) — ish beruvchiga vakansiya yordamchisi
  const postLink = lastAi(page).locator("[data-guided-post-link='vacancy']");
  await expect(postLink).toHaveText("E'lon joylash");
  await expect(postLink).toHaveAttribute("href", /^\/post\/vacancy\?ai=1/);
  // javob berilgan savollarning tugmalari yo'qoladi
  await expect(page.locator("[data-guided-roles], [data-guided-places], [data-guided-next]")).toHaveCount(0);
  // tanlangan hudud eslab qolinadi — keyingi savolda so'ralmaydi; rol ham shu suhbatda ma'lum
  await send(page, "haydovchi");
  await expect(lastAi(page)).toHaveAttribute("data-guided-ai", "results");
  // havola faqat oxirgi natija ostida
  await expect(page.locator("[data-guided-post-link]")).toHaveCount(1);
  expect((await context.cookies()).find((c) => c.name === "ib_mode")?.value).toBe("employer");
});

test("ish beruvchi bir xabarda hammasini yozsa — savolsiz natija: birinchi 3 tasi, «Yana N tasini ko'rsatish»", async ({ page, context }) => {
  await seedWorkers(5);
  await loginAs(context, USERS.employer);
  await asMode(context, "employer");
  await page.goto("/chat");
  await expect(page.locator("[data-home-q]")).toHaveAttribute("placeholder", "Yozing, o'zingizga mosini toping");
  await search(page, "Menga Toshkentdan haydovchi kerak");
  await expect(page.locator("[data-guided-ai^='ask']")).toHaveCount(0);
  const res = lastAi(page);
  await expect(res).toHaveAttribute("data-guided-ai", "results");
  const total = Number((await res.locator("p").first().textContent())!.match(/(\d+)/)![1]);
  expect(total).toBeGreaterThanOrEqual(5);
  await expect(res.locator("[data-guided-cards] > li")).toHaveCount(3);
  // telefon emulyatsiyasi: avval klaviatura yopiladi (fokusdagi maydon bosilganda pastki menyu qaytib, tugma siljiydi)
  await box(page).blur();
  await res.locator("[data-guided-more]").click();
  await expect(res.locator("[data-guided-cards] > li")).not.toHaveCount(3);
  expect(await res.locator("[data-guided-cards] > li").count()).toBeGreaterThan(3);
});

test("kasb aytilmasa — kasb so'raladi (yoziladi), keyin hudud; e'lon berish niyati — e'lon berishga", async ({ page, context }) => {
  await loginAs(context, USERS.workerA);
  await asMode(context, "worker");
  await context.clearCookies({ name: "ib_place" });
  await page.goto("/chat");
  await expect(page.locator("[data-home-q]")).toHaveAttribute("placeholder", "Yozing, o'zingizga mosini toping");
  await search(page, "Ish kerak");
  await expect(lastAi(page)).toHaveAttribute("data-guided-ai", "ask-profession");
  await expect(lastAi(page)).toContainText("Kasbingiz qanday? Pastdan tanlang yoki yozing.");
  // ommabop kasblar — avval 3 tasi (2026-11-22)
  await expect(lastAi(page).locator("[data-guided-prof]")).toHaveCount(3);
  await expect(box(page)).toHaveAttribute("placeholder", "Kasbni yozing…");
  // hudud qidiruv qatorida tanlangan ("Butun O'zbekiston") — qayta so'ralmaydi
  await send(page, "sotuvchi");
  await expect(lastAi(page)).toHaveAttribute("data-guided-ai", "next");
  await expect(lastAi(page)).toContainText("Butun O'zbekiston");
  // "Ish qidiryapman" tugmasi bilan — hudud tugmalardan so'raladi
  await box(page).blur();
  await page.locator("[data-guided-new]").click();
  await page.locator("[data-guided-start='jobs']").click();
  await settled(page);
  await expect(lastAi(page)).toHaveAttribute("data-guided-ai", "ask-profession");
  await send(page, "sotuvchi");
  await expect(lastAi(page)).toHaveAttribute("data-guided-ai", "ask-place");
  await expect(lastAi(page)).toContainText("Qaysi viloyatda ishlamoqchisiz?");
  // avval 3 tasi (Butun O'zbekiston birinchi); masofaviy va qolgan viloyatlar — «Boshqa viloyat» ostida
  await expect(lastAi(page).locator("[data-guided-place]")).toHaveCount(3);
  await box(page).blur();
  await lastAi(page).locator("[data-choice-all]").click();
  await expect(page.locator("[data-guided-place='remote']")).toBeVisible();
  await page.locator("[data-guided-place='samarkand']").click();
  await settled(page);
  await expect(lastAi(page)).toHaveAttribute("data-guided-ai", "next");
  await lastAi(page).locator("[data-guided-next-to='see']").click();
  await settled(page);
  await expect(lastAi(page)).toHaveAttribute("data-guided-ai", /results|none/);

  await send(page, "Vakansiya joylamoqchiman");
  await expect(lastAi(page)).toHaveAttribute("data-guided-ai", "post");
  await expect(page.locator("[data-guided-post-to='employer']")).toHaveAttribute("href", /^\/post\/vacancy\?ai=1/);
  // ishchi e'loni — shu chatda, savollar bittadan (3-bosqich; to'liq yo'l — chat-post.spec)
  await send(page, "O'zim haqimda e'lon bermoqchiman");
  await settled(page);
  await expect(lastAi(page)).toHaveAttribute("data-guided-ai", "post-profession");
  // kasb aytilgan bo'lsa — kasb so'ralmaydi; keyingisi — oshpazga xos savol (ega, 2026-11-24)
  await send(page, "Men oshpazman, o'zim haqimda e'lon bermoqchiman");
  await settled(page);
  await expect(lastAi(page)).toHaveAttribute("data-guided-ai", "post-venue");
});

test("suhbat boshqa hisobga ko'rinmaydi (bitta tabda chiqib, boshqasi bilan kirilsa)", async ({ page, context }) => {
  await loginAs(context, USERS.workerA);
  await asMode(context, "worker");
  await page.goto("/chat");
  await search(page, "Men haydovchiman, ish kerak");
  await expect(page.locator("[data-guided-thread]")).toBeVisible();
  // boshqa ochilishda (shu tab) — suhbat joyida
  await page.goto("/chat");
  await expect(page.locator("[data-ai-you]").first()).toHaveText(/Men haydovchiman/);
  await loginAs(context, USERS.employer);
  await asMode(context, "employer");
  await page.goto("/chat");
  await expect(page.locator("[data-guided-thread]")).toHaveCount(0);
  await expect(page.locator("[data-guided-start]").first()).toBeVisible();
});
