import { expect, test, type Page } from "@playwright/test";
import { USERS, asGuest, asMode, loginAs, quickSearch, sql } from "../support";

/**
 * Yordamchi — oddiy qidiruv (2026-11-16, ega: "AI uzun matn yozmasin. So'rov qilgandan keyin oyna chiqsin — qaysi hududdan,
 * oylik maoshi qancha bo'lsin — oxirida «Qidirish». Ish yo'q bo'lsa — so'rovingiz saqlandi, xabar beramiz, bo'ldi. Yaqin
 * kasblar bo'lsa — pastda"):
 *  - matn → so'rovnoma oynasi (oldindan to'ldirilgan) → "Qidirish" → qisqa xulosa va bazadagi kartalar; javob matni yo'q;
 *  - kirgan ish izlovchi, topilmadi → qidiruv bazada saqlanadi (saved_searches) va "So'rovingiz saqlandi" deyiladi;
 *  - ish beruvchi: "Xodim qidirish", maosh so'ralmaydi; topilmasa — "Vakansiya joylash";
 *  - xato → "Qayta urinish"; kutish paytida "To'xtatish"; ovoz yo'q.
 */

// Ikki testda server amali ushlanadi (page.route). Ilovaning service worker'i sahifani boshqaruvga olgach, Playwright so'rovni
// ushlamay qolishi mumkin (vaqtga bog'liq — CI'da bir marta haqiqiy serverga o'tib ketdi), shuning uchun bu faylda service
// worker o'chirilgan. Yordamchining o'zi service worker'ga bog'liq emas (POST keshlanmaydi).
test.use({ serviceWorkers: "block" });

const main = (page: Page) => page.getByRole("main");
const field = (page: Page) => main(page).getByLabel("Nima qidiryapsiz?");

async function say(page: Page, text: string) {
  await field(page).fill(text);
  await main(page).getByRole("button", { name: "Topish", exact: true }).click();
}

async function open(page: Page) {
  await page.goto("/ai");
  await expect(field(page)).toBeVisible();
  // skriptlar yuklangan (yozish maydoni ishlaydi)
  await expect(page.locator("form[data-state][data-hydrated]")).toHaveCount(1);
}

/** server amallari (Next server action) — /ai sahifasiga POST, "next-action" sarlavhasi bilan */
const isAction = (r: import("@playwright/test").Request) => r.method() === "POST" && !!r.headers()["next-action"];

const TITLE = "Buxgalter (Yordamchi so'rovnoma)";

test.beforeEach(async () => {
  await sql("delete from public.vacancies where owner_profile_id = $1", [USERS.employer]);
  await sql(
    `insert into public.employer_profiles (profile_id, employer_type, display_name, onboarding_completed_at)
     values ($1, 'person', 'Dilnoza opa', now()) on conflict (profile_id) do nothing`,
    [USERS.employer],
  );
  await sql(
    `insert into public.vacancies (owner_profile_id, title, region_id, profession_node_id, description, status, salary_from, salary_type, published_at, expires_at)
     select $1, $2, r.id, n.id, 'Sinov e''loni: ish vaqti 9 dan 18 gacha, tushlik bilan.', 'active', 6000000, 'monthly', now(), now() + interval '10 days'
     from public.regions r
     cross join (select id from public.profession_nodes where name_uz = 'Buxgalter' and selectable order by depth limit 1) n
     where r.slug = 'tashkent_city'`,
    [USERS.employer, TITLE],
  );
});
test.afterAll(async () => {
  await sql("delete from public.vacancies where owner_profile_id = $1", [USERS.employer]);
  await sql("delete from public.saved_searches where profile_id = $1", [USERS.workerB]);
});

test("matn → so'rovnoma (kasb, hudud oldindan to'ldirilgan; maosh so'ralmaydi) → «Qidirish» → qisqa xulosa va kartalar; AI matni yo'q", async ({ page, context }) => {
  await asGuest(context);
  await asMode(context, "worker");
  await open(page);
  await say(page, "Toshkentda buxgalter 5 mln");
  const sheet = page.getByRole("dialog", { name: "Ish qidirish" });
  await expect(sheet.getByLabel("Qanday ish?")).toHaveValue("Buxgalter");
  await expect(sheet.getByLabel("Qaysi hududda?")).toHaveValue("tashkent_city");
  // ega (2026-11-17): "oylik maosh kerak emas" — matnda aytilgan bo'lsa ham so'ralmaydi va qidiruvga qo'shilmaydi
  await expect(sheet.locator("[data-quick-salary]")).toHaveCount(0);
  // fokus "Qidirish"da — telefonda klaviatura o'zi chiqmaydi
  await expect(sheet.locator("[data-quick-submit]")).toBeFocused();
  const answer = await quickSearch(page);
  await expect(answer.locator("[data-quick-summary] span")).toHaveText(["Buxgalter", "Toshkent shahri"]);
  await expect(answer.locator("[data-quick-found]")).toHaveText("1 ta ish topildi");
  await expect(answer.locator("article")).toHaveCount(1);
  await expect(answer.locator("article")).toContainText(TITLE);
  await expect(main(page).locator("[data-ai-reply], [data-ai-trace], [data-ai-suggestions]")).toHaveCount(0);
});

