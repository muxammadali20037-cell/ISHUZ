import { expect, test, type Page } from "@playwright/test";
import { USERS, asGuest, asMode, loginAs, sql, stack } from "../support";

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
  // kompyuter yon menyusidagi (telefonda yashirin) rejim yozuvi emas — ko'rinadigani
  await expect(page.getByText("Ish beruvchi", { exact: true }).filter({ visible: true }).first()).toBeVisible();
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
    // boundingBox() kutmaydi: tezkor boshqaruv kartasi oqimda keyinroq chiziladi (CI'da null qaytgan)
    await expect(label).toBeVisible();
    await expect(input).toBeVisible();
    const [l, i] = [(await label.boundingBox())!, (await input.boundingBox())!];
    expect(l.width).toBeGreaterThan(120);
    // maydon yozuv bilan ustma-ust emas: yonida (o'ngda) yoki ostida
    expect(i.x >= l.x + l.width || i.y >= l.y + l.height).toBe(true);
  });
});

test("cookie siyosati: sahifa 4 tilda, footer'da havola; maxfiylik siyosati AI yordamchi va mikrofon haqida aytadi", async ({ page, context }) => {
  await asGuest(context);
  for (const [locale, title] of [
    ["uz", "Cookie fayllari siyosati"],
    ["oz", "Cookie файллари сиёсати"],
    ["ru", "Политика использования cookie"],
    ["en", "Cookie Policy"],
  ] as const) {
    await context.addCookies([{ name: "ishuz_locale", value: locale, domain: host, path: "/" }]);
    await page.goto("/cookies");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
    // har bir ishlatiladigan cookie nomi ro'yxatda
    for (const name of ["ib_mode", "ishuz_locale", "ib_place", "ib_consent", "ib_aid", "ib_app"]) await expect(page.getByRole("main").getByText(name).first()).toBeVisible();
  }
  await context.addCookies([{ name: "ishuz_locale", value: "uz", domain: host, path: "/" }]);
  await page.goto("/privacy");
  const main = page.getByRole("main");
  await expect(main.getByText(/Mikrofon faqat siz tugmani bosganingizda/)).toBeVisible();
  await expect(main.getByText(/AI yordamchi: unga yozgan yoki aytgan matningiz/)).toBeVisible();
  await expect(main.getByRole("link", { name: /Cookie fayllari siyosati/ })).toHaveAttribute("href", "/cookies");
  // footer (mehmon bosh sahifasi)
  await context.clearCookies({ name: "ib_mode" });
  await page.goto("/");
  await expect(page.getByRole("contentinfo").getByRole("link", { name: "Cookie fayllari" })).toHaveAttribute("href", "/cookies");
});

test("cookie eslatmasi: birinchi tashrifda pastki menyu ustida, ekranni to'smaydi; 'Tushunarli' → 1 yil ko'rinmaydi", async ({ browser, baseURL }) => {
  // playwright'da navigator.webdriver=true — eslatma ko'rsatilmaydi (testlar uchun); shu testda u o'chiriladi
  const ctx = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, locale: "uz-UZ" });
  await ctx.addInitScript(() => Object.defineProperty(Navigator.prototype, "webdriver", { get: () => false, configurable: true }));
  await asGuest(ctx);
  await asMode(ctx, "worker");
  // testlar uchun asGuest "ko'rilgan" belgisini qo'yadi — bu test uni olib tashlaydi (birinchi tashrif)
  await ctx.clearCookies({ name: "ib_consent" });
  const page = await ctx.newPage();
  await page.goto("/");
  const notice = page.locator("[data-cookie-notice]");
  await expect(notice).toBeVisible();
  await expect(notice.getByRole("link", { name: "Batafsil" })).toHaveAttribute("href", "/cookies");
  // pastki menyu bilan ustma-ust emas: eslatmaning pasti menyuning tepasidan yuqorida
  const nav = page.getByRole("navigation").last();
  const [n, b] = await Promise.all([notice.boundingBox(), nav.boundingBox()]);
  expect(n!.y + n!.height).toBeLessThanOrEqual(b!.y + 1);
  // sahifa mazmuni bosiladi (eslatma faqat pastda)
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await notice.getByRole("button", { name: "Tushunarli" }).click();
  await expect(notice).toHaveCount(0);
  const consent = (await ctx.cookies()).find((c) => c.name === "ib_consent");
  expect(consent?.value).toBe("1");
  expect(consent!.expires - Date.now() / 1000).toBeGreaterThan(360 * 24 * 3600);
  await page.reload();
  await expect(page.locator("[data-cookie-notice]")).toHaveCount(0);
  await ctx.close();
});
