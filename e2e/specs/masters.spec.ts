import sharp from "sharp";
import { expect, test, type Page } from "@playwright/test";
import { USERS, snapshotUser, asGuest, asMode, loginAs, sql } from "../support";

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
  await sql("delete from public.listing_images where entity = 'master' and owner_profile_id in ($1, $2, $3)", [USERS.workerA, USERS.workerB, USERS.employer]);
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

/**
 * Usta e'loni — oynama-oyna (2026-11-17): kategoriya → xizmat → ism → hudud va telefon → ish namunalari → "E'lon joylash".
 * Xizmat ro'yxatda yo'q — o'zi yozadi (bitta xizmat — e'lon sarlavhasi shu). Rasm bo'lsa — stendda AI yo'q, e'lon admin
 * navbatiga ("pending_review") tushadi; rasmsiz va matn toza bo'lsa — darhol katalogda.
 */
async function wizardListing(page: Page, opts: { services?: string[]; withPhoto?: boolean } = {}) {
  await page.goto("/ustalar/elon");
  const w = page.locator("[data-master-wizard]");
  await expect(async () => {
    await w.locator("[data-category='ac']").click();
    await expect(w).toHaveAttribute("data-step", "2", { timeout: 1_000 });
  }).toPass();
  for (const s of opts.services ?? [TITLE]) {
    await w.locator("[data-master-wizard-other]").fill(s);
    await w.locator("[data-master-wizard-add]").click();
  }
  await w.locator("[data-master-wizard-next]").click();
  await w.getByLabel("Ismingiz").fill("Anvar");
  await w.locator("[data-master-wizard-next]").click();
  await w.getByLabel("Viloyat yoki shahar").selectOption({ label: "Toshkent shahri" });
  await w.getByLabel("Telefon raqamingiz").fill("907654321");
  await w.locator("[data-master-wizard-next]").click();
  await expect(w).toHaveAttribute("data-step", "5");
  if (opts.withPhoto) {
    await w.locator('input[type="file"]').setInputFiles({ name: "ish.jpg", mimeType: "image/jpeg", buffer: await photo() });
    await expect(w.locator("[data-masters-photos-upload] img")).toHaveCount(1, { timeout: 30_000 });
  }
  await w.locator("[data-master-wizard-publish]").click();
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
  // 2026-11-24: bo'lim hozircha yashirin (menyu, bosh sahifa, Profilda havola yo'q) — to'g'ridan-to'g'ri havola ochilaveradi
  await page.goto("/cabinet");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator("main [data-cabinet-masters]")).toHaveCount(0);
  await page.goto("/ustalar");
  await expect(page.getByRole("heading", { level: 1, name: "Universal ustalar xizmati" })).toBeVisible();
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

  // kirgan foydalanuvchi (ish beruvchi rejimi): chatda ham, Profilda ham havola yo'q (bo'lim yashirin)
  await loginAs(context, USERS.employer);
  await asMode(context, "employer");
  await page.goto("/chat");
  await expect(page.locator("main [data-chat-choice='find_masters']")).toHaveCount(0);
  await page.goto("/cabinet");
  await page.locator("main [data-fold='more'] [data-fold-toggle]").click();
  await expect(page.locator("main [data-cabinet-masters]")).toHaveCount(0);
});