test("karta (ega, 2026-11-19): alohida rangda; «E'lonni to'liq ko'rish» — hamma ma'lumot tartib bilan, telefon bosilsa qo'ng'iroq", async ({ page, context }) => {
  const [v] = await sql<{ id: string }>("select id from public.vacancies where title = $1", [TITLE]);
  await sql(
    `insert into public.vacancy_contacts (vacancy_id, phone, show_phone) values ($1, '+998901112244', true)
     on conflict (vacancy_id) do update set phone = excluded.phone, show_phone = true`,
    [v!.id],
  );
  await asGuest(context);
  await asMode(context, "worker");
  await open(page);
  await say(page, "Toshkentda buxgalter");
  // ega (2026-11-19): topilganlar yashirin — "1 ta ish topildi" yonida ko'z belgili "Ko'rish", bosilsa kartalar ochiladi
  const answer = await quickSearch(page, { show: false });
  await expect(answer.locator("[data-quick-found]")).toHaveText("1 ta ish topildi");
  await expect(answer.locator("article")).toHaveCount(0);
  const show = answer.getByRole("button", { name: "Ko'rish" });
  await expect(show).toHaveAttribute("aria-expanded", "false");
  await show.click();
  await expect(answer.getByRole("button", { name: "Yashirish" })).toHaveAttribute("aria-expanded", "true");
  const card = answer.locator("[data-ai-card='job']");
  await expect(card).toHaveCount(1);
  // yopiq holatda: tafsilot ham, raqam ham yo'q (raqam faqat bosilganda, limit bilan)
  await expect(card.locator("[data-ai-card-details]")).toHaveCount(0);
  await expect(card.locator("a[href^='tel:']")).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText("90 111 22 44");

  await card.getByRole("button", { name: "E'lonni to'liq ko'rish" }).click();
  const details = card.locator("[data-ai-card-details]");
  await expect(details.locator("[data-ai-card-about]")).toContainText("Sinov e'loni: ish vaqti 9 dan 18 gacha, tushlik bilan.");
  for (const label of ["Manzil", "Ish grafigi", "Tajriba", "Bandlik turi"]) await expect(details.locator("dt", { hasText: label })).toHaveCount(1);
  // telefon: katta "Qo'ng'iroq qilish" va raqamning o'zi — ikkalasi ham qo'ng'iroq
  await expect(details.locator("[data-ai-card-phone] a[href='tel:+998901112244']")).toHaveCount(2);
  await expect(details.locator("[data-ai-card-phone]")).toContainText("+998 90 111 22 44");
  await expect(details.locator("[data-ai-card-apply]")).toHaveAttribute("href", /\?apply=1$/);

  await card.getByRole("button", { name: "Yopish" }).click();
  await expect(details).toHaveCount(0);
  await answer.getByRole("button", { name: "Yashirish" }).click();
  await expect(answer.locator("article")).toHaveCount(0);
  await sql("delete from public.vacancy_contacts where vacancy_id = $1", [v!.id]);
});

test("kirgan ish izlovchi, topilmadi → «So'rovingiz saqlandi», qidiruv bazada; pastda shunga yaqin ishlar", async ({ page, context }) => {
  await sql("delete from public.saved_searches where profile_id = $1", [USERS.workerB]);
  await loginAs(context, USERS.workerB, "aal2");
  await asMode(context, "worker");
  await open(page);
  await say(page, "Samarqandda buxgalter");
  const answer = await quickSearch(page);
  const none = answer.locator("[data-quick-none]");
  await expect(none).toHaveAttribute("data-save", "saved");
  await expect(none).toHaveText(/Hozircha bunday ish yo'q\.\s*So'rovingiz saqlandi\. Mos ish chiqsa, sizga xabar beramiz\./);
  // haqiqatan saqlangan: kasb va viloyat bilan (kuniga bir marta tekshiriladi — mos yangi e'lon bo'lsa bildirishnoma)
  const rows = await sql<{ q: string; region: string; salary_min: number | null; notify: boolean }>(
    "select s.q, r.slug as region, s.salary_min, s.notify from public.saved_searches s left join public.regions r on r.id = s.region_id where s.profile_id = $1",
    [USERS.workerB],
  );
  expect(rows).toEqual([{ q: "Buxgalter", region: "samarkand", salary_min: null, notify: true }]);
  // pastda — shu kasb boshqa hududda (Toshkentdagi e'lon)
  await expect(answer.locator("[data-quick-similar]")).toContainText("Shunga yaqin ishlar");
  await expect(answer.locator("[data-quick-similar] article")).toContainText(TITLE);

  // xuddi shu so'rov yana — ikkinchi nusxa yozilmaydi, xabar o'sha
  await say(page, "Samarqandda buxgalter");
  const again = await quickSearch(page);
  await expect(again.locator("[data-quick-none]")).toContainText("So'rovingiz saqlandi.");
  const [count] = await sql<{ n: string }>("select count(*)::text as n from public.saved_searches where profile_id = $1", [USERS.workerB]);
  expect(count!.n).toBe("1");
});

