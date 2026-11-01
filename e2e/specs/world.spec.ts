import { expect, test } from "@playwright/test";
import { USERS, asGuest, asMode, loginAs, sql } from "../support";

/**
 * "Mening dunyom" (2026-11, 0073): kirgan ish qidiruvchi qiziqishlarini tanlaydi → bosh sahifa shunga moslashadi.
 *  - mehmon /dunyo → kirishga (qaytish manzili bilan);
 *  - bosh sahifada "Dunyongizni yarating" va "Bugungi rejangiz" (haqiqiy holat: 0 dan boshlanadi);
 *  - 2 soha + hudud → "Dunyongiz tayyor!" → bazada aynan 2 ta qiziqish, hudud eslab qolingan;
 *  - bosh sahifada "Mening dunyom": tanlangan sohalar havolalari, reja qadamida "Qiziqishlar" bajarilgan.
 */
test.beforeEach(async () => {
  await sql("delete from public.profile_interests where profile_id = $1", [USERS.workerB]);
});
test.afterAll(async () => {
  await sql("delete from public.profile_interests where profile_id = $1", [USERS.workerB]);
});

test("mehmon: /dunyo — kirishga yo'naltiriladi", async ({ page, context }) => {
  await asGuest(context);
  await page.goto("/dunyo");
  await expect(page).toHaveURL(/\/auth\?next=%2Fdunyo/);
});

test("dunyo yaratish: sohalar → hudud → tayyor; bosh sahifa moslashadi", async ({ page, context }) => {
  await loginAs(context, USERS.workerB);
  await asMode(context, "worker");
  await page.goto("/");
  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { name: "Dunyongizni yarating" })).toBeVisible();
  await expect(main.getByRole("heading", { name: "Bugungi rejangiz" })).toBeVisible();
  await main.getByRole("link", { name: "Boshlash" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Sizni nimalar qiziqtiradi?" })).toBeVisible();
  const next = page.getByRole("button", { name: "Keyingi" });
  await expect(next).toBeDisabled();
  const [a, b] = await sql<{ name_uz: string; slug: string }>("select name_uz, slug from public.categories order by sort_order limit 2");
  await page.getByRole("checkbox", { name: new RegExp(`^${a!.name_uz}`) }).check({ force: true });
  await page.getByRole("checkbox", { name: new RegExp(`^${b!.name_uz}`) }).check({ force: true });
  await expect(page.getByText("2 / 8 tanlandi")).toBeVisible();
  await next.click();

  await expect(page.getByRole("heading", { level: 1, name: "Qayerda ish qidiryapsiz?" })).toBeVisible();
  await page.getByRole("radio", { name: "Toshkent shahri" }).check({ force: true });
  await page.getByRole("button", { name: "Dunyomni yaratish" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Dunyongiz tayyor!" })).toBeVisible();

  const rows = await sql<{ n: string }>("select count(*)::text as n from public.profile_interests where profile_id = $1", [USERS.workerB]);
  expect(rows[0]!.n).toBe("2");
  expect((await context.cookies()).find((c) => c.name === "ib_place")?.value).toMatch(/^tashkent_city~all$/);

  await page.getByRole("link", { name: "Dunyomga kirish" }).click();
  await expect(main.getByRole("heading", { name: /Sohalaringizda/ })).toBeVisible();
  await expect(main.getByRole("link", { name: new RegExp(`^${a!.name_uz}`) }).first()).toHaveAttribute("href", new RegExp(`category=${a!.slug}`));
  await expect(main.getByText("Qiziqishlaringizni tanlang")).toHaveClass(/line-through/);
});
