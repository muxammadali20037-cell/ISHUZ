import { expect, test, type Page } from "@playwright/test";
import { USERS, asGuest, asMode, loginAs, quickSearch, sql } from "../support";

/**
 * /ai — AI yordamchi ish maydoni (2026-11, "ChatGPT kabi"):
 *  - alohida to'liq ekran (2026-11-15): sayt menyulari yo'q, o'z sarlavhasi ("‹", "Yordamchi");
 *  - chap panel ("Suhbatlar"): "Yangi suhbat", so'nggi suhbatlar (qurilmada), profil;
 *  - "Bugungi ishlar" va "Kasbingiz bo'yicha ishlar" — faqat bazadagi haqiqiy raqamlar (profil to'liqligi, mos vakansiyalar soni,
 *    faol vakansiyalar) — bazadagi qiymat bilan solishtiriladi;
 *  - 2026-11-16 (ega: "AI uzun matn yozmasin"): savol → so'rovnoma oynasi (kasb, hudud, maosh) → "Qidirish" → qisqa xulosa
 *    va kartalar; suhbat ro'yxatga tushadi, qayta ochiladi, o'chiriladi;
 *  - tezkor imkoniyat tugmasi so'rovnomani bo'sh "Qanday ish?" bilan ochadi; erkin suhbat (karyera maslahati va h.k.) yo'q;
 *    telefonda bo'limlar pastdan chiqadi.
 * Stendda AI kaliti yo'q — matn lug'at bilan tushuniladi.
 */

const narrow = (page: Page) => (page.viewportSize()?.width ?? 1280) < 1024;

async function seed() {
  const [r] = await sql<{ id: string }>("select id from public.regions where slug = 'tashkent_city'");
  const [n] = await sql<{ id: string }>("select id from public.profession_nodes where selectable and is_active and name_uz = 'Sotuvchi' limit 1");
  await sql(
    `insert into public.employer_profiles (profile_id, employer_type, display_name, onboarding_completed_at)
     values ($1, 'person', 'Dilnoza opa', now()) on conflict (profile_id) do nothing`,
    [USERS.employer],
  );
  await sql("delete from public.vacancies where owner_profile_id = $1", [USERS.employer]);
  for (let i = 1; i <= 3; i++) {
    await sql(
      `insert into public.vacancies (owner_profile_id, title, region_id, description, status, salary_from, salary_to, salary_type, schedule, published_at, expires_at, profession_node_id)
       values ($1, $2, $3, 'Do''konga sotuvchi kerak', 'active', 4000000, 6000000, 'monthly', '5_2', now() - ($4 || ' minutes')::interval, now() + interval '10 days', $5)`,
      [USERS.employer, `Sotuvchi (AI maydon ${i})`, r!.id, String(i), n!.id],
    );
  }
  await sql("delete from public.worker_profiles where profile_id = $1", [USERS.workerA]);
  await sql(
    `insert into public.worker_profiles (profile_id, headline, region_id, profession_node_id, experience_level, onboarding_completed_at)
     values ($1, 'Sotuvchi', $2, $3, '3_5y', now())`,
    [USERS.workerA, r!.id, n!.id],
  );
}

test.afterEach(async () => {
  await sql("delete from public.vacancies where owner_profile_id = $1", [USERS.employer]);
  await sql("delete from public.worker_profiles where profile_id = $1", [USERS.workerA]);
});

async function ask(page: Page, text: string) {
  await page.getByLabel("Nima qidiryapsiz?").fill(text);
  await page.getByRole("button", { name: "Topish", exact: true }).click();
}

/** chap panel: kompyuterda yon ustun, telefonda pastdan chiqadigan panel */
async function openPanel(page: Page) {
  if (narrow(page)) {
    await page.locator("[data-ai-open-sidebar]").click();
    return page.getByRole("dialog");
  }
  return page.locator("[data-ai-sidebar]");
}

type Ctx = { page: Page; context: import("@playwright/test").BrowserContext };

