import { expect, test } from "@playwright/test";
import { asGuest, sql } from "../support";

/** F-04: texnik xato "natija yo'q" emas; bo'sh natija statistikasi buzilmaydi; sahifa chegarasi */

async function nodeId(name: string) {
  const [r] = await sql<{ id: string }>("select id from public.profession_nodes where name_uz = $1 and selectable limit 1", [name]);
  return r!.id;
}

async function zeroLogs() {
  const [r] = await sql<{ n: string }>("select count(*) as n from public.search_logs where results_count = 0");
  return Number(r!.n);
}

const SIG =
  "public.simple_search_vacancies(uuid, uuid, uuid, boolean, integer, public.work_schedule, boolean, integer, integer)";

async function setSearchBroken(broken: boolean) {
  // funksiya vaqtincha nomini o'zgartiradi → PostgREST "funksiya topilmadi" (haqiqiy RPC xatosi)
  if (broken) await sql(`alter function ${SIG} rename to simple_search_vacancies_e2e_off`);
  else await sql(`alter function ${SIG.replace("simple_search_vacancies", "simple_search_vacancies_e2e_off")} rename to simple_search_vacancies`);
  await sql("notify pgrst, 'reload schema'");
  await new Promise((r) => setTimeout(r, 1500));
}

test.afterEach(async () => {
  const [r] = await sql<{ n: string }>("select count(*) as n from pg_proc where proname = 'simple_search_vacancies_e2e_off'");
  if (Number(r!.n)) await setSearchBroken(false);
});

test("bo'sh natija — 'topilmadi', statistikaga bo'sh qidiruv bo'lib yoziladi", async ({ page, context }) => {
  await asGuest(context);
  const before = await zeroLogs();
  await page.goto(`/search?mode=jobs&p=${await nodeId("Buxgalter")}&region=all`);
  await expect(page.getByRole("heading", { level: 2 })).toContainText(/topilmadi|yo'q/i);
  await expect(page.getByText("Natijalarni yuklab bo'lmadi")).toHaveCount(0);
  await expect.poll(zeroLogs).toBe(before + 1);
});

test("RPC xatosi — xato holati, qayta urinish filtrlarni saqlaydi, bo'sh qidiruv statistikasiga yozilmaydi", async ({ page, context }) => {
  await asGuest(context);
  const url = `/search?mode=jobs&p=${await nodeId("Buxgalter")}&region=all`;
  const before = await zeroLogs();
  await setSearchBroken(true);
  await page.goto(url);
  await expect(page.getByRole("alert").filter({ hasText: "Natijalarni yuklab bo'lmadi" })).toBeVisible();
  await expect(page.getByText(/Xato kodi: [0-9a-f]{8}/)).toBeVisible();
  await page.waitForTimeout(1000);
  expect(await zeroLogs()).toBe(before);

  await setSearchBroken(false);
  await page.getByRole("button", { name: "Qayta urinish" }).click();
  await expect(page.getByText("Natijalarni yuklab bo'lmadi")).toHaveCount(0);
  expect(new URL(page.url()).search).toBe(new URL(url, "http://x").search);
});

test("oxirgi sahifadan keyingi sahifa — '0 ta' emas, birinchi sahifaga havola", async ({ page, context }) => {
  await asGuest(context);
  await page.goto(`/search?mode=jobs&p=${await nodeId("Buxgalter")}&region=all&page=7`);
  await expect(page.getByText("Bu sahifada natija qolmadi")).toBeVisible();
  await page.getByRole("link", { name: "Birinchi sahifaga qaytish" }).click();
  await expect(page).not.toHaveURL(/page=7/);
});