test("oynama-oyna: kategoriya → xizmatlar → ism → hudud va telefon → rasmsiz → darhol katalogda (kategoriya sahifasida 'joylandi')", async ({ page, context }) => {
  await loginAs(context, USERS.workerA);
  await asMode(context, "worker");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/ustalar/elon");
  const w = page.locator("[data-master-wizard]");
  // 1-oyna: kategoriyalar — katta plitkalar; narx va ish vaqti hech qayerda so'ralmaydi
  await expect(w.getByRole("heading", { level: 1, name: "Qanday ustasiz?" })).toBeVisible();
  await expect(w.locator("[data-master-wizard-categories] [data-category]")).toHaveCount(12);
  await expect(async () => {
    await w.locator("[data-category='ac']").click();
    await expect(w).toHaveAttribute("data-step", "2", { timeout: 1_000 });
  }).toPass();
  // 2-oyna: shu kategoriya xizmatlari
  await expect(w.getByRole("heading", { level: 1, name: "Qaysi ishlarni qilasiz?" })).toBeVisible();
  await w.locator("[data-master-wizard-next]").click();
  await expect(w.getByRole("alert")).toHaveText("Kamida bitta xizmatni tanlang.");
  await w.locator("[data-service]", { hasText: "Konditsioner o'rnatish" }).click();
  await w.locator("[data-service]", { hasText: "Freon to'ldirish" }).click();
  await w.locator("[data-master-wizard-next]").click();
  // 3-oyna: ism hisobdan
  await expect(w.getByLabel("Ismingiz")).toHaveValue("Anvar");
  await w.locator("[data-master-wizard-next]").click();
  // 4-oyna: hudud va telefon
  await w.locator("[data-master-wizard-next]").click();
  await expect(w.getByRole("alert")).toHaveText("Hududni tanlang.");
  await w.getByLabel("Viloyat yoki shahar").selectOption({ label: "Toshkent shahri" });
  await w.locator("[data-master-wizard-next]").click();
  // 5-oyna: ish namunalari (ixtiyoriy) → "E'lon joylash"
  await expect(w.getByRole("heading", { level: 1, name: "Ish namunalaringiz" })).toBeVisible();
  await expect(page.locator("main")).not.toContainText(/narx|ish vaqti/i);
  await w.locator("[data-master-wizard-publish]").click();
  await page.waitForURL(/\/ustalar\/qidiruv\?k=ac&joylandi=1$/);
  await expect(page.locator("[data-masters-posted]")).toContainText("E'loningiz joylandi!");
  const first = page.locator("[data-masters-results] [data-master-card]").first();
  await expect(first).toContainText("Konditsioner ustasi");
  await expect(first).not.toContainText("Demo");
  const [row] = await sql<{ status: string; title: string; services: string[]; price_negotiable: boolean; work_from: string | null; phone_public: boolean; description: string }>(
    "select status::text, title, services, price_negotiable, work_from, phone_public, description from public.master_listings where owner_profile_id = $1",
    [USERS.workerA],
  );
  expect(row).toEqual({
    status: "active",
    title: "Konditsioner ustasi",
    services: ["Konditsioner o'rnatish", "Freon to'ldirish"],
    price_negotiable: true,
    work_from: null,
    phone_public: true,
    description: "Konditsioner ustasi: Konditsioner o'rnatish, Freon to'ldirish. Hudud: Toshkent shahri.",
  });
});

test("«Qanday ustasiz?» — yozsa ham tanib topadi (imlo xatosi bilan ham); tanilmasa — «Boshqa xizmatlar», yozgani xizmat bo'ladi", async ({ page, context }) => {
  await loginAs(context, USERS.workerA);
  await asMode(context, "worker");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/ustalar/elon");
  const w = page.locator("[data-master-wizard]");
  const box = w.locator("[data-master-type]");
  await expect(w.locator("[data-master-wizard-categories] [data-category]")).toHaveCount(12);
  await box.fill("konditsoner ustasiman");
  await expect(w.locator("[data-master-type-guess]")).toHaveAttribute("data-master-type-guess", "ac");
  await expect(w.locator("[data-master-type-guess]")).toHaveText("Topildi: Konditsioner ustasi");
  await expect(w.locator("[data-category='ac']")).toHaveClass(/border-primary/);
  await box.fill("сантехник");
  await expect(w.locator("[data-master-type-guess]")).toHaveAttribute("data-master-type-guess", "plumber");
  await expect(async () => {
    await w.locator("[data-master-type-go]").click();
    await expect(w).toHaveAttribute("data-step", "2", { timeout: 1_000 });
  }).toPass();
  await expect(w).toContainText("Santexnik");

  // tanilmagan kasb — "Boshqa xizmatlar", yozgani — tanlangan xizmat
  await w.locator("[data-master-wizard-back]").click();
  await expect(w).toHaveAttribute("data-step", "1");
  await w.locator("[data-master-type]").fill("akvarium tozalash");
  await expect(w.locator("[data-master-type-guess]")).toHaveAttribute("data-master-type-guess", "");
  await w.locator("[data-master-type-go]").click();
  await expect(w).toHaveAttribute("data-step", "2");
  await expect(w).toContainText("Boshqa xizmatlar");
  await expect(w.locator("[data-service][aria-pressed='true']")).toHaveText("Akvarium tozalash");
});

