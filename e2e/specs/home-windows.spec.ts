import { expect, test } from "@playwright/test";
import { USERS, asGuest, loginAs, next, pickProfession, pickWholeRegion, sql } from "../support";

/**
 * D3 · bosh sahifa tepasidagi rasmli oynalar (xodim topish, mos ish, kunlik ishlar) va "Kunlik ishlar":
 * ish beruvchi oddiy formada "Kunlik" haq tanlaydi → bazada kunlik → "Kunlik ishlar" oynasi faqat kunliklarni ko'rsatadi.
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

test("bosh sahifa: tepada uchta rasmli oyna, nomi rasm ostida; har biri o'z bo'limiga olib boradi", async ({ page, context }) => {
  await asGuest(context);
  await page.goto("/");
  const windows = page.getByRole("region", { name: "Tezkor bo'limlar" });
  const links = windows.getByRole("link");
  await expect(links).toHaveCount(3);
  await expect(links.nth(0)).toContainText("Endi xodim topish oson");
  await expect(links.nth(1)).toContainText("Endi o'zingizga mos ish topish oson");
  await expect(links.nth(2)).toContainText("Kunlik ishlar");
  // oynalar sahifaning eng tepasida — sarlavhadan oldin; rasm nomdan yuqorida
  const first = links.nth(0);
  const art = await first.locator("svg").boundingBox();
  const title = await first.getByText("Endi xodim topish oson").boundingBox();
  expect(art!.y + art!.height).toBeLessThanOrEqual(title!.y + 1);
  expect(title!.y).toBeLessThan((await page.getByRole("heading", { level: 1, name: "Ish topdim" }).boundingBox())!.y);
  // telefonda sahifa yonga siljimaydi (oynalar o'z qatorida suriladi)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  // ixcham (my.gov.uz kabi): telefonda ikkitasi to'liq ko'rinadi, oyna past, izoh yo'q — sarlavha birinchi ekranning yuqori qismida
  const second = (await links.nth(1).boundingBox())!;
  expect(second.x + second.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  expect((await first.boundingBox())!.height).toBeLessThanOrEqual(210);
  await expect(first.getByText("Kasb va hududni tanlang — mos ishchilar darhol chiqadi")).toBeHidden();
  expect((await page.getByRole("heading", { level: 1, name: "Ish topdim" }).boundingBox())!.y).toBeLessThan(340);

  await links.nth(0).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ishchi qidiraman");
  await page.goBack();
  await page.getByRole("region", { name: "Tezkor bo'limlar" }).getByRole("link").nth(1).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ish qidiraman");
  await page.goBack();
  await page.getByRole("region", { name: "Tezkor bo'limlar" }).getByRole("link").nth(2).click();
  // kunlik ishlar: kasb so'ralmaydi — darhol hudud
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Qaysi viloyatda?");
  await expect(page.getByText("Ish e'lonlari · Kunlik ishlar")).toBeVisible();
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

  // mehmon "Kunlik ishlar" oynasidan: hudud → butun shahar → faqat kunlik e'lon
  await asGuest(context);
  await page.goto("/");
  await page.getByRole("region", { name: "Tezkor bo'limlar" }).getByRole("link", { name: /Kunlik ishlar/ }).click();
  await page.getByRole("link", { name: "Toshkent shahri", exact: true }).click();
  await page.getByRole("link", { name: /^Butun shahar/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Kunlik ishlar");
  const cards = page.locator("main article");
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toContainText("Buxgalter");
  await expect(cards.first()).toContainText("/kun");
  await expect(page.locator("main article").filter({ hasText: "Oshpaz" })).toHaveCount(0);
});
