import { expect, test } from "@playwright/test";
import { USERS, asGuest, asMode, formReady, loginAs, next, pickProfession, pickWholeRegion, sql } from "../support";

/**
 * Qabul #32 · to'liq yo'llar (mobil va desktop): mehmon bosh sahifada kimligini tanlaydi va e'lon beradi → oxirgi qadamda kiradi →
 * o'sha formaga barcha javoblari bilan qaytadi → joylaydi → kabinetda e'lonini ko'radi.
 * Kirish (Telegram kodi) stendda sessiya cookie'si bilan almashtiriladi — qolgan hamma narsa haqiqiy.
 */

// keyingi spec'lar workerB uchun bo'sh forma kutadi — yaratilgan e'lon qoldirilmaydi
test.afterEach(async () => {
  await sql("delete from public.worker_profiles where profile_id = $1", [USERS.workerB]);
  await sql("delete from public.vacancies where owner_profile_id = $1", [USERS.employer]);
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
    // birinchi ochilish: bosh sahifa — "Ish qidiraman"; keyin "O'zim haqimda e'lon berish"
    // (kompyuterda — o'ng paneldagi "Rezyume joylash"). Rejim tanlangan — e'lon turi qayta so'ralmaydi (tasdiq — modes.spec)
    await page.getByRole("main").getByRole("button", { name: /^Ish qidiraman/ }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("O'zingizga mos ishni toping");
    await page.locator("main a[href='/post/worker']:visible").first().click();
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
    // raqam e'londa yozilgan va rol tanlangan — kirish usuli o'tkazib, to'g'ridan-to'g'ri raqam ekraniga (8-ekran)
    await page.waitForURL(/\/auth\/telefon\?/);
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

for (const vp of [
  { name: "mobil", width: 390, height: 844 },
  { name: "desktop", width: 1440, height: 900 },
]) {
  test(`${vp.name}: bosh sahifa → ish e'loni → kirish → joylash → kabinet → qidiruvda ko'rinadi`, async ({ page, context }) => {
    test.setTimeout(120_000);
    await sql("delete from public.vacancies where owner_profile_id = $1", [USERS.employer]);
    await asGuest(context);
    await page.setViewportSize({ width: vp.width, height: vp.height });

    await page.goto("/");
    // birinchi ochilish: bosh sahifa — "Xodim qidiraman" (ish beruvchi rejimi, tasdiqsiz — o'zi tanladi)
    await page.getByRole("main").getByRole("button", { name: /^Xodim qidiraman/ }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Xodim toping");
    await page.getByRole("main").getByRole("link", { name: "Vakansiya joylash", exact: true }).click();
    await page.waitForURL(/\/post\/vacancy/);
    await pickProfession(page, "Buxgalter", "Buxgalter");
    await next(page);
    await pickWholeRegion(page);
    await next(page);
    await page.getByRole("radio", { name: "O'zim uchun" }).click();
    await page.locator("#org").fill("Dilnoza opa");
    await page.locator("#phone").fill("90 111 00 03");
    await page.locator("#desc").fill("Kichik do'konga buxgalter kerak, haftasiga 5 kun, tushlik bepul");
    await page.locator("#salary-from").fill("4000000");
    await page.locator("#salary-to").fill("6000000");
    await next(page);

    await expect(page.getByText("Oxirgi qadam: hisobga kirish")).toBeVisible();
    await page.getByRole("button", { name: "Kirish va e'lonni joylash" }).click();
    // raqam e'londa yozilgan va rol tanlangan — kirish usuli o'tkazib, to'g'ridan-to'g'ri raqam ekraniga (8-ekran)
    await page.waitForURL(/\/auth\/telefon\?/);
    const back = new URL(page.url()).searchParams.get("next")!;
    expect(back).toBe("/post/vacancy?step=4");

    await loginAs(context, USERS.employer);
    await page.goto(back);
    await formReady(page);
    await expect(page.getByText("Kichik do'konga buxgalter kerak")).toBeVisible();
    await expect(page.getByText(/4 000 000/).first()).toBeVisible();
    await page.getByRole("button", { name: /^E'lonni joylash/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: /joylandi/i })).toBeVisible({ timeout: 30_000 });

    const rows = await sql<{ salary_from: number; salary_to: number; salary_type: string; status: string }>(
      "select salary_from, salary_to, salary_type::text, status::text from public.vacancies where owner_profile_id = $1",
      [USERS.employer],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ salary_from: 4000000, salary_to: 6000000, salary_type: "monthly" });

    await page.goto("/cabinet");
    await expect(page.getByText("Buxgalter").first()).toBeVisible();

    // mehmon qidiruvida — e'lon va oylik maosh
    if (rows[0]!.status === "active") {
      await asGuest(context);
      await asMode(context, "worker");
      const [n] = await sql<{ id: string }>("select id from public.profession_nodes where name_uz = 'Buxgalter' and selectable limit 1");
      await page.goto(`/search?mode=jobs&p=${n!.id}&region=all`);
      await expect(page.locator("main article").filter({ hasText: "Dilnoza opa" })).toBeVisible();
    }
  });
}
