import { expect, test } from "@playwright/test";
import { USERS, asGuest, asMode, loginAs, next, pickProfession, pickWholeRegion, sql } from "../support";

/**
 * D3/R-C · bosh sahifadagi tezkor bo'limlar va "Kunlik ishlar":
 *  - ish beruvchi bosh sahifasi: admin sozlaydigan rasmli oynalar (xodim topish, yaqin atrofdagilar, e'lon berish);
 *  - ish izlovchi bosh sahifasi (2.0, 2026-11): oynalar yo'q — qidiruv ostida 4 ta tez yo'l (kunlik, yaqin, masofaviy, tajribasiz);
 *  - ish beruvchi oddiy formada "Kunlik" haq tanlaydi → bazada kunlik → "Kunlik ish" tez yo'li faqat kunliklarni ko'rsatadi.
 */

async function nodeId(name: string) {
  const [r] = await sql<{ id: string }>("select id from public.profession_nodes where name_uz = $1 and selectable limit 1", [name]);
  return r!.id;
}

test.beforeEach(async () => {
  await sql("delete from public.vacancies where owner_profile_id = $1", [USERS.employer]);
  await sql(
    `insert into public.employer_profiles (profile_id, employer_type, display_name, onboarding_completed_at)
     values ($1, 'person', 'Dilnoza opa', now()) on conflict (profile_id) do nothing`,
    [USERS.employer],
  );
});
test.afterEach(async () => {
  await sql("delete from public.vacancies where owner_profile_id = $1", [USERS.employer]);
});

test("bosh sahifa (ish izlovchi, 2.0): rasmli oynalar yo'q — 4 ta tez yo'l qidiruv ostida, e'lonlardan oldin; har biri bir bosishda natijaga olib boradi", async ({ page, context }) => {
  await asGuest(context);
  await asMode(context, "worker");
  await page.goto("/");
  // 2.0: ish izlovchi bosh sahifasida admin oynalari ko'rsatilmaydi (bitta vazifa — qidiruv)
  await expect(page.getByRole("region", { name: "Tezkor bo'limlar" })).toHaveCount(0);
  const links = page.getByRole("navigation", { name: "Tez qidiruv" }).getByRole("listitem").getByRole("link");
  await expect(links).toHaveCount(4);
  await expect(links.nth(0)).toHaveText("Kunlik ish");
  await expect(links.nth(1)).toHaveText("Yaqin atrofda");
  await expect(links.nth(2)).toHaveText("Masofaviy");
  await expect(links.nth(3)).toHaveText("Tajribasiz");
  // qidiruv maydoni tepada, tez yo'llar uning ostida va e'lonlar ro'yxatidan oldin; har biri barmoq bilan bosishga qulay (≥ 44px)
  const field = (await page.locator("form[data-ai-field]").boundingBox())!;
  const feed = (await page.locator("#home-feed").boundingBox())!;
  expect(field.y).toBeLessThan(400);
  for (let i = 0; i < 4; i++) {
    const box = (await links.nth(i).boundingBox())!;
    expect(box.y).toBeGreaterThan(field.y);
    expect(box.y + box.height).toBeLessThanOrEqual(feed.y);
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
  // telefonda sahifa yonga siljimaydi
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

  // kunlik ishlar: kasb ham, hudud ham so'ralmaydi — darhol natijalar
  await links.nth(0).click();
  await page.waitForURL(/\/search\?mode=jobs&region=all&pay=daily$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Kunlik ishlar");
  await page.goBack();
  await page.getByRole("navigation", { name: "Tez qidiruv" }).getByRole("link", { name: "Masofaviy", exact: true }).click();
  await page.waitForURL(/\/search\?mode=jobs&region=remote/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("bosh sahifa (ish beruvchi): xodim topish, yaqin atrofdagi ishchilar, ish e'loni berish", async ({ page, context }) => {
  await asGuest(context);
  await asMode(context, "employer");
  await page.goto("/");
  const links = page.getByRole("region", { name: "Tezkor bo'limlar" }).getByRole("link");
  await expect(links).toHaveCount(3);
  await expect(links.nth(0)).toContainText("Endi xodim topish oson");
  await expect(links.nth(1)).toContainText("Yaqin atrofdagi ishchilar");
  await expect(links.nth(2)).toContainText("Ish e'loni bering");
  await links.nth(0).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ishchi qidiraman");
});

test("kunlik ish: formada 'Kunlik' → bazada kunlik → 'Kunlik ishlar'da faqat kunliklar", async ({ page, context }) => {
  test.setTimeout(90_000);
  // oylik e'lon (kunlik ro'yxatida chiqmasligi kerak)
  const [r] = await sql<{ id: string }>("select id from public.regions where slug = 'tashkent_city'");
  await sql(
    `insert into public.vacancies (owner_profile_id, title, region_id, description, status, profession_node_id, salary_from, salary_type, published_at, expires_at)
     values ($1, 'Oshpaz', $2, 'Oylik ish: oshxonada doimiy oshpaz kerak', 'active', $3, 5000000, 'monthly', now(), now() + interval '10 days')`,
    [USERS.employer, r!.id, await nodeId("Oshpaz")],
  );

  await loginAs(context, USERS.employer);
  await asMode(context, "employer");
  await page.goto("/post/vacancy");
  await pickProfession(page, "Buxgalter", "Buxgalter");
  await next(page);
  await pickWholeRegion(page);
  await next(page);
  await page.getByRole("radio", { name: "O'zim uchun" }).click();
  await page.locator("#org").fill("Dilnoza opa");
  await page.locator("#desc").fill("Bir kunlik ish: do'kon hisobotlarini tartiblash, 9 dan 18 gacha");
  await page.getByRole("radiogroup", { name: "Haq qanday to'lanadi?" }).getByRole("radio", { name: /^Kunlik/ }).click();
  await expect(page.getByText("Maosh (so'm, kuniga)")).toBeVisible();
  await page.locator("#salary-from").fill("250000");
  await next(page);
  await page.getByRole("button", { name: /E'lonni joylash/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: /joylandi/i })).toBeVisible({ timeout: 30_000 });
  const [v] = await sql<{ salary_type: string; salary_from: number }>(
    "select salary_type, salary_from from public.vacancies where owner_profile_id = $1 and title <> 'Oshpaz'",
    [USERS.employer],
  );
  expect(v).toEqual({ salary_type: "daily", salary_from: 250000 });

  // mehmon bosh sahifadagi "Kunlik ish" tez yo'lidan: bir bosishda natijalar — faqat kunlik e'lon
  await asGuest(context);
  await asMode(context, "worker");
  await page.goto("/");
  await page.getByRole("navigation", { name: "Tez qidiruv" }).getByRole("link", { name: "Kunlik ish", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Kunlik ishlar");
  const cards = page.locator("main article");
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toContainText("Buxgalter");
  await expect(cards.first()).toContainText("/kun");
  await expect(page.locator("main article").filter({ hasText: "Oshpaz" })).toHaveCount(0);
});
