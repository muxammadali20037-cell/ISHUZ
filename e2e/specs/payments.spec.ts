import crypto from "node:crypto";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { USERS, asGuest, asMode, loginAs, next, pickProfession, pickWholeRegion, sql } from "../support";

/**
 * F · to'lov qulay va ishonchli: e'lon tayyor bo'lgach to'lov paneli shu ekranda (nima olinadi, narx, kunlik narx,
 * ishonch) — Payme/Click'gacha 1 bosish; hamyon — bir marta to'ldirib (bonus bilan), keyin balansdan bir bosishda;
 * chek va "To'lovlarim"; bekor bo'lgan to'lovni "Qayta to'lash". Payme/Click server so'rovlari stend kalitlari bilan
 * taqlid qilinadi (tashqariga chiqilmaydi).
 */

const PAYME_KEY = "e2e-payme-key-not-secret";
const CLICK_SECRET = "e2e-click-key-not-secret";
const USERS_ALL = [USERS.workerA, USERS.employer];

let promo: unknown = null;
test.beforeAll(async () => {
  [{ value: promo }] = (await sql<{ value: unknown }>("select value from public.app_settings where key = 'billing_free_until'")) as [{ value: unknown }];
});
test.beforeEach(async () => {
  await sql("update public.app_settings set value = 'true'::jsonb where key = 'listings_paid'");
  await sql("update public.app_settings set value = to_jsonb('2020-01-01T00:00:00Z'::text) where key = 'billing_free_until'");
  await cleanup();
});
test.afterEach(async () => {
  await cleanup();
  await sql("update public.app_settings set value = 'false'::jsonb where key in ('listings_paid', 'ai_alerts_paid')");
  await sql("update public.app_settings set value = '0'::jsonb where key = 'wallet_bonus_percent'");
  await sql("update public.app_settings set value = $1::jsonb where key = 'billing_free_until'", [JSON.stringify(promo)]);
});

async function cleanup() {
  await sql("delete from public.wallet_ledger where profile_id = any($1)", [USERS_ALL]);
  await sql("delete from public.wallets where profile_id = any($1)", [USERS_ALL]);
  await sql("delete from public.payments where profile_id = any($1)", [USERS_ALL]);
  await sql("delete from public.vacancies where owner_profile_id = $1", [USERS.employer]);
  await sql("delete from public.worker_profiles where profile_id = $1", [USERS.workerA]);
  await sql("delete from public.ai_alert_subscriptions where profile_id = any($1)", [USERS_ALL]);
  await sql("delete from public.rate_limits where key like any($1)", [USERS_ALL.map((u) => `%${u}%`)]);
}

/** Payme serveri: tekshiruv → yaratish → bajarish (JSON-RPC, Basic auth, summa tiyinda) */
async function paymePays(request: APIRequestContext, orderNo: string, amountSum: number) {
  const auth = { Authorization: `Basic ${Buffer.from(`Paycom:${PAYME_KEY}`).toString("base64")}` };
  const rpc = async (method: string, params: object) => (await request.post("/api/payments/payme", { headers: auth, data: { jsonrpc: "2.0", id: 1, method, params } })).json();
  const account = { order_id: orderNo };
  const amount = amountSum * 100;
  const txn = `e2e-${orderNo}-${Date.now()}`;
  expect((await rpc("CheckPerformTransaction", { amount, account })).result?.allow).toBe(true);
  expect((await rpc("CreateTransaction", { id: txn, time: Date.now(), amount, account })).result?.state).toBe(1);
  expect((await rpc("PerformTransaction", { id: txn })).result?.state).toBe(2);
}

/** Payme sahifasiga yo'naltirish: tashqi sahifa o'rniga sinov sahifasi; parametrlar qaytariladi */
async function interceptPayme(page: Page) {
  await page.route("https://checkout.test.paycom.uz/**", (r) => r.fulfill({ contentType: "text/html", body: "<html><body>Payme test</body></html>" }));
}
function paymeParams(url: string) {
  const decoded = Buffer.from(new URL(url).pathname.slice(1), "base64").toString("utf8");
  return Object.fromEntries(decoded.split(";").map((kv) => [kv.slice(0, kv.indexOf("=")), kv.slice(kv.indexOf("=") + 1)]));
}

