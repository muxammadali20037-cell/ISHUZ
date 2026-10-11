import { expect, test } from "@playwright/test";
import { USERS, asGuest, draftData, loginAs, next, pickProfession, pickWholeRegion, sql } from "../support";

/** C2/C3: til almashganda qoralama va filtrlar saqlanadi; ikki marta bosish bitta e'lon yaratadi */

async function switchLanguage(page: import("@playwright/test").Page, label: string) {
  await page.getByRole("combobox", { name: /Til · Тил · Язык · Language/ }).selectOption({ label });
}

test("til almashganda e'lon qoralamasi yo'qolmaydi", async ({ page, context }) => {
  await loginAs(context, USERS.workerB);
  await page.goto("/post/worker");
  await pickProfession(page, "Buxgalter", "Buxgalter");
  const key = `ib_draft:v2:worker:new:u:${USERS.workerB}`;
  await expect.poll(async () => (await draftData(page, key))?.profession ?? null).not.toBeNull();

  await switchLanguage(page, "Русский");
  await expect(page.locator("html")).toHaveAttribute("lang", "ru");
  const data = await draftData(page, key);
  expect((data?.profession as { trail: { name_uz: string }[] } | null)?.trail.at(-1)?.name_uz).toBe("Buxgalter");
  await expect(page.getByText("Бухгалтер").first()).toBeVisible();
  await switchLanguage(page, "O'zbekcha");
});

test("til almashganda qidiruv filtrlari URL'da saqlanadi", async ({ page, context }) => {
  await asGuest(context);
  const [n] = await sql<{ id: string }>("select id from public.profession_nodes where name_uz = 'Buxgalter' and selectable limit 1");
  const url = `/search?mode=jobs&p=${n!.id}&region=all`;
  await page.goto(url);
  await switchLanguage(page, "English");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  expect(new URL(page.url()).search).toBe(new URL(url, "http://x").search);
  await switchLanguage(page, "O'zbekcha");
});

test("e'lonni joylash tugmasini ikki marta bosish — bitta e'lon", async ({ page, context }) => {
  await sql("delete from public.vacancies where owner_profile_id = $1", [USERS.employer]);
  await loginAs(context, USERS.employer);
  await page.goto("/post/vacancy");
  await pickProfession(page, "Buxgalter", "Buxgalter");
  await next(page);
  await pickWholeRegion(page);
  await next(page);
  await page.getByRole("radio", { name: "O'zim uchun" }).click();
  await page.locator("#org").fill("Dilnoza opa");
  await page.locator("#desc").fill("Kichik do'konga buxgalter kerak, haftasiga 3 kun, tushlik bepul");
  await page.getByText("Kelishiladi", { exact: true }).first().click();
  await next(page);
  await page.getByRole("button", { name: /E'lonni joylash/ }).dblclick();
  await expect(page.getByText(/joylandi|saqlandi/i).first()).toBeVisible({ timeout: 30_000 });
  // fon jarayonlari ham tugashini kutib, qayta sanaymiz
  await page.waitForTimeout(1500);
  const [c] = await sql<{ n: string }>("select count(*) as n from public.vacancies where owner_profile_id = $1", [USERS.employer]);
  expect(Number(c!.n)).toBe(1);
  await sql("delete from public.vacancies where owner_profile_id = $1", [USERS.employer]);
});