test("qidiruv: «konditsioner ustasi kerak», «santexnk», «сантехник» — kategoriya tanib olinadi, natijalar shu kategoriyadan", async ({ page, context }) => {
  await asGuest(context);
  await page.setViewportSize({ width: 390, height: 844 });
  for (const [q, slug, title] of [
    ["konditsioner ustasi kerak", "ac", "Konditsioner ustasi"],
    ["santexnk", "plumber", "Santexnik"],
    ["сантехник", "plumber", "Santexnik"],
    ["kir yuvish mashinasi", "appliance", "Maishiy texnika ustasi"],
  ] as const) {
    await page.goto(`/ustalar/qidiruv?q=${encodeURIComponent(q)}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
    await expect(page.locator(`[data-masters-chips] a[aria-current='page']`)).toHaveAttribute("href", new RegExp(`k=${slug}`));
    const cards = page.locator("[data-masters-results] [data-master-card]");
    await expect(cards.first()).toBeVisible();
    // demo e'lonlar — har kategoriyada 4 tadan; boshqa kategoriya aralashmaydi
    const [row] = await sql<{ n: string }>(
      "select count(*)::text as n from public.master_listings l join public.master_categories c on c.id = l.category_id where l.status = 'active' and c.slug = $1",
      [slug],
    );
    await expect(cards).toHaveCount(Math.min(Number(row!.n), 12));
  }
});

test("usta e'loni rasmi (AI, soxta OpenAI): oxirgi oynada «Rasm yaratish» → e'lon shu rasm bilan; kartada va sahifada — ish namunalaridan alohida", async ({ page, context }) => {
  test.setTimeout(120_000);
  await loginAs(context, USERS.workerA);
  await asMode(context, "worker");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/ustalar/elon");
  const w = page.locator("[data-master-wizard]");
  await expect(async () => {
    await w.locator("[data-category='plumber']").click();
    await expect(w).toHaveAttribute("data-step", "2", { timeout: 1_000 });
  }).toPass();
  await w.locator("[data-service]").first().click();
  await w.locator("[data-master-wizard-next]").click();
  await w.locator("[data-master-wizard-next]").click();
  await w.getByLabel("Viloyat yoki shahar").selectOption({ label: "Toshkent shahri" });
  await w.locator("[data-master-wizard-next]").click();
  await expect(w).toHaveAttribute("data-step", "5");
  await w.locator("[data-listing-image-create]").click();
  await expect(w.locator("[data-listing-image='ready'] [data-listing-image-preview]")).toBeVisible({ timeout: 60_000 });
  await w.locator("[data-master-wizard-publish]").click();
  await page.waitForURL(/\/ustalar\/qidiruv\?k=plumber&joylandi=1$/);
  const [l] = await sql<{ id: string; slug: string; photos: string[] }>("select id, slug, photos from public.master_listings where owner_profile_id = $1", [USERS.workerA]);
  // ish namunalari bo'sh — AI rasm u yerga qo'shilmaydi (faqat haqiqiy ishlar)
  expect(l!.photos).toEqual([]);
  const [img] = await sql<{ status: string; image_url: string; prompt: string }>("select status, image_url, prompt from public.listing_images where entity = 'master' and entity_id = $1", [l!.id]);
  expect(img!.status).toBe("ready");
  expect(img!.prompt).toMatch(/plumber/);
  await expect(page.locator(`[data-master-card] a[href='/ustalar/${l!.slug}'] img`).first()).toHaveAttribute("src", img!.image_url);
  await page.goto(`/ustalar/${l!.slug}`);
  await expect(page.locator("[data-listing-photo] img")).toHaveAttribute("src", img!.image_url);
  await expect(page.locator("[data-masters-photos]")).toHaveCount(0);
});

test("usta e'lon joylaydi → moderatsiya → admin tasdiqlaydi → katalogda; telefon faqat rozilik bilan; so'rov, sharh, statistika", async ({ page, context, browser }) => {
  test.setTimeout(180_000);
  // 1) usta: e'lon (rasm bilan — stendda rasm AI bilan tekshirilmaydi, shuning uchun admin navbatiga)
  await loginAs(context, USERS.workerA);
  await asMode(context, "worker");
  await wizardListing(page, { withPhoto: true });
  await expect(page.locator("[data-master-wizard-review]")).toContainText("E'loningiz qabul qilindi");
  const [row] = await sql<{ id: string; slug: string; status: string; photos: string[]; phone_public: boolean; title: string; price_negotiable: boolean; description: string }>(
    "select id, slug, status::text, photos, phone_public, title, price_negotiable, description from public.master_listings where owner_profile_id = $1",
    [USERS.workerA],
  );
  expect(row!.status).toBe("pending_review");
  // sarlavha va tavsif — faqat tanlanganlardan; narx so'ralmaydi ("Kelishiladi"); telefon ochiq (oynada aytiladi)
  expect(row!.title).toBe(TITLE);
  expect(row!.description).toBe(`Konditsioner ustasi: ${TITLE}. Hudud: Toshkent shahri.`);
  expect(row!.price_negotiable).toBe(true);
  expect(row!.phone_public).toBe(true);
  // tahrirlash formasida telefonni yopish (rozilik olib tashlanadi) — keyingi qadamlar "faqat so'rov" holatini tekshiradi
  await page.goto(`/ustalar/elon/${row!.id}`);
  await page.locator("[data-masters-phone-consent]").uncheck();
  await page.locator("[data-masters-submit]").click();
  await expect(page.locator("[data-masters-form-sent='pending_review']")).toBeVisible();
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
  await expect(guest.getByText(TITLE, { exact: true })).toHaveCount(0);
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
  await wizardListing(page, { withPhoto: true });
  await expect(page.locator("[data-master-wizard-review]")).toBeVisible();
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

test("noqonuniy mazmun: taqiqlangan e'lon saqlanmaydi (muallif bloklanadi); shubhali e'lon admin navbatida ogohlantirish va rasmlar bilan chiqadi", async ({ page, context }) => {
  await sql("delete from public.master_listings where owner_profile_id = $1", [USERS.workerA]);
  await loginAs(context, USERS.workerA);
  await asMode(context, "worker");
  const restore = await snapshotUser(USERS.workerA);
  try {
    // 2026-11-13: og'ir taqiq — e'lon saqlanmaydi va muallif o'sha zahoti bloklanadi (moderation-ban.spec.ts)
    await wizardListing(page, { services: ["Intim xizmat, uyga boramiz"] });
    await expect(page.locator("[data-master-wizard]").getByRole("alert")).toContainText("hisobingiz bloklandi");
    expect((await sql<{ n: string }>("select count(*)::text as n from public.master_listings where owner_profile_id = $1", [USERS.workerA]))[0]!.n).toBe("0");
    expect((await sql<{ b: boolean }>("select is_blocked as b from public.profiles where id = $1", [USERS.workerA]))[0]!.b).toBe(true);
  } finally {
    await restore();
  }

  // shubhali (savdo + oldindan to'lov) — saqlanadi, lekin darhol chiqmaydi: admin ogohlantirishni va rasmni ko'radi
  await wizardListing(page, { services: [TITLE, "Optom sotiladi", "Oldindan to'lov 50%"], withPhoto: true });
  await expect(page.locator("[data-master-wizard-review]")).toBeVisible();

  await sql(
    `insert into public.admin_users (profile_id, role, permissions, is_active) values ($1, 'super_admin', '{}', true)
     on conflict (profile_id) do update set is_active = true, role = 'super_admin'`,
    [USERS.workerB],
  );
  try {
    await loginAs(context, USERS.workerB, "aal2");
    await page.goto("/admin/ustalar");
    const item = page.locator("[data-masters-queue-item]").filter({ hasText: TITLE });
    await expect(item.locator("[data-masters-flags]")).toContainText("mahsulot savdosi");
    await expect(item.locator("[data-masters-flags]")).toContainText("oldindan to'lov so'ralgan");
    await expect(item.locator("[data-masters-queue-photos] img")).toHaveCount(1);
  } finally {
    await sql("delete from public.admin_users where profile_id = $1", [USERS.workerB]);
    await sql("delete from public.master_listings where owner_profile_id = $1", [USERS.workerA]);
  }
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
