import { expect, test } from "@playwright/test";
import { USERS, asGuest, draftData, draftKeys, formReady, loginAs, pickProfession, sql } from "../support";

/** F-03: qoralama hisobga bog'langan; chiqish/hisob almashishida boshqa hisobga ko'rinmaydi; buzilgan qoralama formani buzmaydi */

test("A hisobining qoralamasi chiqishdan keyin B hisobida ko'rinmaydi", async ({ page, context }) => {
  await loginAs(context, USERS.workerA);
  await page.goto("/post/worker");
  await pickProfession(page, "Buxgalter", "Buxgalter");
  await expect.poll(() => draftKeys(page)).toContain(`ib_draft:v2:worker:new:u:${USERS.workerA}`);
  expect(JSON.stringify(await draftData(page, `ib_draft:v2:worker:new:u:${USERS.workerA}`))).toContain('"name_uz":"Buxgalter"');

  // chiqish: mehmon sifatida sahifa ochiladi → DraftGuard barcha qoralamalarni o'chiradi
  await asGuest(context);
  await page.goto("/");
  await expect.poll(() => draftKeys(page)).toEqual([]);

  await loginAs(context, USERS.workerB);
  await page.goto("/post/worker");
  await formReady(page);
  await expect(page.getByLabel("Kasb yoki sohani qidiring")).toBeVisible();
  expect(await draftKeys(page)).toEqual([]);
  await expect(page.getByText(/^Kasb:/)).toHaveCount(0);
});

test("chiqmasdan boshqa hisobga o'tilsa ham oldingi qoralama o'chadi", async ({ page, context }) => {
  await loginAs(context, USERS.workerA);
  await page.goto("/post/worker");
  await pickProfession(page, "Buxgalter", "Buxgalter");
  await expect.poll(() => draftKeys(page)).toContain(`ib_draft:v2:worker:new:u:${USERS.workerA}`);

  await loginAs(context, USERS.workerB);
  await page.goto("/");
  await expect.poll(() => draftKeys(page)).toEqual([]);
});

test("mehmon 'Hisobga kirish' bosgan qoralama kirgan hisobga o'tadi", async ({ page, context }) => {
  await asGuest(context);
  await page.goto("/post/worker");
  await pickProfession(page, "Buxgalter", "Buxgalter");
  await page.getByRole("link", { name: /Hisobga kirish/ }).first().click();
  await page.waitForURL(/\/auth/);

  await loginAs(context, USERS.workerB);
  await page.goto("/post/worker?step=1");
  const key = `ib_draft:v2:worker:new:u:${USERS.workerB}`;
  await expect.poll(() => draftKeys(page)).toContain(key);
  // aynan mehmon tanlagan kasb o'tdi (bo'sh qoralama emas)
  const data = await draftData(page, key);
  expect((data?.profession as { trail: { name_uz: string }[] } | null)?.trail.at(-1)?.name_uz).toBe("Buxgalter");
});

test("buzilgan va boshqa egaga ko'chirilgan qoralama e'tiborsiz qoladi", async ({ page, context }) => {
  await loginAs(context, USERS.workerA);
  await page.goto("/");
  await page.evaluate((a) => {
    localStorage.setItem(`ib_draft:v2:worker:new:u:${a}`, "{buzilgan");
    localStorage.setItem("ib_post_worker_v1", JSON.stringify({ v: 1, firstName: "Eski egasiz" }));
  }, USERS.workerA);
  await page.goto("/post/worker");
  await formReady(page);
  await expect(page.getByLabel("Kasb yoki sohani qidiring")).toBeVisible();
  expect(await draftKeys(page)).toEqual([]);
  expect(await page.evaluate(() => localStorage.getItem("ib_post_worker_v1"))).toBeNull();
});

test("mehmon formani to'ldirib sarlavhadagi 'Kirish'ni bossa — kirgandan keyin javoblari joyida", async ({ page, context }) => {
  await sql("delete from public.worker_profiles where profile_id = $1", [USERS.workerB]);
  await asGuest(context);
  await page.goto("/post/worker");
  await pickProfession(page, "Buxgalter", "Buxgalter");
  await page.getByRole("button", { name: /^Davom etish/ }).click();
  await page.getByRole("button", { name: /^Toshkent shahri/ }).first().click();
  await page.getByRole("radio", { name: /^Butun (viloyat|shahar)/ }).click();
  await page.getByRole("button", { name: /^Davom etish/ }).click();
  await page.locator("#about").fill("Soliq hisobotlari va 1C — 5 yil");
  await page.getByRole("banner").getByRole("link", { name: "Kirish" }).click();
  await page.waitForURL(/\/auth\?next=/);
  const back = new URL(page.url()).searchParams.get("next")!;
  expect(back).toMatch(/^\/post\/worker\?step=3/);

  await loginAs(context, USERS.workerB);
  await page.goto(back);
  await formReady(page);
  await expect(page.locator("#about")).toHaveValue("Soliq hisobotlari va 1C — 5 yil");
  await expect(page.getByText("Buxgalter").first()).toBeVisible();
});
