import sharp from "sharp";
import { expect, test, type Page } from "@playwright/test";
import { USERS, asGuest, asMode, loginAs, sql } from "../support";

/**
 * "Universal ustalar" — ikki tomonlama bozor (0076), haqiqiy baza bilan:
 *  - kirish: sayt menyusi va bosh sahifadagi turkuaz tugma → /ustalar (o'z sarlavhasi, qidiruvi, katalogi; orqaga — Ish topdim);
 *  - katalog: 12 kategoriya, har birida 4 ta demo e'lon ("Demo" belgisi, telefon va reyting yo'q, bog'lanib bo'lmaydi);
 *  - usta: e'lon joylaydi (rasm bilan) → "Moderatsiyada" → ommaga ko'rinmaydi → admin tasdiqlaydi → katalogda birinchi (demodan avval);
 *  - telefon: rozilik berilmagan — ko'rinmaydi, faqat so'rov; rozilik berilgach — ko'rinadi, bosish hisoblanadi;
 *  - mijoz: so'rov yuboradi → usta kabinetida ko'radi, holatini belgilaydi; sharh → reyting faqat shundan;
 *  - egasi: tahrirlasa — qayta moderatsiya; admin rad etsa — sabab ko'rinadi; yashirish/qaytarish; o'chirish;
 *  - admin: demo e'lonlarni bir bosishda olib tashlaydi va qaytaradi (haqiqiy e'longa tegmaydi).
 */

const TITLE = "Konditsioner o'rnatish va tozalash (E2E)";

async function cleanup() {
  await sql("delete from public.master_listings where owner_profile_id in ($1, $2, $3)", [USERS.workerA, USERS.workerB, USERS.employer]);
  await sql("delete from public.admin_users where profile_id = $1", [USERS.workerB]);
  // demo e'lonlar doim joyida (boshqa testlar va keyingi ishga tushirishlar uchun)
  await sql("select public.master_demo_seed()");
}

test.beforeEach(cleanup);
test.afterAll(cleanup);

async function photo() {
  return sharp({ create: { width: 1600, height: 1200, channels: 3, background: { r: 15, g: 118, b: 110 } } })
    .jpeg()
    .withExif({ IFD0: { Artist: "usta uy manzili" } })
    .toBuffer();
}

async function fillListing(page: Page, opts: { phonePublic: boolean; withPhoto?: boolean }) {
  await page.goto("/ustalar/elon");
  const form = page.locator("[data-masters-form]");
  await expect(form).toBeVisible();
  await form.getByRole("radio", { name: "Konditsioner ustasi" }).click();
  await form.getByLabel("Tajriba (yil)").fill("7");
  await form.getByLabel("E'lon sarlavhasi").fill(TITLE);
  await form.getByLabel("Xizmat tavsifi").fill("Split va kassetali konditsionerlarni o'rnataman, tozalayman, freon quyaman. Kafolat 6 oy.");
  await form.getByLabel("Qo'shimcha xizmatlar").fill("o'rnatish, tozalash, freon quyish");
  await form.getByLabel("Xizmat ko'rsatadigan hudud").selectOption({ label: "Toshkent shahri" });
  await form.getByLabel("Telefon raqami").fill("+998 90 765 43 21");
  if (opts.phonePublic) await form.locator("[data-masters-phone-consent]").check();
  if (opts.withPhoto) {
    await form.locator('input[type="file"]').setInputFiles({ name: "ish.jpg", mimeType: "image/jpeg", buffer: await photo() });
    await expect(form.locator("[data-masters-photos-upload] img")).toHaveCount(1, { timeout: 30_000 });
  }
}

async function approveAsAdmin(page: Page, context: import("@playwright/test").BrowserContext) {
  await sql(
    `insert into public.admin_users (profile_id, role, permissions, is_active) values ($1, 'super_admin', '{}', true)
     on conflict (profile_id) do update set is_active = true, role = 'super_admin'`,
    [USERS.workerB],
  );
  await loginAs(context, USERS.workerB, "aal2");
  await page.goto("/admin/ustalar");
  await expect(page.getByRole("heading", { level: 1, name: /Universal ustalar/ })).toBeVisible();
  const item = page.locator("[data-masters-queue-item]").filter({ hasText: TITLE });
  await expect(item).toBeVisible();
  return item;
}