async function postWorkerListing(page: Page) {
  await page.goto("/post/worker");
  await pickProfession(page, "Buxgalter", "Buxgalter");
  await next(page);
  await pickWholeRegion(page);
  await next(page);
  await page.getByLabel("Ismingiz").fill("Anvar");
  await page.getByRole("radio", { name: "3 yildan ko'p" }).click();
  await page.locator("#about").fill("Buxgalteriya, 1C, soliq hisobotlari, 5 yil tajriba");
  await next(page);
  await page.getByRole("button", { name: /joylash/i }).last().click();
}

async function postVacancy(page: Page) {
  await sql(
    `insert into public.employer_profiles (profile_id, employer_type, display_name, onboarding_completed_at)
     values ($1, 'person', 'Dilnoza opa', now()) on conflict (profile_id) do nothing`,
    [USERS.employer],
  );
  await page.goto("/post/vacancy");
  await pickProfession(page, "Buxgalter", "Buxgalter");
  await next(page);
  await pickWholeRegion(page);
  await next(page);
  await page.getByRole("radio", { name: "O'zim uchun" }).click();
  await page.locator("#org").fill("Dilnoza opa");
  await page.locator("#desc").fill("Kichik do'konga buxgalter kerak, haftasiga 5 kun, 1C bilish shart");
  await page.locator("#salary-from").fill("4000000");
  await next(page);
  await page.getByRole("button", { name: /E'lonni joylash/ }).click();
}

test("ishchi e'loni: to'lov paneli shu ekranda — foyda, narx, kunlik narx, ishonch; Payme'gacha 1 bosish → chek", async ({ page, context, request }) => {
  test.setTimeout(120_000);
  await loginAs(context, USERS.workerA);
  await asMode(context, "worker");
  await interceptPayme(page);
  await postWorkerListing(page);

  await expect(page.getByRole("heading", { level: 1, name: "E'loningiz tayyor! Joylash uchun to'lov qoldi" })).toBeVisible({ timeout: 30_000 });
  const checkout = page.getByTestId("checkout");
  await expect(checkout.getByText("10 kun ish beruvchilar qidiruvida")).toBeVisible();
  await expect(checkout.getByTestId("checkout-price")).toHaveText("5 000 so'm");
  await expect(checkout.getByText("10 000 so'm")).toBeVisible(); // asl narx (chizilgan)
  await expect(checkout.getByText("kuniga 500 so'm")).toBeVisible();
  await expect(checkout.getByText("Karta ma'lumotlari bizga kelmaydi — to'lov Payme yoki Click sahifasida")).toBeVisible();
  // hamyon bo'sh — "Balansdan to'lash" yo'q, balans yetmasligi aytiladi
  await expect(checkout.getByRole("button", { name: /Balansdan to'lash/ })).toHaveCount(0);
  await expect(checkout.getByText("Balansingiz: 0 so'm — bu xizmatga yetmaydi")).toBeVisible();

  await checkout.getByRole("button", { name: "Payme orqali to'lash" }).click();
  await page.waitForURL(/checkout\.test\.paycom\.uz/);
  const params = paymeParams(page.url());
  expect(params.m).toBe("e2e-merchant");
  expect(params.a).toBe("500000"); // 5 000 so'm tiyinda
  expect(params.c).toBe(`http://localhost:3300/billing/return?order=${params["ac.order_id"]}`);

  await paymePays(request, params["ac.order_id"]!, 5000);
  await page.goto(`/billing/return?order=${params["ac.order_id"]}`);
  await expect(page.getByRole("heading", { level: 1, name: "To'lov qabul qilindi!" })).toBeVisible();
  const receipt = page.getByRole("region", { name: "Chek" });
  await expect(receipt).toContainText("Ish qidirish e'loni");
  await expect(receipt).toContainText("Payme");
  await expect(receipt).toContainText(`№${params["ac.order_id"]}`);
  const [w] = await sql<{ is_public: boolean }>("select is_public from public.worker_profiles where profile_id = $1", [USERS.workerA]);
  expect(w!.is_public).toBe(true);

  // "To'lovlarim" — tarixda to'langan
  await page.getByRole("link", { name: "To'lovlarim" }).click();
  await expect(page.getByTestId("payment-row").first()).toContainText("To'langan");
});

test("hamyon: to'ldirish (bonus bilan) → balansdan bir bosishda vakansiya joylanadi, chekda 'Hamyon'", async ({ page, context, request }) => {
  test.setTimeout(150_000);
  await sql("update public.app_settings set value = '10'::jsonb where key = 'wallet_bonus_percent'");
  await sql("update public.app_settings set value = '100000'::jsonb where key = 'wallet_bonus_min'");
  await loginAs(context, USERS.employer);
  await asMode(context, "employer");
  await interceptPayme(page);

  await page.goto("/billing");
  await expect(page.getByTestId("wallet-balance")).toHaveText("0 so'm");
  await page.getByRole("radio", { name: /100 000 so'm/ }).click();
  await expect(page.getByText("+10 000 so'm bonus").last()).toBeVisible();
  await page.getByRole("button", { name: "Payme orqali 100 000 so'm to'ldirish" }).click();
  await page.waitForURL(/checkout\.test\.paycom\.uz/);
  const order = paymeParams(page.url())["ac.order_id"]!;
  expect(paymeParams(page.url()).a).toBe("10000000");
  await paymePays(request, order, 100_000);
  await page.goto(`/billing/return?order=${order}`);
  await expect(page.getByRole("heading", { level: 1, name: "Hamyon to'ldirildi" })).toBeVisible();
  await expect(page.getByText("Balansingizga 100 000 so'm va 10 000 so'm bonus qo'shildi")).toBeVisible();
  await page.getByRole("link", { name: "Hamyonga" }).click();
  await expect(page.getByTestId("wallet-balance")).toHaveText("110 000 so'm");
  await expect(page.getByTestId("payment-row").first()).toContainText("+10 000 so'm bonus");

  await postVacancy(page);
  const checkout = page.getByTestId("checkout");
  await expect(checkout.getByTestId("checkout-price")).toHaveText("25 000 so'm", { timeout: 30_000 });
  await expect(checkout.getByText("Balansingiz: 110 000 so'm · To'lovdan keyin qoladi: 85 000 so'm")).toBeVisible();
  await expect(checkout.getByText(/Tekshiruvdan o'tmasa — tuzatib qayta yuborasiz, 10 kun ichida qayta to'lamaysiz/)).toBeVisible();
  await checkout.getByRole("button", { name: /Balansdan to'lash · 25 000 so'm/ }).click();
  await page.waitForURL(/\/billing\/return\?order=\d+/);
  await expect(page.getByRole("heading", { level: 1, name: "To'lov qabul qilindi!" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Chek" })).toContainText("Hamyon");
  const [v] = await sql<{ status: string }>("select status from public.vacancies where owner_profile_id = $1", [USERS.employer]);
  expect(v!.status).toBe("active");
  const [b] = await sql<{ balance: string }>("select balance::text from public.wallets where profile_id = $1", [USERS.employer]);
  expect(b!.balance).toBe("85000");
});

test("bekor bo'lgan to'lov: 'Qayta to'lash' shu xizmat oynasini ochadi; Click — oxirgi tanlangan usul birinchi", async ({ page, context }) => {
  await sql("insert into public.worker_profiles (profile_id) values ($1)", [USERS.workerA]);
  const [p] = await sql<{ order_no: string }>(
    `insert into public.payments (profile_id, purpose, worker_id, amount, status, cancelled_at)
     select $1, 'worker_listing', id, 5000, 'cancelled', now() from public.worker_profiles where profile_id = $1 returning order_no::text`,
    [USERS.workerA],
  );
  await loginAs(context, USERS.workerA);
  await asMode(context, "worker");
  await page.goto(`/billing/return?order=${p!.order_no}`);
  await expect(page.getByRole("heading", { level: 1, name: "To'lov bekor qilindi" })).toBeVisible();
  await page.evaluate(() => localStorage.setItem("ib_pay_provider", "click"));
  await page.getByRole("button", { name: "Qayta to'lash" }).click();
  const dialog = page.getByRole("dialog", { name: "Ish qidirish e'lonini joylash" });
  await expect(dialog.getByTestId("checkout-price")).toBeVisible();
  // oxirgi marta Click tanlangan — birinchi va asosiy
  await expect(dialog.locator("button[data-provider]").first()).toHaveAttribute("data-provider", "click");

  await page.route("https://my.click.uz/**", (r) => r.fulfill({ contentType: "text/html", body: "<html>Click test</html>" }));
  await dialog.getByRole("button", { name: "Click orqali to'lash" }).click();
  await page.waitForURL(/my\.click\.uz/);
  const q = new URL(page.url()).searchParams;
  expect(q.get("service_id")).toBe("e2e-service");
  expect(q.get("merchant_id")).toBe("e2e-merchant");
  expect(q.get("amount")).toBe("5000");
  const orderNo = q.get("transaction_param")!;

  // Click serveri: Prepare → Complete (md5 imzo)
  const sign = (f: Record<string, string>) =>
    crypto
      .createHash("md5")
      .update([f.click_trans_id, f.service_id, CLICK_SECRET, f.merchant_trans_id, f.action === "1" ? f.merchant_prepare_id : "", f.amount, f.action, f.sign_time].join(""))
      .digest("hex");
  const base = { click_trans_id: "777001", service_id: "e2e-service", click_paydoc_id: "1", merchant_trans_id: orderNo, amount: "5000", error: "0", error_note: "", sign_time: "2026-10-13 12:00:00" };
  const prep = { ...base, action: "0" };
  const r1 = await (await page.request.post("/api/payments/click", { form: { ...prep, sign_string: sign(prep) } })).json();
  expect(r1.error).toBe(0);
  const comp = { ...base, action: "1", merchant_prepare_id: String(r1.merchant_prepare_id) };
  const r2 = await (await page.request.post("/api/payments/click", { form: { ...comp, sign_string: sign(comp) } })).json();
  expect(r2.error).toBe(0);
  await page.goto(`/billing/return?order=${orderNo}`);
  await expect(page.getByRole("region", { name: "Chek" })).toContainText("Click");
  const [w] = await sql<{ is_public: boolean }>("select is_public from public.worker_profiles where profile_id = $1", [USERS.workerA]);
  expect(w!.is_public).toBe(true);
});

test("AI PRO: ixcham to'lov — balansdan bir bosishda obuna yoqiladi", async ({ page, context }) => {
  await sql("update public.app_settings set value = 'true'::jsonb where key = 'ai_alerts_paid'");
  await sql("insert into public.wallets (profile_id, balance) values ($1, 20000)", [USERS.workerA]);
  await loginAs(context, USERS.workerA);
  await asMode(context, "worker");
  await page.goto("/ai-alerts?role=worker");
  const checkout = page.getByTestId("checkout");
  await expect(checkout.getByRole("button", { name: "Payme orqali to'lash" })).toBeVisible();
  await checkout.getByRole("button", { name: /Balansdan to'lash · 15 000 so'm/ }).click();
  await page.waitForURL(/\/billing\/return\?order=\d+/);
  await expect(page.getByText("AI yordamchi 1 oyga yoqildi")).toBeVisible();
  const [s] = await sql<{ n: number }>("select count(*)::int as n from public.ai_alert_subscriptions where profile_id = $1 and paid_until > now() + interval '29 days'", [USERS.workerA]);
  expect(s!.n).toBe(1);
});

test("mehmon: 'To'lovlarim' — kirishga, keyin shu sahifaga", async ({ page, context }) => {
  await asGuest(context);
  await page.goto("/billing");
  await page.waitForURL(/\/auth\?next=%2Fbilling/);
});
