import { expect, test } from "@playwright/test";
import { USERS, formReady, loginAs, next, pickWholeRegion, sql } from "../support";

/** F-05: sodda ishchi formasida katalogda yo'q kasb yoziladi, saqlanadi va katalog tuguni sifatida ko'rsatilmaydi */

test("ishchi: 'Kasbim topilmadi' → asl nom + soha → joylandi, bazada custom sifatida", async ({ page, context }) => {
  const NAME = "Kaktus parvarishchisi";
  // takroriy ishga tushirishda ham bir xil boshlang'ich holat: oldingi run'dan qolgan e'lon va so'rov o'chiriladi
  await sql("delete from public.custom_occupation_requests where created_by = $1", [USERS.workerA]);
  await sql("delete from public.worker_profiles where profile_id = $1", [USERS.workerA]);
  await loginAs(context, USERS.workerA);
  await page.goto("/post/worker");
  await formReady(page);

  await page.getByLabel("Kasb yoki sohani qidiring").fill(NAME);
  await page.getByRole("button", { name: new RegExp(`Topilmadimi\\? «${NAME}»`) }).click();
  await expect(page.getByLabel("Kasbni o'zingiz yozing")).toHaveValue(NAME);
  // eng yaqin soha — birinchi taklif
  await page.getByText("Qaysi sohaga eng yaqin?").locator("xpath=following-sibling::*[1]").getByRole("button").first().click();
  await page.getByRole("button", { name: "Saqlash va davom etish" }).click();

  // 2-qadam: hudud
  await expect(page.getByText(/Qo'lda yozilgan/).first()).toBeVisible();
  await pickWholeRegion(page);
  await next(page);

  // 3-qadam: o'zi haqida
  await page.locator("#about").fill("Uyda va ofislarda kaktus va sukkulentlarni parvarish qilaman, 4 yil tajriba");
  await page.getByRole("radio", { name: "3 yildan ko'p" }).click();
  await next(page);

  // 4-qadam: tekshirish — custom belgi bilan, katalog kasbi deb ko'rsatilmaydi
  await expect(page.getByText(`${NAME} (Qo'lda yozilgan)`).first()).toBeVisible();
  await page.getByRole("button", { name: /E'lonni joylash|O'zgarishlarni saqlash/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: /joylandi|saqlandi/i })).toBeVisible({ timeout: 30_000 });

  const [w] = await sql<{ profession_node_id: string | null; custom_profession: string; category_id: string | null }>(
    "select profession_node_id, custom_profession, category_id from public.worker_profiles where profile_id = $1",
    [USERS.workerA],
  );
  expect(w).toMatchObject({ profession_node_id: null, custom_profession: NAME });
  expect(w!.category_id).not.toBeNull();
  const reqs = await sql("select 1 from public.custom_occupation_requests where created_by = $1 and raw_text = $2 and status = 'pending'", [USERS.workerA, NAME]);
  expect(reqs).toHaveLength(1);

  // qayta ochilganda (tahrirlash) custom nom yo'qolmaydi
  await page.goto("/post/worker?step=1");
  await formReady(page);
  await expect(page.getByText(NAME).first()).toBeVisible();
});