test("kirish va katalog: turkuaz tugma, o'z sarlavhasi, 12 kategoriya × 4 demo e'lon — telefon, reyting va bog'lanish yo'q", async ({ page, context }) => {
  await asGuest(context);
  await asMode(context, "worker");
  await page.goto("/");
  const entry = page.locator("main [data-masters-entry]").first();
  await expect(entry).toContainText("Universal ustalar");
  // alohida rang: asosiy ko'k emas (turkuaz mavzu)
  const [entryColor, blue] = await Promise.all([
    entry.evaluate((el) => getComputedStyle(el).color),
    page.evaluate(() => {
      const probe = document.createElement("span");
      probe.className = "text-primary-ink";
      document.body.append(probe);
      const c = getComputedStyle(probe).color;
      probe.remove();
      return c;
    }),
  ]);
  expect(entryColor).not.toBe(blue);
  await entry.click();
  await expect(page).toHaveURL(/\/ustalar$/);
  await expect(page.getByRole("heading", { level: 1, name: "Universal ustalar" })).toBeVisible();
  // alohida mini-ilova: o'z sarlavhasi, sayt menyusi yo'q; orqaga — Ish topdim
  await expect(page.locator("[data-masters-back]")).toHaveAttribute("href", "/");
  await expect(page.locator("[data-masters-post]")).toHaveAttribute("href", "/auth?next=%2Fustalar%2Felon");

  const cats = page.locator("[data-masters-categories] a");
  await expect(cats).toHaveCount(12);
  for (const name of ["Konditsioner ustasi", "Santexnik", "Elektrik", "Maishiy texnika ustasi", "Ta'mirlash ustasi", "Bo'yoqchi", "Quruvchi", "Payvandchi", "Qulf ustasi", "Yuk tashish", "Mebel yig'uvchi", "Boshqa xizmatlar"]) {
    await expect(cats.filter({ hasText: name })).toContainText("4 ta e'lon");
  }
  await expect(page.locator("[data-masters-demo-note]")).toContainText("Demo ma'lumot");
  // kartalarda telefon yo'q, reyting yo'q (soxta baho yo'q)
  await expect(page.locator("main")).not.toContainText("+998");
  await expect(page.locator("[data-master-card]").first()).toContainText("Demo");

  await cats.filter({ hasText: "Santexnik" }).click();
  await expect(page).toHaveURL(/\/ustalar\/qidiruv\?k=plumber$/);
  await expect(page.locator("[data-masters-results] [data-master-card]")).toHaveCount(4);
  await expect(page.locator("[data-masters-results] [data-demo]")).toHaveCount(4);
  // filtr: tajriba 5 yildan — 5, 7 va 10 yillik demo
  await page.locator("[data-masters-filters] select[name=exp]").selectOption("5");
  await page.locator("[data-masters-filters]").getByRole("button", { name: "Ko'rsatish" }).click();
  await expect(page).toHaveURL(/exp=5/);
  await expect(page.locator("[data-masters-results] [data-master-card]")).toHaveCount(3);

  await page.locator("[data-master-card] h3 a").first().click();
  await expect(page.locator("[data-masters-detail][data-demo]")).toBeVisible();
  await expect(page.locator("[data-masters-contact]")).toContainText("Bu demo e'lon — bog'lanish imkoni yo'q.");
  await expect(page.locator("[data-masters-request]")).toHaveCount(0);
  await expect(page.locator("[data-masters-phone]")).toHaveCount(0);
  await expect(page.locator("[data-masters-review]")).toHaveCount(0);
  await expect(page.locator("main")).toContainText("Hali baho yo'q");

  // telefonda kirgan foydalanuvchi (ish beruvchi rejimi): yon menyu yo'q — kirish "Kabinetim" sahifasida
  await loginAs(context, USERS.employer);
  await asMode(context, "employer");
  await page.goto("/cabinet");
  const fromCabinet = page.locator("main [data-masters-entry]");
  await expect(fromCabinet).toContainText("Universal ustalar");
  await fromCabinet.click();
  await expect(page).toHaveURL(/\/ustalar$/);
});

