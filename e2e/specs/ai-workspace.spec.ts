import { expect, test, type Page } from "@playwright/test";
import { USERS, asGuest, asMode, loginAs, sql } from "../support";

/**
 * /ai — AI yordamchi ish maydoni (2026-11, "ChatGPT kabi"):
 *  - chap panel: "Yangi suhbat", bo'limlar (mehmon va telefon panelida), so'nggi suhbatlar (qurilmada), profil;
 *  - "Bugungi ishlar" va "Sizga mos ishlar" — faqat bazadagi haqiqiy raqamlar (profil to'liqligi, mos vakansiyalar soni,
 *    faol vakansiyalar) — bazadagi qiymat bilan solishtiriladi;
 *  - savol → jarayon izi (tushunildi → bazadan qidirildi · N ta → javob), suhbat ro'yxatga tushadi, qayta ochiladi, o'chiriladi;
 *  - tezkor imkoniyat tugmasi savolni yuboradi; telefonda bo'limlar pastdan chiqadi.
 * Stendda AI kaliti yo'q — javob lug'at (oddiy rejim) bilan; jarayon izi shuni ham halol ko'rsatadi.
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

const guestTest = async ({ page, context }: Ctx) => {
  await seed();
  await asGuest(context);
  await asMode(context, "worker");
  await page.goto("/ai");
  await expect(page.getByRole("heading", { level: 1, name: "Ish topdim AI" })).toBeVisible();
  await expect(page.locator("[data-ai-header-status]")).toContainText("Oddiy rejim");

  const brief = page.locator("[data-ai-brief]");
  await expect(brief.getByText(/Kiring — mos ishlar/)).toBeVisible();
  await expect(brief.getByRole("link", { name: /Kirish/ })).toHaveAttribute("href", "/auth?next=%2Fai");
  // soxta raqam yo'q: mehmonga foiz/son ko'rsatilmaydi
  await expect(brief).not.toContainText("%");

  const feed = page.locator("[data-ai-feed]");
  await expect(feed.getByRole("heading", { name: "Yangi ishlar" })).toBeVisible();
  await expect(feed.locator("article")).toHaveCount(3);
  await expect(feed.getByRole("link", { name: /Hammasi \(3\)/ })).toBeVisible();

  const panel = await openPanel(page);
  await expect(panel.getByRole("button", { name: "Yangi suhbat" })).toBeVisible();
  for (const [name, href] of [
    ["Bosh sahifa", "/"],
    ["Vakansiyalar", "/jobs"],
    ["Kasblar va karyera", "/kasblar"],
    ["Arizalarim", "/auth?next=%2Fapplications"],
  ] as const) {
    await expect(panel.getByRole("link", { name })).toHaveAttribute("href", href);
  }
  await expect(panel.getByRole("link", { name: "AI yordamchi" })).toHaveAttribute("aria-current", "page");
  await expect(panel.getByText("Hali suhbat yo'q")).toBeVisible();
  await expect(panel.getByRole("link", { name: /Mehmon/ })).toHaveAttribute("href", "/auth?next=%2Fai");
  if (narrow(page)) await page.keyboard.press("Escape");

  // tezkor imkoniyatlar (kompyuterda o'ng panel, telefonda salomlashuv ostida) va maslahat
  const quick = page.locator("[data-ai-quick]:visible").first();
  await expect(quick.locator("[data-quick='cv']")).toHaveAttribute("href", "/post/worker");
  await expect(quick.locator("[data-quick='alerts']")).toHaveAttribute("href", "/ai-alerts");
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
  const brief = page.locator("[data-ai-brief]");
  // 3 ta faol "Sotuvchi" vakansiyasi — profil kasbi va viloyati bo'yicha
  await expect(brief.getByText(/«Sotuvchi» bo'yicha 3 ta mos vakansiya/)).toBeVisible();
  // profil to'liqligi — bazadagi trigger hisoblagan qiymat (soxta foiz emas)
  await expect(brief.getByText(`Profilingiz ${wp!.completeness} % to'ldirilgan`)).toBeVisible();
  await expect(brief.getByRole("link", { name: /Davom etish/ })).toHaveAttribute("href", "/profile/edit");
  await expect(page.locator("[data-ai-feed]").getByRole("heading", { name: /Sizga mos/ })).toBeVisible();
  await expect(page.locator("[data-ai-feed] article")).toHaveCount(3);

  // kirgan foydalanuvchi, kompyuter: bo'limlar sayt yon menyusida — chap panelda takrorlanmaydi; telefon panelida — bor
  const panel = await openPanel(page);
  if (narrow(page)) {
    await expect(panel.getByRole("link", { name: "Arizalarim" })).toHaveAttribute("href", "/applications");
    await expect(panel.getByRole("link", { name: "CV va portfolio" })).toHaveAttribute("href", "/profile/cv");
    await page.keyboard.press("Escape");
  } else {
    await expect(panel.getByRole("link", { name: "Arizalarim" })).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "Kabinet menyusi" }).getByRole("link", { name: "Arizalarim" })).toBeVisible();
  }
  await expect(panel.getByText("Ish qidiruvchi")).toBeVisible();
};

const chatTest = async ({ page, context }: Ctx) => {
  await seed();
  await asGuest(context);
  await asMode(context, "worker");
  await page.goto("/ai");
  await expect(page.locator("[data-ai-welcome]")).toBeVisible();

  await ask(page, "Toshkentda sotuvchi");
  const trace = page.locator("[data-ai-trace]").last();
  await expect(trace.locator("[data-state='done']")).toHaveCount(3);
  await expect(trace).toContainText("Tushunildi");
  await expect(trace).toContainText("Bazadan qidirildi · 3 ta");
  await expect(trace).toContainText("Javob: oddiy rejim");
  await expect(page.locator("[data-ai-reply]").last()).toBeVisible();
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
  await expect(page.locator("[data-ai-reply]").last()).toBeVisible();
  panel = await openPanel(page);
  await expect(panel.locator("[data-ai-recent] button[aria-current='true']")).toHaveText(/kunlik ish/);
  await expect(panel.locator("[data-ai-recent]").getByRole("button", { name: "Toshkentda sotuvchi", exact: true })).toBeVisible();

  // eski suhbatni ochish — savol-javobi qaytadi
  await panel.locator("[data-ai-recent]").getByRole("button", { name: "Toshkentda sotuvchi", exact: true }).click();
  await expect(page.locator("[data-ai-you]").last()).toHaveText(/Toshkentda sotuvchi$/);
  await expect(page.locator("[data-ai-trace]").last()).toContainText("Bazadan qidirildi · 3 ta");

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
  await expect(page.locator("[data-ai-you]").last()).toHaveText(/Menga mos ish toping$/);
  // AI ulanmagan stendda: kasb so'raladi (soxta qidiruv emas), jarayon izi qidiruvsiz
  await expect(page.locator("[data-ai-reply]").last()).toContainText(/kasb/i);
  await expect(page.locator("[data-ai-trace]").last()).not.toContainText("Bazadan qidirildi");
  await expect(page.locator("[data-ai-trace]").last()).toContainText("Javob: oddiy rejim");
  if (!narrow(page)) {
    await page.locator("[data-ai-promo]").getByRole("button", { name: "Boshlash" }).click();
    await expect(page.locator("[data-ai-you]").last()).toHaveText(/Menga qaysi kasb mos keladi\?/);
    // maslahat — faqat sun'iy intellekt: AI yo'qligi halol aytiladi
    await expect(page.locator("[data-ai-reply]").last()).toContainText(/sun'iy intellekt/i);
  }
};

const employerTest = async ({ page, context }: Ctx) => {
  await seed();
  await loginAs(context, USERS.employer);
  await asMode(context, "employer");
  const [row] = await sql<{ n: string }>("select count(*)::text as n from public.vacancies where owner_profile_id = $1 and status = 'active'", [USERS.employer]);
  const n = row!.n;
  await page.goto("/ai");
  await expect(page.getByRole("heading", { level: 1, name: "Ish topdim AI" })).toBeVisible();
  const brief = page.locator("[data-ai-brief]");
  await expect(brief.getByText(`${n} ta faol vakansiyangiz bor`)).toBeVisible();
  await expect(brief.getByRole("link", { name: /Ko'rish/ }).first()).toHaveAttribute("href", "/employer/vacancies");
  await expect(page.locator("[data-ai-feed]").getByRole("heading", { name: "Yangi nomzodlar" })).toBeVisible();
  const quick = page.locator("[data-ai-quick]:visible").first();
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
    test("suhbat: jarayon izi, so'nggi suhbatlar ro'yxati, yangi suhbat, qayta ochish, o'chirish", chatTest);
    test("tezkor imkoniyat: 'Ish qidirish' savolni yuboradi; 'Boshlash' — karyera savoli", quickTest);
    test("ish beruvchi: faol vakansiyalar soni bazadan, yangi nomzodlar, o'z tezkor imkoniyatlari", employerTest);
  });
}
