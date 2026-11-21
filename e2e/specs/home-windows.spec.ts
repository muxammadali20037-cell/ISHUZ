import { expect, test } from "@playwright/test";
import { USERS, asGuest, asMode, loginAs, next, pickProfession, pickWholeRegion, sql } from "../support";

/**
 * "Kunlik ishlar": ish beruvchi oddiy formada "Kunlik" haq tanlaydi → bazada kunlik → "Kunlik ishlar" ro'yxatida faqat kunliklar.
 * 2026-11-21: bosh sahifa — chat; reklama sahifasidagi "Bo'limlar" tez yo'llari olib tashlandi — ularning testlari ham.
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

  // mehmon "Kunlik ishlar" ro'yxatida (2026-11-21: bosh sahifa — chat, tez yo'llar yo'q) — faqat kunlik e'lon
  await asGuest(context);
  await asMode(context, "worker");
  await page.goto("/search?mode=jobs&region=all&pay=daily");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Kunlik ishlar");
  const cards = page.locator("main article");
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toContainText("Buxgalter");
  await expect(cards.first()).toContainText("/kun");
  await expect(page.locator("main article").filter({ hasText: "Oshpaz" })).toHaveCount(0);
});