test("usta e'lon joylaydi → moderatsiya → admin tasdiqlaydi → katalogda; telefon faqat rozilik bilan; so'rov, sharh, statistika", async ({ page, context, browser }) => {
  test.setTimeout(180_000);
  // 1) usta: e'lon (rasm bilan), telefon ochiq EMAS
  await loginAs(context, USERS.workerA);
  await asMode(context, "worker");
  await fillListing(page, { phonePublic: false, withPhoto: true });
  await page.locator("[data-masters-submit]").click();
  await expect(page.locator("[data-masters-form-sent='pending_review']")).toContainText("E'lon moderatsiyaga yuborildi");
  const [row] = await sql<{ slug: string; status: string; photos: string[]; phone_public: boolean }>("select slug, status::text, photos, phone_public from public.master_listings where owner_profile_id = $1", [USERS.workerA]);
  expect(row!.status).toBe("pending_review");
  expect(row!.phone_public).toBe(false);
  // rasm: tekshirilgan, qayta kodlangan (v-<sha256>.webp)
  expect(row!.photos[0]).toMatch(new RegExp(`^${USERS.workerA}/v-[0-9a-f]{64}\\.webp$`));

  await page.goto("/ustalar/kabinet");
  const mine = page.locator("[data-masters-my-listings] > li").filter({ hasText: TITLE });
  await expect(mine.locator("[data-masters-status]")).toHaveText("Moderatsiyada");

  // 2) ommaga hali ko'rinmaydi
  const guestCtx = await browser.newContext({ baseURL: new URL(page.url()).origin, viewport: { width: 390, height: 844 } });
  await asGuest(guestCtx);
  const guest = await guestCtx.newPage();
  await guest.goto("/ustalar/qidiruv?k=ac");
  await expect(guest.locator("[data-masters-results] [data-master-card]")).toHaveCount(4);
  await expect(guest.getByText(TITLE)).toHaveCount(0);
  expect((await guest.goto(`/ustalar/${row!.slug}`))?.status()).toBe(404);

  // 3) admin tasdiqlaydi
  const adminCtx = await browser.newContext({ baseURL: new URL(page.url()).origin, viewport: { width: 1280, height: 900 } });
  await asGuest(adminCtx);
  const admin = await adminCtx.newPage();
  const item = await approveAsAdmin(admin, adminCtx);
  await expect(item).toContainText("telefon yopiq");
  await item.getByRole("button", { name: "Tasdiqlash" }).click();
  await expect.poll(async () => (await sql<{ status: string }>("select status::text from public.master_listings where slug = $1", [row!.slug]))[0]?.status).toBe("active");

  // 4) katalogda: haqiqiy e'lon demodan avval; telefon ko'rinmaydi — faqat so'rov
  await guest.goto("/ustalar/qidiruv?k=ac");
  const cards = guest.locator("[data-masters-results] [data-master-card]");
  await expect(cards).toHaveCount(5);
  await expect(cards.first()).toContainText(TITLE);
  await expect(cards.first()).not.toContainText("Demo");
  await expect(cards.first().locator("img")).toHaveCount(1);
  // kartada bog'lanish usuli ko'rinadi (raqamning o'zi emas): rozilik yo'q — faqat so'rov; demo kartada bu qator yo'q
  await expect(cards.first().locator("[data-master-contact='request']")).toHaveText("Bog'lanish — so'rov orqali");
  await expect(guest.locator("[data-masters-results] [data-demo] [data-master-contact]")).toHaveCount(0);
  await expect(guest.locator("[data-masters-results]")).not.toContainText("+998");
  await cards.first().locator("h3 a").click();
  await expect(guest.locator("[data-masters-detail]")).toBeVisible();
  await expect(guest.locator("[data-masters-phone]")).toHaveCount(0);
  await expect(guest.locator("main")).not.toContainText("765 43 21");
  await expect(guest.locator("[data-masters-contact]")).toContainText("telefonini ochiq ko'rsatmagan");

  // 5) mijoz so'rovi (mehmon)
  const req = guest.locator("[data-masters-request]");
  await req.getByLabel("Ismingiz").fill("Sardor");
  await req.getByLabel("Telefon raqamingiz").fill("+998 93 111 22 33");
  await req.getByLabel("Xabar (ixtiyoriy)").fill("Ertaga soat 10 da kela olasizmi?");
  await req.getByRole("button", { name: "Yuborish" }).click();
  await expect(guest.locator("[data-masters-request-sent]")).toContainText("So'rov yuborildi");

  // 6) usta kabineti: so'rov, ko'rishlar; telefon ochiq qilish (rozilik) — moderatsiyasiz
  await page.goto("/ustalar/kabinet");
  const reqs = page.locator("[data-masters-requests]");
  await expect(reqs).toContainText("Sardor · +998 93 111 22 33");
  await expect(reqs).toContainText("Ertaga soat 10 da kela olasizmi?");
  await reqs.getByRole("button", { name: "Ko'rildi deb belgilash" }).click();
  await expect(reqs).toContainText("Ko'rildi");
  await expect(mine.locator("[data-masters-status]")).toHaveText("Faol");
  await expect.poll(async () => (await sql<{ v: number }>("select views_count as v from public.master_listings where slug = $1", [row!.slug]))[0]?.v).toBeGreaterThanOrEqual(1);

  await mine.getByRole("link", { name: "Tahrirlash" }).click();
  await page.locator("[data-masters-phone-consent]").check();
  await page.locator("[data-masters-submit]").click();
  // faol e'londa faqat rozilik o'zgardi — moderatsiyasiz saqlanadi
  await expect(page.locator("[data-masters-form-sent='active']")).toContainText("O'zgarishlar saqlandi");
  const [after] = await sql<{ status: string; phone_public: boolean }>("select status::text, phone_public from public.master_listings where slug = $1", [row!.slug]);
  expect(after).toEqual({ status: "active", phone_public: true });

  // 7) endi telefon ko'rinadi (rozilik bilan), bosish hisoblanadi. Kartada — "qo'ng'iroq qilish mumkin", raqamning o'zi yo'q
  await guest.goto("/ustalar/qidiruv?k=ac");
  await expect(guest.locator("[data-masters-results] [data-master-card]").first().locator("[data-master-contact='phone']")).toHaveText("Qo'ng'iroq qilish mumkin");
  await expect(guest.locator("[data-masters-results]")).not.toContainText("765 43 21");
  await guest.goto(`/ustalar/${row!.slug}`);
  const call = guest.locator("[data-masters-phone]");
  await expect(call).toHaveAttribute("href", "tel:+998907654321");
  await expect(call).toContainText("+998 90 765 43 21");
  await call.evaluate((a: HTMLAnchorElement) => a.addEventListener("click", (e) => e.preventDefault()));
  await call.click();
  await expect.poll(async () => (await sql<{ c: number }>("select phone_clicks_count as c from public.master_listings where slug = $1", [row!.slug]))[0]?.c).toBe(1);

  // 8) sharh: mehmon yoza olmaydi; kirgan foydalanuvchi — ha; reyting faqat shundan
  await expect(guest.locator("[data-masters-review]")).toHaveCount(0);
  await expect(guest.getByRole("link", { name: "Sharh yozish uchun kiring" })).toBeVisible();
  const clientCtx = await browser.newContext({ baseURL: new URL(page.url()).origin, viewport: { width: 390, height: 844 } });
  await asGuest(clientCtx);
  await loginAs(clientCtx, USERS.employer);
  const client = await clientCtx.newPage();
  await client.goto(`/ustalar/${row!.slug}`);
  const review = client.locator("[data-masters-review]");
  await review.getByRole("radio", { name: "5 yulduz" }).click();
  await review.getByLabel("Sharh (ixtiyoriy)").fill("Tez keldi, toza ishladi.");
  await review.getByRole("button", { name: "Yuborish" }).click();
  await expect(client.locator("[data-masters-review-sent]")).toBeVisible();
  await client.reload();
  await expect(client.locator("[data-masters-reviews]")).toContainText("Tez keldi, toza ishladi.");
  await expect(client.locator("[data-masters-detail] header")).toContainText("5.0 (1 baho)");
  // egasi o'ziga sharh yoza olmaydi (forma yo'q)
  await page.goto(`/ustalar/${row!.slug}`);
  await expect(page.locator("[data-masters-review]")).toHaveCount(0);
  await expect(page.locator("[data-masters-contact]")).toContainText("Bu sizning e'loningiz.");

  await Promise.all([guestCtx.close(), adminCtx.close(), clientCtx.close()]);
});

