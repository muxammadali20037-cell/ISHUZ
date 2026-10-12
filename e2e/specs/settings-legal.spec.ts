import { expect, test, type Page } from "@playwright/test";
import { USERS, asGuest, loginAs, sql, stack } from "../support";

/** C8.9 · sozlamalar, yordam, huquqiy sahifalar, admin: eskirgan yo'riqnoma, boshi berk yo'llar, til va tor ekran xatolari */

const host = new URL(stack.app).hostname;

async function noHorizontalScroll(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
}

test("yordam: hozirgi interfeysdagi tugma nomlari (eskirgan «+ Vakansiya joylashtirish», «Nomzodlar» yo'q)", async ({ page, context }) => {
  await asGuest(context);
  await page.goto("/help");
  const main = page.getByRole("main");
  await expect(main.getByText("Bosh sahifadagi «Ish e'loni berish»ni bosing.")).toBeVisible();
  await expect(main.getByText(/«O'zim haqimda e'lon berish»/)).toBeVisible();
  await expect(main.getByText(/Vakansiya joylashtirish|Bo'sh ish o'rinlarini ko'rish|«Nomzodlar»/)).toHaveCount(0);
});

test("huquqiy sahifalar kirillda (oz) — kirill matn, lotin emas", async ({ page, context }) => {
  await asGuest(context);
  await context.addCookies([{ name: "ishuz_locale", value: "oz", domain: host, path: "/" }]);
  await page.goto("/privacy");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Махфийлик сиёсати");
  await page.goto("/account-deletion");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ҳисобни ўчириш");
});

test("hisobni o'chirish: aloqa manzili sozlanmagan bo'lsa — bo'sh 'yozing:' emas, o'zi o'chirish yo'li", async ({ page, context }) => {
  // stendda SUPPORT_EMAIL ham, bot nomi ham yo'q
  await asGuest(context);
  await page.goto("/account-deletion");
  const contact = page.getByRole("heading", { name: "Aloqa" }).locator("..");
  await expect(contact.getByText(/Aloqa manzili hozircha e'lon qilinmagan/)).toBeVisible();
  await expect(contact.getByText("Savol yoki so'rovlar bo'yicha yozing:")).toHaveCount(0);
});

test("sozlamalar: Telegram ulanmagan — xavfsiz ulash sahifasiga tugma (boshi berk yo'l emas)", async ({ page, context }) => {
  await loginAs(context, USERS.workerA);
  await page.goto("/settings");
  const link = page.getByRole("main").getByRole("link", { name: "Telegramni bog'lash" });
  await expect(link).toHaveAttribute("href", "/cabinet/alerts");
  await expect(page.getByText(/Mini App orqali kiring/)).toHaveCount(0);
});

test("ish beruvchi profili ('O'zim uchun'): o'zbekcha 'Boshqaruv paneli', 'Profil sozlamalari'; 'Ish beruvchi' kichik harf", async ({ page, context }) => {
  await sql("delete from public.worker_profiles where profile_id = $1", [USERS.employer]);
  await sql(
    `insert into public.employer_profiles (profile_id, employer_type, display_name, onboarding_completed_at)
     values ($1, 'person', 'Dilnoza opa', now()) on conflict (profile_id) do nothing`,
    [USERS.employer],
  );
  await loginAs(context, USERS.employer);
  await page.goto("/profile");
  const main = page.getByRole("main");
  await expect(main.getByRole("link", { name: "Boshqaruv paneli" })).toBeVisible();
  await expect(main.getByRole("link", { name: "Profil sozlamalari" })).toBeVisible();
  await expect(main.getByText("Dashboard")).toHaveCount(0);
  await page.goto("/settings");
  await expect(page.getByText(/Ish Beruvchi/)).toHaveCount(0); // regex — registrga sezgir
  await expect(page.getByText("Ish beruvchi", { exact: true }).first()).toBeVisible();
});

test.describe("admin panel (lokal stend, aal2 sinov sessiyasi)", () => {
  test.beforeEach(async () => {
    await sql(
      `insert into public.admin_users (profile_id, role, permissions, is_active) values ($1, 'super_admin', '{}', true)
       on conflict (profile_id) do update set is_active = true, role = 'super_admin'`,
      [USERS.workerB],
    );
  });
  test.afterEach(async () => {
    await sql("delete from public.admin_users where profile_id = $1", [USERS.workerB]);
  });

  test("390 px: sahifa yonga siljimaydi; tezkor boshqaruvdagi narx yozuvi siqilmaydi", async ({ page, context }) => {
    await loginAs(context, USERS.workerB, "aal2");
    for (const p of ["/admin", "/admin/users", "/admin/settings", "/admin/moderation", "/admin/security"]) {
      await page.goto(p);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      // yakuniy holat (yuklanishning birinchi ~0,3 s dagi vaqtinchalik kenglik — hisobotda ochiq masala)
      await expect.poll(() => noHorizontalScroll(page), { message: p }).toBe(true);
    }
    await page.goto("/admin");
    const label = page.getByText("AI yordamchi narxi", { exact: true });
    const input = page.getByRole("spinbutton", { name: "AI yordamchi narxi" });
    const [l, i] = [(await label.boundingBox())!, (await input.boundingBox())!];
    expect(l.width).toBeGreaterThan(120);
    // maydon yozuv bilan ustma-ust emas: yonida (o'ngda) yoki ostida
    expect(i.x >= l.x + l.width || i.y >= l.y + l.height).toBe(true);
  });
});
