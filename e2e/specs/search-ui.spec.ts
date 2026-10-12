import { expect, test } from "@playwright/test";
import { USERS, asGuest, sql } from "../support";

/**
 * C8.3 · qidiruv, filtr, kartalar: rasm ochilmasa — buzilgan belgi emas, kasb tasviri; bo'sh natija holatga mos gapiradi
 * va foydasiz tugma bermaydi; filtr oynasi URL bilan sinxron; maqsad kartalari bitta aksent rangda.
 */

async function nodeId(name: string) {
  const [r] = await sql<{ id: string }>("select id from public.profession_nodes where name_uz = $1 and selectable limit 1", [name]);
  return r!.id;
}

test.beforeEach(async () => {
  await sql("delete from public.vacancies where owner_profile_id = $1", [USERS.employer]);
});
test.afterAll(async () => {
  await sql("delete from public.vacancies where owner_profile_id = $1", [USERS.employer]);
});

test("ish joyi surati ochilmasa — buzilgan rasm va alt-matn o'rniga kasb tasviri", async ({ page, context }) => {
  await asGuest(context);
  const oshpaz = await nodeId("Oshpaz");
  const [r] = await sql<{ id: string }>("select id from public.regions where slug = 'tashkent_city'");
  await sql(
    `insert into public.vacancies (owner_profile_id, title, region_id, description, status, profession_node_id, salary_negotiable, published_at, expires_at, photo_path)
     values ($1, 'Oshpaz', $2, 'Sinov: kafega oshpaz kerak, tajriba shart emas', 'active', $3, true, now(), now() + interval '10 days', $4)`,
    [USERS.employer, r!.id, oshpaz, `${USERS.employer}/00000000-0000-4000-8000-00000000dead.jpg`],
  );
  await page.goto(`/search?mode=jobs&p=${oshpaz}&region=all`);
  const card = page.locator("main article").first();
  await expect(card).toBeVisible();
  // rasm 404 → zaxira (role=img, kasb nomi bilan); sahifada buzilgan <img> qolmaydi
  await expect(card.getByRole("img", { name: "Oshpaz" })).toBeVisible();
  const broken = await page.evaluate(() => Array.from(document.querySelectorAll("main img")).filter((i) => (i as HTMLImageElement).complete && (i as HTMLImageElement).naturalWidth === 0).length);
  expect(broken).toBe(0);
  await expect(card.getByText("Ish joyi surati", { exact: true })).toHaveCount(0);
});

test("bo'sh natija: butun O'zbekiston — kasb nomi bilan, 'hududni o'zgartirish' yo'q", async ({ page, context }) => {
  await asGuest(context);
  await page.goto(`/search?mode=jobs&p=${await nodeId("Haydovchi")}&region=all`);
  await expect(page.getByRole("heading", { level: 2 })).toHaveText("Hozircha «Haydovchi» bo'yicha ish e'loni yo'q");
  await expect(page.getByRole("link", { name: "Hududni o'zgartirish" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Kasbni o'zgartirish" })).toBeVisible();
});

test("bo'sh natija: viloyat — 'bu hududda', butun O'zbekistonga kengaytirish", async ({ page, context }) => {
  await asGuest(context);
  await page.goto(`/search?mode=workers&p=${await nodeId("Haydovchi")}&region=tashkent_city&district=all`);
  await expect(page.getByRole("heading", { level: 2 })).toHaveText("Bu hududda hozircha ishchi topilmadi");
  await page.getByRole("link", { name: "Butun O'zbekistonda qidirish" }).click();
  await page.waitForURL(/region=all/);
});

test("bo'sh natija filtr tufayli — 'Filtrlarsiz qidirish' filtrlarni olib tashlaydi", async ({ page, context }) => {
  await asGuest(context);
  const p = await nodeId("Haydovchi");
  await page.goto(`/search?mode=jobs&p=${p}&region=all&salary=90000000&noexp=1`);
  await page.getByRole("link", { name: "Filtrlarsiz qidirish" }).click();
  await page.waitForURL((u) => u.searchParams.get("p") === p && !u.searchParams.has("salary") && !u.searchParams.has("noexp"));
});

test("filtr: 'Filtrni tozalash'dan keyin oyna qayta ochilsa eski tanlov ko'rinmaydi", async ({ page, context }) => {
  await asGuest(context);
  await page.goto(`/search?mode=jobs&p=${await nodeId("Haydovchi")}&region=all`);
  await page.getByRole("button", { name: /^Filtr/ }).click();
  const noexp = page.getByRole("dialog").getByRole("checkbox", { name: "Tajribasiz ham olinadi" });
  await noexp.check();
  await page.getByRole("button", { name: "Natijalarni ko'rsatish" }).click();
  await page.waitForURL(/noexp=1/);
  await page.getByRole("button", { name: /^Filtr/ }).click();
  await expect(page.getByRole("dialog").getByRole("checkbox", { name: "Tajribasiz ham olinadi" })).toBeChecked();
  await page.getByRole("button", { name: "Filtrni tozalash" }).click();
  await page.waitForURL((u) => !u.searchParams.has("noexp"));
  await page.getByRole("button", { name: /^Filtr/ }).click();
  await expect(page.getByRole("dialog").getByRole("checkbox", { name: "Tajribasiz ham olinadi" })).not.toBeChecked();
});

test("qidiruv boshi: ikki teng neytral karta (rangli dominant sirt yo'q)", async ({ page, context }) => {
  await asGuest(context);
  await page.goto("/search");
  for (const name of [/^Ish qidiraman/, /^Ishchi qidiraman/]) await expect(page.getByRole("link", { name })).toBeVisible();
  const big = await page.evaluate(() => {
    const css = getComputedStyle(document.documentElement);
    const brand = ["--primary", "--success"].map((v) => css.getPropertyValue(v).trim());
    const hex = (rgb: string) => `#${(rgb.match(/\d+/g) ?? []).slice(0, 3).map((n) => Number(n).toString(16).padStart(2, "0")).join("")}`;
    return Array.from(document.querySelectorAll<HTMLElement>("main *")).filter((el) => brand.includes(hex(getComputedStyle(el).backgroundColor)) && el.getBoundingClientRect().height >= 80).length;
  });
  expect(big).toBe(0);
});