test("tahrirlash — qayta moderatsiya; admin rad etadi — sabab egasiga ko'rinadi; yashirish, qaytarish, o'chirish", async ({ page, context, browser }) => {
  test.setTimeout(150_000);
  await loginAs(context, USERS.workerA);
  await asMode(context, "worker");
  await fillListing(page, { phonePublic: true });
  await page.locator("[data-masters-submit]").click();
  await expect(page.locator("[data-masters-form-sent='pending_review']")).toBeVisible();
  const [row] = await sql<{ id: string; slug: string }>("select id, slug from public.master_listings where owner_profile_id = $1", [USERS.workerA]);

  const adminCtx = await browser.newContext({ baseURL: new URL(page.url()).origin, viewport: { width: 1280, height: 900 } });
  await asGuest(adminCtx);
  const admin = await adminCtx.newPage();
  let item = await approveAsAdmin(admin, adminCtx);
  await expect(item).toContainText("telefon ochiq");
  await item.getByRole("button", { name: "Rad etish" }).click();
  await item.getByLabel("Sabab (egasiga ko'rinadi)").fill("Tavsifda narx ko'rsatilmagan");
  await item.getByRole("button", { name: "Rad etish" }).click();
  await expect.poll(async () => (await sql<{ status: string }>("select status::text from public.master_listings where id = $1", [row!.id]))[0]?.status).toBe("rejected");

  // egasi: sabab ko'rinadi; tuzatib qayta yuboradi → moderatsiyada
  await page.goto("/ustalar/kabinet");
  const mine = page.locator("[data-masters-my-listings] > li").filter({ hasText: TITLE });
  await expect(mine.locator("[data-masters-status]")).toHaveText("Rad etilgan");
  await expect(mine).toContainText("Rad etish sababi: Tavsifda narx ko'rsatilmagan");
  await mine.getByRole("link", { name: "Tahrirlash" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Tavsifda narx ko'rsatilmagan" })).toBeVisible();
  const form = page.locator("[data-masters-form]");
  await form.getByLabel("Kelishiladi").uncheck();
  await form.getByLabel("Narx dan").fill("150000");
  await form.getByLabel("Narx gacha").fill("400000");
  await page.locator("[data-masters-submit]").click();
  await expect(page.locator("[data-masters-form-sent='pending_review']")).toBeVisible();

  // admin tasdiqlaydi → faol; narx kartada
  await admin.goto("/admin/ustalar");
  item = admin.locator("[data-masters-queue-item]").filter({ hasText: TITLE });
  await item.getByRole("button", { name: "Tasdiqlash" }).click();
  await expect.poll(async () => (await sql<{ status: string }>("select status::text from public.master_listings where id = $1", [row!.id]))[0]?.status).toBe("active");
  await page.goto(`/ustalar/${row!.slug}`);
  await expect(page.locator("[data-masters-detail]")).toContainText(/150.*–.*400.*so'm/);

  // faol e'lon mazmuni o'zgarsa — yana moderatsiya (ommadan yo'qoladi)
  await page.goto(`/ustalar/elon/${row!.id}`);
  await page.locator("[data-masters-form]").getByLabel("E'lon sarlavhasi").fill(`${TITLE} — yangilandi`);
  await page.locator("[data-masters-submit]").click();
  await expect(page.locator("[data-masters-form-sent='pending_review']")).toBeVisible();
  expect((await page.goto(`/ustalar/${row!.slug}`))?.status()).toBe(404);

  // admin yana tasdiqlaydi; egasi yashiradi → ommada yo'q; qaytaradi → bor (moderatsiyasiz); o'chiradi
  await admin.goto("/admin/ustalar");
  await admin.locator("[data-masters-queue-item]").filter({ hasText: TITLE }).getByRole("button", { name: "Tasdiqlash" }).click();
  await expect.poll(async () => (await sql<{ status: string }>("select status::text from public.master_listings where id = $1", [row!.id]))[0]?.status).toBe("active");
  await page.goto("/ustalar/kabinet");
  await mine.getByRole("button", { name: "Yashirish" }).click();
  await expect(mine.locator("[data-masters-status]")).toHaveText("Yashirilgan");
  expect((await page.request.get(`/ustalar/${row!.slug}`)).status()).toBe(404);
  await mine.getByRole("button", { name: "Qaytarish" }).click();
  await expect(mine.locator("[data-masters-status]")).toHaveText("Faol");
  expect((await page.request.get(`/ustalar/${row!.slug}`)).status()).toBe(200);
  await mine.getByRole("button", { name: "O'chirish" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "O'chirish" }).click();
  await expect(page.locator("[data-masters-my-listings]")).toHaveCount(0);
  await expect(page.getByText("Hali e'loningiz yo'q")).toBeVisible();
  expect((await sql("select 1 from public.master_listings where id = $1", [row!.id])).length).toBe(0);
  await adminCtx.close();
});

test("xavfsizlik: begona e'lonni tahrirlab bo'lmaydi; mehmon forma va kabinetga kira olmaydi; oddiy foydalanuvchi admin sahifasini ko'rmaydi", async ({ page, context, browser }) => {
  await sql(
    `insert into public.master_listings (owner_profile_id, category_id, slug, display_name, title, description, phone, phone_public, status, published_at)
     select $1, c.id, 'e2e-begona-usta', 'Begona usta', 'Begona e''lon (E2E)', 'Bu e''lon boshqa foydalanuvchiga tegishli.', '+998977776655', false, 'active', now()
     from public.master_categories c where c.slug = 'electric'`,
    [USERS.employer],
  );
  const [other] = await sql<{ id: string }>("select id from public.master_listings where slug = 'e2e-begona-usta'");
  await asGuest(context);
  await page.goto("/ustalar/elon");
  await expect(page).toHaveURL(/\/auth\?next=%2Fustalar%2Felon/);
  await page.goto("/ustalar/kabinet");
  await expect(page).toHaveURL(/\/auth\?next=%2Fustalar%2Fkabinet/);

  await loginAs(context, USERS.workerA);
  expect((await page.goto(`/ustalar/elon/${other!.id}`))?.status()).toBe(404);
  expect((await page.goto("/admin/ustalar"))?.status()).toBe(404);
  // kabinetda begona e'lon va uning so'rovlari ko'rinmaydi
  await page.goto("/ustalar/kabinet");
  await expect(page.getByText("Begona e'lon (E2E)")).toHaveCount(0);
  // ochiq sahifada telefon yo'q (rozilik berilmagan) — HTML ichida ham
  const html = await (await page.request.get("/ustalar/e2e-begona-usta")).text();
  expect(html).not.toContain("977776655");
  expect(html).not.toContain("97 777 66 55");
  const guestCtx = await browser.newContext({ baseURL: new URL(page.url()).origin });
  const listHtml = await (await guestCtx.request.get("/ustalar/qidiruv?k=electric")).text();
  expect(listHtml).toContain("Begona e&#x27;lon (E2E)");
  expect(listHtml).not.toContain("977776655");
  await guestCtx.close();
});

test("admin: demo e'lonlarni bir bosishda olib tashlaydi va qaytaradi; haqiqiy e'longa tegmaydi", async ({ page, context }) => {
  test.setTimeout(120_000);
  await sql(
    `insert into public.master_listings (owner_profile_id, category_id, slug, display_name, title, description, phone, phone_public, status, published_at)
     select $1, c.id, 'e2e-haqiqiy-usta', 'Haqiqiy usta', 'Haqiqiy e''lon (E2E)', 'Bu haqiqiy e''lon — demo o''chirilganda qolishi kerak.', '+998901234567', false, 'active', now()
     from public.master_categories c where c.slug = 'welder'`,
    [USERS.employer],
  );
  await sql(
    `insert into public.admin_users (profile_id, role, permissions, is_active) values ($1, 'super_admin', '{}', true)
     on conflict (profile_id) do update set is_active = true, role = 'super_admin'`,
    [USERS.workerB],
  );
  await page.setViewportSize({ width: 1280, height: 900 });
  await loginAs(context, USERS.workerB, "aal2");
  await page.goto("/admin/ustalar");
  const controls = page.locator("[data-masters-demo-controls]");
  await expect(page.locator("[data-admin-masters]")).toContainText("Demo: 48");
  await controls.getByRole("button", { name: "Demo e'lonlarni olib tashlash" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Demo e'lonlarni olib tashlash" }).click();
  await expect(controls).toContainText("48 ta demo e'lon olib tashlandi");
  expect((await sql<{ n: string }>("select count(*)::text as n from public.master_listings where is_demo"))[0]!.n).toBe("0");
  expect((await sql("select 1 from public.master_listings where slug = 'e2e-haqiqiy-usta'")).length).toBe(1);

  // saytda: demo yo'q, haqiqiy e'lon bor, demo eslatmasi ham yo'q
  await page.goto("/ustalar");
  await expect(page.locator("[data-demo]")).toHaveCount(0);
  await expect(page.locator("[data-masters-demo-note]")).toHaveCount(0);
  await expect(page.locator("[data-masters-categories] a").filter({ hasText: "Payvandchi" })).toContainText("1 ta e'lon");
  await expect(page.locator("[data-masters-categories] a").filter({ hasText: "Santexnik" })).toContainText("Hali e'lon yo'q");
  await expect(page.getByText("Haqiqiy e'lon (E2E)")).toBeVisible();

  // qaytarish
  await page.goto("/admin/ustalar");
  await controls.getByRole("button", { name: "Demo e'lonlarni qaytarish" }).click();
  await expect(controls).toContainText("48 ta demo e'lon qo'shildi");
  expect((await sql<{ n: string }>("select count(*)::text as n from public.master_listings where is_demo"))[0]!.n).toBe("48");
});
