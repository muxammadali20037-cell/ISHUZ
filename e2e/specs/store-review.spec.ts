import { expect, test } from "@playwright/test";
import { asGuest, gatewayUrl, sql } from "../support";

/**
 * Do'kon tekshiruvchisi (Google Play / App Store) uchun test kirish (ega, 2026-11-25).
 * Stendda STORE_REVIEW_PHONE="+998 99 000 00 00", STORE_REVIEW_CODE="246810" (e2e/stack/up.sh). Telegram bot yo'q —
 * oddiy raqamlar uchun kirish o'chiq (auth.spec.ts), maxsus raqam esa Telegram'siz alohida demo hisobga kiradi.
 */
const REVIEW_ID = "5e1f2e71-0000-4000-8000-000000000001";

test.beforeEach(async () => {
  // har yugurish — yangi demo hisob (shlyuzning xotiradagi auth holati ham tozalanadi)
  await sql("delete from auth.users where id = $1", [REVIEW_ID]);
  await fetch(`${gatewayUrl}/__e2e/auth/reset`, { method: "POST" });
  // oldingi yugurishlarning xato hisoblagichlari va cheklovlari (stend)
  await sql("delete from public.rate_limits where key like 'otp:%'");
  await sql("delete from public.security_restrictions where reason_code like 'otp%' or scope in ('phone', 'ip')");
});

test("maxsus raqam + doimiy kod — demo hisobga kiradi; noto'g'ri kod rad etiladi; boshqa raqam — avvalgidek", async ({ page, context }) => {
  await asGuest(context);
  await page.goto("/auth/telefon?next=%2Fcabinet");
  await page.locator("#phone").fill("99 000 00 00");
  await page.getByRole("button", { name: "Kod yuborish" }).click();
  const code = page.getByLabel("6 xonali kod");
  await expect(code).toBeAttached();
  await code.fill("111111");
  await expect(page.getByText("Kod noto'g'ri")).toBeVisible();
  await code.fill("246810");
  await expect(page).not.toHaveURL(/\/auth\//, { timeout: 20_000 });

  // alohida demo hisob: doimiy id, server belgisi, telefon va Telegram ulanmagan, texnik email kontaktga yozilmagan
  const [user] = await sql<{ email: string; review: boolean }>("select email, (raw_app_meta_data->>'store_review')::boolean as review from auth.users where id = $1", [REVIEW_ID]);
  expect(user).toEqual({ email: "store-review@telegram.ishuz.local", review: true });
  expect(await sql("select 1 from public.telegram_accounts where profile_id = $1", [REVIEW_ID])).toHaveLength(0);
  const [contact] = await sql<{ email: string | null; phone: string | null }>("select email, phone from public.profile_contacts where profile_id = $1", [REVIEW_ID]);
  expect(contact).toEqual({ email: null, phone: null });
  const [event] = await sql<{ n: number }>("select count(*)::int as n from public.security_events where event_type = 'auth.store_review_login'");
  expect(event!.n).toBeGreaterThan(0);

  // ikkinchi kirish — o'sha hisob (yangisi yaratilmaydi)
  await context.clearCookies();
  await page.goto("/auth/telefon?next=%2Fcabinet");
  await page.locator("#phone").fill("99 000 00 00");
  await page.getByRole("button", { name: "Kod yuborish" }).click();
  await page.getByLabel("6 xonali kod").fill("246810");
  await expect(page).not.toHaveURL(/\/auth\//, { timeout: 20_000 });
  expect(await sql("select 1 from auth.users where email like 'store-review%'")).toHaveLength(1);

  // boshqa raqam — kod Telegram orqali (stendda bot yo'q): demo kod u yerda ishlamaydi
  await context.clearCookies();
  await page.goto("/auth/telefon?next=%2Fcabinet");
  await page.locator("#phone").fill("90 123 45 67");
  await page.getByRole("button", { name: "Kod yuborish" }).click();
  await expect(page.getByText("Telegram orqali kirish hozircha o'chirilgan")).toBeVisible();
  const res = await page.request.post("/api/auth/phone-code/verify", { data: { phone: "+998901234567", code: "246810" }, headers: { origin: new URL(page.url()).origin } });
  expect(res.status()).toBe(400);
});

test("shu id'da server yaratmagan hisob bo'lsa — kirish rad etiladi va jurnalga yoziladi", async ({ page, context }) => {
  await sql("insert into auth.users (id, email, raw_app_meta_data) values ($1, 'store-review@telegram.ishuz.local', '{}')", [REVIEW_ID]);
  const [before] = await sql<{ n: number }>("select count(*)::int as n from public.security_events where event_type = 'auth.store_review_untrusted'");
  await asGuest(context);
  await page.goto("/auth/telefon?next=%2Fcabinet");
  await page.locator("#phone").fill("99 000 00 00");
  await page.getByRole("button", { name: "Kod yuborish" }).click();
  await page.getByLabel("6 xonali kod").fill("246810");
  await expect(page.getByText("Kirib bo'lmadi. Qayta urinib ko'ring.")).toBeVisible();
  await expect(page).toHaveURL(/\/auth\/telefon/);
  const [after] = await sql<{ n: number }>("select count(*)::int as n from public.security_events where event_type = 'auth.store_review_untrusted'");
  expect(after!.n).toBe(before!.n + 1);
});