/** "Bugungi ishlar" va "Yangi ishlar" yig'ilgan — ikkalasini ochish */
async function openFolds(page: Page) {
  for (const name of ["ai-brief", "ai-feed"]) {
    const btn = page.locator(`[data-fold="${name}"] [data-fold-toggle]`);
    await expect(btn).toHaveAttribute("aria-expanded", "false");
    await btn.click();
    await expect(btn).toHaveAttribute("aria-expanded", "true");
  }
}

const guestTest = async ({ page, context }: Ctx) => {
  await seed();
  await asGuest(context);
  await asMode(context, "worker");
  await page.goto("/ai");
  await expect(page.getByRole("heading", { level: 1, name: "Yordamchi" })).toBeVisible();
  await expect(page.locator("[data-ai-header-status]")).toContainText("Oddiy rejim");

  // "Bugungi ishlar" va "Yangi ishlar" — yig'ilgan (2026-11-15): "Ochish" / "Ko'rish" bilan ochiladi
  await openFolds(page);
  const brief = page.locator("[data-ai-brief]");
  await expect(brief.getByText(/Kiring — e'lonlaringiz, arizalar/)).toBeVisible();
  await expect(brief.getByRole("link", { name: /Kirish/ })).toHaveAttribute("href", "/auth?next=%2Fai");
  // soxta raqam yo'q: mehmonga foiz/son ko'rsatilmaydi
  await expect(brief).not.toContainText("%");

  const feed = page.locator("[data-ai-feed]");
  await expect(page.locator('[data-fold="ai-feed"]').getByRole("heading", { name: /Yangi ishlar/ })).toBeVisible();
  await expect(feed.locator("article")).toHaveCount(3);
  await expect(feed.getByRole("link", { name: /Hammasi \(3\)/ })).toBeVisible();

  // alohida to'liq ekran (2026-11-15): sayt menyulari yo'q — "Suhbatlar" panelida faqat suhbatlar va profil
  await expect(page.locator("nav.bottom-nav")).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Asosiy bo'limlar" })).toHaveCount(0);
  const panel = await openPanel(page);
  await expect(panel.getByRole("button", { name: "Yangi suhbat" })).toBeVisible();
  await expect(panel.getByRole("link", { name: "Vakansiyalar" })).toHaveCount(0);
  await expect(panel.getByText("Hali suhbat yo'q")).toBeVisible();
  await expect(panel.getByRole("link", { name: /Mehmon/ })).toHaveAttribute("href", "/auth?next=%2Fai");
  if (narrow(page)) await page.keyboard.press("Escape");

  // tezkor imkoniyatlar (kompyuterda o'ng panel, telefonda salomlashuv ostida) va maslahat
  const quick = page.locator("[data-ai-quick]:visible").first();
  // 2026-11-16: faqat qidiruv va sahifalarga havolalar (erkin suhbat — karyera maslahati va h.k. — yo'q); "Masalan, bosing" yo'q
  // "PRO kuzatuv" (mos ish chiqsa — xabar) olib tashlandi (ega, 2026-11-22)
  await expect(quick.locator("[data-quick]")).toHaveText([/Ish qidirish/, /CV yaratish/]);
  await expect(page.locator("[data-ai-promo]")).toHaveCount(0);
  await expect(page.getByText("Masalan, bosing:")).toHaveCount(0);
  await expect(quick.locator("[data-quick='cv']")).toHaveAttribute("href", "/post/worker");
  await expect(quick.locator("[data-quick='alerts']")).toHaveCount(0);
  if (!narrow(page)) {
    await expect(page.locator("[data-ai-tip]")).toContainText(/maslahat/i);
    await page.locator("[data-ai-tip]").getByRole("button", { name: "Keyingi maslahat" }).click();
    await expect(page.locator("[data-ai-tip] p")).not.toHaveText("");
  }
};

const seekerTest = async ({ page, context }: Ctx) => {
  await seed();
  await loginAs(context, USERS.workerA);
  await asMode(context, "worker");
  const [wp] = await sql<{ completeness: number }>("select completeness from public.worker_profiles where profile_id = $1", [USERS.workerA]);
  await page.goto("/ai");
  await expect(page.getByText(/^Assalomu alaykum, /)).toBeVisible();
  await openFolds(page);
  const brief = page.locator("[data-ai-brief]");
  // 3 ta faol "Sotuvchi" vakansiyasi — profil kasbi va viloyati bo'yicha
  await expect(brief.getByText(/«Sotuvchi» bo'yicha 3 ta vakansiya/)).toBeVisible();
  // profil to'liqligi — bazadagi trigger hisoblagan qiymat (soxta foiz emas)
  await expect(brief.getByText(`Profilingiz ${wp!.completeness} % to'ldirilgan`)).toBeVisible();
  await expect(brief.getByRole("link", { name: /Davom etish/ })).toHaveAttribute("href", "/profile/edit");
  await expect(page.locator('[data-fold="ai-feed"]').getByRole("heading", { name: /Kasbingiz bo'yicha ishlar/ })).toBeVisible();
  await expect(page.locator("[data-ai-feed] article")).toHaveCount(3);

  // alohida to'liq ekran: sayt yon menyusi ham yo'q; "Suhbatlar" panelida — profil
  await expect(page.getByRole("navigation", { name: "Kabinet menyusi" })).toHaveCount(0);
  const panel = await openPanel(page);
  await expect(panel.getByRole("link", { name: "Arizalarim" })).toHaveCount(0);
  await expect(panel.getByText("Ish qidiruvchi")).toBeVisible();
};

const chatTest = async ({ page, context }: Ctx) => {
  await seed();
  await asGuest(context);
  await asMode(context, "worker");
  await page.goto("/ai");
  await expect(page.locator("[data-ai-welcome]")).toBeVisible();

  await ask(page, "Toshkentda sotuvchi");
  const answer = await quickSearch(page);
  await expect(answer.locator("[data-quick-summary]")).toContainText("Sotuvchi");
  await expect(answer.locator("[data-quick-found]")).toHaveText("3 ta ish topildi");
  await expect(page.locator("[data-ai-reply], [data-ai-trace]")).toHaveCount(0);
  await expect(page.locator("[data-ai-welcome]")).toHaveCount(0);
  await expect(page.locator("[data-ai-header-status]")).toContainText("Oddiy rejim");

  // so'nggi suhbatlar: joriy suhbat sarlavhasi — birinchi savol
  let panel = await openPanel(page);
  const recent = panel.locator("[data-ai-recent]");
  await expect(recent.getByRole("button", { name: "Toshkentda sotuvchi", exact: true })).toHaveAttribute("aria-current", "true");

  // yangi suhbat → bo'sh ekran, eski suhbat ro'yxatda qoladi
  await panel.getByRole("button", { name: "Yangi suhbat" }).click();
  await expect(page.locator("[data-ai-welcome]")).toBeVisible();
  await ask(page, "kunlik ish");
  await quickSearch(page);
  panel = await openPanel(page);
  await expect(panel.locator("[data-ai-recent] button[aria-current='true']")).toHaveText(/kunlik ish/);
  await expect(panel.locator("[data-ai-recent]").getByRole("button", { name: "Toshkentda sotuvchi", exact: true })).toBeVisible();

  // eski suhbatni ochish — savol-javobi qaytadi
  await panel.locator("[data-ai-recent]").getByRole("button", { name: "Toshkentda sotuvchi", exact: true }).click();
  await expect(page.locator("[data-ai-you]").last()).toHaveText(/Toshkentda sotuvchi$/);
  await expect(page.locator("[data-quick-found]").last()).toHaveText("3 ta ish topildi");

  // sahifa yangilansa — ro'yxat qurilmada saqlangan (localStorage)
  await page.reload();
  panel = await openPanel(page);
  await expect(panel.locator("[data-ai-recent] li")).toHaveCount(2);

  // o'chirish: joriy suhbat o'chirilsa ekran ham bo'shaydi
  await panel.getByRole("button", { name: "Suhbatni o'chirish: Toshkentda sotuvchi" }).click();
  await expect(panel.locator("[data-ai-recent]").getByRole("button", { name: "Toshkentda sotuvchi", exact: true })).toHaveCount(0);
  await expect(page.locator("[data-ai-welcome]")).toBeVisible();
};

const quickTest = async ({ page, context }: Ctx) => {
  await seed();
  await asGuest(context);
  await asMode(context, "worker");
  await page.goto("/ai");
  await expect(page.locator("[data-ai-welcome]")).toBeVisible();
  await page.locator("[data-ai-quick]:visible [data-quick='find']").first().click();
  await expect(page.locator("[data-ai-you]").last()).toHaveText(/Ish qidirish$/);
  // tugma nomi kasb deb olinmaydi: "Qanday ish?" bo'sh — yozib, qidiramiz
  const sheet = page.locator("[data-quick-sheet]");
  await expect(sheet.locator("[data-quick-profession]")).toHaveValue("");
  const answer = await quickSearch(page, { profession: "sotuvchi", place: "tashkent_city" });
  await expect(answer.locator("[data-quick-found]")).toHaveText("3 ta ish topildi");
  await expect(page.locator("[data-ai-reply]")).toHaveCount(0);
};

const employerTest = async ({ page, context }: Ctx) => {
  await seed();
  await loginAs(context, USERS.employer);
  await asMode(context, "employer");
  const [row] = await sql<{ n: string }>("select count(*)::text as n from public.vacancies where owner_profile_id = $1 and status = 'active'", [USERS.employer]);
  const n = row!.n;
  await page.goto("/ai");
  await expect(page.getByRole("heading", { level: 1, name: "Yordamchi" })).toBeVisible();
  await openFolds(page);
  const brief = page.locator("[data-ai-brief]");
  await expect(brief.getByText(`${n} ta faol vakansiyangiz bor`)).toBeVisible();
  await expect(brief.getByRole("link", { name: /Ko'rish/ }).first()).toHaveAttribute("href", "/employer/vacancies");
  await expect(page.locator('[data-fold="ai-feed"]').getByRole("heading", { name: /Yangi nomzodlar/ })).toBeVisible();
  const quick = page.locator("[data-ai-quick]:visible").first();
  await expect(quick.locator("[data-quick]")).toHaveText([/Nomzod topish/, /Vakansiya joylash/]);
  await expect(quick.locator("[data-quick='post']")).toHaveAttribute("href", "/employer/vacancies/new");
  await expect(quick.locator("[data-quick='candidates']")).toBeVisible();
  await expect(page.getByLabel("Nima qidiryapsiz?")).toHaveAttribute("placeholder", /Kim kerak/);
};

// telefon (390, standart loyiha) va kompyuter (1280): chap panel — pastdan chiqadigan panel yoki yon ustun
for (const [label, viewport] of [
  ["telefon", null],
  ["kompyuter", { width: 1280, height: 900 }],
] as const) {
  test.describe(label, () => {
    if (viewport) test.use({ viewport });
    test("mehmon: bo'limlar, 'Kiring' qadami, yangi e'lonlar bazadan, tezkor imkoniyatlar, maslahat", guestTest);
    test("ish qidiruvchi: 'Bugungi ishlar' bazadagi raqamlar bilan; mos ishlar profil kasbi bo'yicha", seekerTest);
    test("suhbat: so'rovnoma → qisqa javob (matn yo'q), so'nggi suhbatlar ro'yxati, yangi suhbat, qayta ochish, o'chirish", chatTest);
    test("tezkor imkoniyat: 'Ish qidirish' so'rovnomani bo'sh kasb bilan ochadi; qidiruv shu yerda", quickTest);
    test("ish beruvchi: faol vakansiyalar soni bazadan, yangi nomzodlar, o'z tezkor imkoniyatlari", employerTest);
  });
}