test("ish beruvchi: «Xodim qidirish» — maosh so'ralmaydi; topilmasa — qisqa xabar va «Vakansiya joylash»", async ({ page, context }) => {
  await loginAs(context, USERS.employer);
  await asMode(context, "employer");
  await open(page);
  await expect(field(page)).toHaveAttribute("placeholder", /Kim kerak/);
  await say(page, "Termizda kosmonavt kerak");
  const sheet = page.getByRole("dialog", { name: "Xodim qidirish" });
  await expect(sheet.getByLabel("Qanday xodim kerak?")).toBeVisible();
  await expect(sheet.getByLabel("Qaysi hududdan?")).toBeVisible();
  await expect(sheet.locator("[data-quick-salary]")).toHaveCount(0);
  const answer = await quickSearch(page);
  await expect(answer.locator("[data-quick-none]")).toContainText("Hozircha mos nomzod yo'q.");
  // yordamchi bilan vakansiya, yozgani bilan darhol boshlanadi (2026-11-20)
  await expect(answer.getByRole("link", { name: "Vakansiya joylash" })).toHaveAttribute("href", "/post/vacancy?ai=1&q=Termizda+kosmonavt+kerak");
});

test("xato: tushunarli xabar va «Qayta urinish» — qayta urinilsa so'rovnoma ochiladi; xatodan keyin ham yozish mumkin", async ({ page, context }) => {
  await asGuest(context);
  await asMode(context, "worker");
  await open(page);
  let fail = true;
  await page.route("**/ai", (route) => (fail && isAction(route.request()) ? route.abort() : route.continue()));
  await say(page, "Toshkentda buxgalter");
  await expect(main(page).getByRole("alert")).toBeVisible();
  fail = false;
  await main(page).getByRole("button", { name: "Qayta urinish" }).click();
  const answer = await quickSearch(page);
  await expect(answer.locator("[data-quick-found]")).toHaveText("1 ta ish topildi");
});

test("kutish holati ko'rinadi; «To'xtatish» bosilsa — «To'xtatildi», suhbat davom etadi", async ({ page, context }) => {
  await asGuest(context);
  await asMode(context, "worker");
  await open(page);
  let release: () => void = () => {};
  let hold = true;
  await page.route("**/ai", async (route) => {
    if (!hold || !isAction(route.request())) return route.continue();
    await new Promise<void>((r) => (release = r));
    await route.abort().catch(() => undefined);
  });
  await say(page, "Toshkentda buxgalter");
  await expect(main(page).getByRole("status")).toContainText("So'zlaringizni tushunmoqdaman");
  await expect(main(page).locator("form[data-state]")).toHaveAttribute("data-state", "processing");
  // kutilayotganda yuborish tugmasi o'rnida — to'xtatish
  await expect(main(page).getByRole("button", { name: "Topish" })).toHaveCount(0);
  await main(page).getByRole("button", { name: "Javobni to'xtatish" }).click();
  await expect(main(page).getByText("To'xtatildi").last()).toBeVisible();
  await expect(main(page).locator("form[data-state]")).toHaveAttribute("data-state", "idle");
  hold = false;
  release();
  await say(page, "Toshkentda buxgalter");
  const answer = await quickSearch(page);
  await expect(answer.locator("[data-quick-found]")).toHaveText("1 ta ish topildi");
});

test("ovoz yo'q: brauzer ovozni qo'llasa ham — mikrofon, «Ovoz bilan javob», «O'qib berish» ko'rinmaydi; hech narsa o'qib berilmaydi", async ({ page, context }) => {
  await context.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>;
    w.__spoken = [];
    w.SpeechSynthesisUtterance = class {
      text: string;
      constructor(text: string) {
        this.text = text;
      }
    };
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: {
        getVoices: () => [{ lang: "uz-UZ", name: "Madina" }],
        speak: (u: { text: string }) => (w.__spoken as unknown[]).push(u.text),
        cancel: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
      },
    });
    class FakeRecognition {
      start() {}
      stop() {}
      abort() {}
    }
    Object.assign(window, { SpeechRecognition: FakeRecognition, webkitSpeechRecognition: FakeRecognition });
  });
  await asGuest(context);
  await asMode(context, "worker");
  await open(page);
  await expect(main(page).getByRole("button", { name: /Ovoz bilan|Gapirib/ })).toHaveCount(0);
  await say(page, "Toshkentda buxgalter");
  await quickSearch(page);
  await expect(main(page).getByRole("button", { name: "O'qib berish" })).toHaveCount(0);
  await expect(main(page).getByRole("switch")).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { __spoken: unknown[] }).__spoken.length)).toBe(0);
});
