import { expect, test } from "@playwright/test";
import { USERS, asGuest, formReady, loginAs, next, pickProfession, pickWholeRegion, sql } from "../support";

/**
 * Qabul #32 · to'liq yo'llar (mobil va desktop): mehmon bosh sahifadan e'lon beradi → oxirgi qadamda kiradi →
 * o'sha formaga barcha javoblari bilan qaytadi → joylaydi → kabinetda e'lonini ko'radi.
 * Kirish (Telegram kodi) stendda sessiya cookie'si bilan almashtiriladi — qolgan hamma narsa haqiqiy.
 */

// keyingi spec'lar workerB uchun bo'sh forma kutadi — yaratilgan e'lon qoldirilmaydi
test.afterEach(async () => {
  await sql("delete from public.worker_profiles where profile_id = $1", [USERS.workerB]);
});

for (const vp of [
  { name: "mobil", width: 390, height: 844 },
  { name: "desktop", width: 1440, height: 900 },
]) {
  test(`${vp.name}: bosh sahifa → ishchi e'loni → kirish → joylash → kabinet`, async ({ page, context }) => {
    test.setTimeout(120_000);
    await sql("delete from public.worker_profiles where profile_id = $1", [USERS.workerB]);
    await asGuest(context);
    await page.setViewportSize({ width: vp.width, height: vp.height });

    await page.goto("/");
    await page.getByRole("link", { name: /O'zim haqimda e'lon berish/ }).click();
    await page.waitForURL(/\/post\/worker/);
    await pickProfession(page, "Buxgalter", "Buxgalter");
    await next(page);
    await pickWholeRegion(page);
    await next(page);
    await page.getByLabel("Ismingiz").fill("Botir");
    await page.locator("#phone").fill("901234567");
    await page.locator("#about").fill("Buxgalteriya hisobi, soliq hisobotlari, 1C bilan 5 yil ishlaganman");
    await page.getByRole("radio", { name: "3 yildan ko'p" }).click();
    await next(page);

    // 4-qadam: mehmon — "Kirish va e'lonni joylash"; javoblar yo'qolmasligi aytiladi
    await expect(page.getByText("Oxirgi qadam: hisobga kirish")).toBeVisible();
    await page.getByRole("button", { name: "Kirish va e'lonni joylash" }).click();
    await page.waitForURL(/\/auth\?/);
    const back = new URL(page.url()).searchParams.get("next");
    expect(back).toBe("/post/worker?step=4");
    // mehmon "901234567" deb yozgan raqam to'liq +998 bilan kirish formasiga o'tadi (avval "+90 1234567" bo'lib qolardi)
    expect(new URL(page.url()).searchParams.get("phone")).toBe("+998901234567");
    await expect(page.locator("#phone")).toHaveValue("+998 90 123 45 67");
    await page.locator("#phone").fill("90 123 45 67");
    await expect(page.locator("#phone")).toHaveValue("+998 90 123 45 67");

    // kirish (stend: sessiya cookie'si) → o'sha qadamga qaytish
    await loginAs(context, USERS.workerB);
    await page.goto(back!);
    await formReady(page);
    await expect(page.getByRole("heading", { name: "E'loningizni tekshiring" })).toBeVisible();
    await expect(page.getByText("Buxgalter").first()).toBeVisible();
    await expect(page.getByText("Buxgalteriya hisobi, soliq hisobotlari")).toBeVisible();
    await page.getByRole("button", { name: /^E'lonni joylash/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: /joylandi/i })).toBeVisible({ timeout: 30_000 });

    const [c] = await sql<{ n: string }>("select count(*) as n from public.worker_profiles where profile_id = $1", [USERS.workerB]);
    expect(Number(c!.n)).toBe(1);

    // kabinetda — o'z e'loni va uning holati
    await page.goto("/cabinet");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText("Buxgalter").first()).toBeVisible();
    await expect(page.getByText(/Qidiruvda ko'rinadi|Tekshiruvda/).first()).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}
