import { expect, test, type Page } from "@playwright/test";
import { USERS, asGuest, asMode, sql } from "../support";

/**
 * AI yordamchi — bozor statistikasi va maslahat (stendda AI kaliti yo'q: lug'at rejimi, lekin sonlar bazadan):
 *  - "… maoshi qancha?" → karta: faol vakansiyalar, ish izlovchilar, oylik maosh oralig'i (faqat bazadagi e'lonlardan),
 *    vakansiyalar ro'yxatiga havola; javob matnida halol izoh;
 *  - kasb aytilmasa — so'raladi, keyingi xabar ("buxgalter") bilan davom etadi;
 *  - maslahat (karyera, rezyume) — "AI ulanmagan" degan boshi berk javob emas, bosqichma-bosqich yo'riqnoma.
 */
test.use({ serviceWorkers: "block" });

const TAG = "(AI statistika)";
const main = (page: Page) => page.getByRole("main");
const field = (page: Page) => main(page).getByLabel("Nima qidiryapsiz?");
const replies = (page: Page) => main(page).locator("[data-ai-reply]");

async function say(page: Page, text: string) {
  await field(page).fill(text);
  await main(page).getByRole("button", { name: "Topish", exact: true }).click();
}

test.beforeAll(async () => {
  await sql("delete from public.vacancies where owner_profile_id = $1", [USERS.employer]);
  await sql(
    `insert into public.employer_profiles (profile_id, employer_type, display_name, onboarding_completed_at)
     values ($1, 'person', 'Dilnoza opa', now()) on conflict (profile_id) do nothing`,
    [USERS.employer],
  );
  // Samarqandda 3 ta buxgalter vakansiyasi: 3 mln, 4–6 mln (o'rtasi 5 mln), 7 mln → oraliq 3–7 mln, o'rtasi 5 mln
  await sql(
    `insert into public.vacancies (owner_profile_id, title, region_id, profession_node_id, description, status, salary_from, salary_to, salary_type, published_at, expires_at)
     select $1, 'Buxgalter ' || $2 || ' ' || t.k, r.id, n.id, 'Sinov e''loni: ish vaqti 9 dan 18 gacha, tushlik bilan.', 'active', t.f, t.t, 'monthly', now(), now() + interval '10 days'
     from public.regions r
     cross join (select id from public.profession_nodes where name_uz = 'Buxgalter' and selectable order by depth limit 1) n
     cross join (values (1, 3000000, null::bigint), (2, 4000000, 6000000), (3, 7000000, null)) as t(k, f, t)
     where r.slug = 'samarkand'`,
    [USERS.employer, TAG],
  );
});
test.afterAll(async () => {
  await sql("delete from public.vacancies where owner_profile_id = $1", [USERS.employer]);
});

async function open(page: Page, context: import("@playwright/test").BrowserContext) {
  await asGuest(context);
  await asMode(context, "worker");
  await page.goto("/ai");
  await expect(field(page)).toBeVisible();
  await expect(main(page).getByRole("switch", { name: "Ovoz bilan javob" })).toBeVisible();
}

test("statistika: sonlar bazadan (karta va matn), vakansiyalarga havola; kasb aytilmasa — so'raladi va davom etadi", async ({ page, context }) => {
  const [expected] = await sql<{ n: string; seekers: string }>(
    `select (select count(*) from public.vacancies v join public.regions r on r.id = v.region_id
              where v.status = 'active' and r.slug = 'samarkand' and v.profession_node_id in (select id from public.profession_nodes where name_uz = 'Buxgalter'))::text as n,
            '0' as seekers`,
  );
  await open(page, context);
  await say(page, "Samarqandda buxgalter maoshi qancha?");
  const card = main(page).locator("[data-ai-stats]").last();
  await expect(card).toBeVisible();
  await expect(card).toContainText("Buxgalter · Samarqand");
  await expect(card.locator("[data-ai-stats-vacancies]")).toHaveText(expected!.n);
  await expect(card.locator("[data-ai-stats-salary]")).toHaveText("5 mln so'm");
  await expect(card).toContainText("Oraliq: 3 mln so'm – 7 mln so'm (3 ta e'lon)");
  await expect(replies(page).last()).toContainText("Oylik maosh (3 ta e'londa): 3 mln so'm – 7 mln so'm, o'rtasi 5 mln so'm");
  await expect(replies(page).last()).toContainText("butun mehnat bozori emas");
  // jarayon izi: qidiruv emas — bazadan hisoblandi
  await expect(main(page).locator("[data-ai-trace]").last()).toContainText("Bazadan hisoblandi");
  // keyingi qadam: shu kasb bo'yicha haqiqiy qidiruv
  await expect(main(page).locator("[data-ai-suggestions]").getByRole("button").first()).toHaveText("Buxgalter bo'yicha ishlar Samarqand");

  // havola — shu kasb va hudud bo'yicha vakansiyalar ro'yxati (namuna e'lonlar emas, haqiqiylari)
  const href = await card.locator("[data-ai-stats-jobs]").getAttribute("href");
  expect(href).toMatch(/^\/search\?mode=jobs&p=[0-9a-f-]{36}&region=samarkand$/);

  // kasb aytilmadi — so'raladi; keyingi qisqa xabar oldingisi bilan birga tushuniladi
  await say(page, "statistika");
  await expect(replies(page).last()).toContainText("Qaysi kasb bo'yicha ko'raylik?");
  await say(page, "buxgalter");
  await expect(replies(page).last()).toContainText("Buxgalter — butun O'zbekiston:");
  await expect(main(page).locator("[data-ai-stats]").last()).toContainText("Buxgalter · Butun O'zbekiston");
});

test("maslahat AI'siz ham ishlaydi: 'Maosh va talab' tez tugmasi, karyera rejasi bosqichma-bosqich", async ({ page, context }) => {
  await open(page, context);
  // tez tugma (bosh ekranda): "Maosh va talab" — kasb so'raladi (soxta raqam yo'q)
  await page.locator("[data-ai-quick]:visible [data-quick='stats']").first().click();
  await expect(page.locator("[data-ai-you]").last()).toHaveText(/Kasbim bo'yicha maosh qancha va talab qanday\?$/);
  await expect(replies(page).last()).toContainText("Qaysi kasb bo'yicha ko'raylik?");

  await say(page, "Karyeramni rivojlantirish uchun nima qilishim kerak?");
  await expect(replies(page).last()).toContainText("Karyerani bosqichma-bosqich quramiz:");
  await expect(replies(page).last()).toContainText("«oshpaz maoshi qancha»");
  await expect(replies(page).last()).not.toContainText("ulanmagan");
  // uzun yo'riqnomadan keyin — e'lon berishga yo'l
  await expect(main(page).locator("[data-ai-reply-actions]").last().getByRole("link", { name: "O'zim haqimda e'lon berish" })).toBeVisible();
  const chips = main(page).locator("[data-ai-suggestions]").getByRole("button");
  await expect(chips).toHaveText(["Oshpaz maoshi qancha?", "Kunlik ish bormi?"]);
});
