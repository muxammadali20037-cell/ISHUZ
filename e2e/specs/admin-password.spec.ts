import { expect, test, type Page } from "@playwright/test";
import { USERS, asGuest, gatewayUrl, loginAs, sql, stack } from "../support";
import { roleKey } from "../stack/jwt.mjs";

/**
 * Admin zaxira kirishi (Telegram ishlamaganda): email + parol, keyin baribir autentifikator kodi.
 * Egasi birinchi marta Telegram'siz: SUPER_ADMIN_EMAILS dagi email (stendda owner@e2e.uz) → havola → kod → panelda parol.
 * Stendda Supabase Auth yo'q — shlyuz parol bilan kirish, admin users va tiklash xatini taqlid qiladi (xat "pochta qutisi"da).
 * Autentifikator kodining o'zi (TOTP) bu yerda tekshirilmaydi: o'tilgan holat aal2 sessiya bilan beriladi.
 */

const OWNER_EMAIL = "owner@e2e.uz";
const PASSWORD = "tog'da uchta oq olma 2026";

async function mailLink(email: string): Promise<string | null> {
  const r = await fetch(`${gatewayUrl}/__e2e/mail?email=${encodeURIComponent(email)}`);
  return r.ok ? ((await r.json()) as { link: string }).link : null;
}

/** Parolni to'g'ridan-to'g'ri (service role, admin API) — masalan, ochiq ro'yxatdan o'tib parol qo'ygan oddiy hisob */
async function setAuthPassword(userId: string, email: string, password: string) {
  const r = await fetch(`${gatewayUrl}/auth/v1/admin/users/${userId}`, {
    method: "PUT",
    headers: { "content-type": "application/json", authorization: `Bearer ${roleKey("service_role", stack.secret)}`, apikey: roleKey("service_role", stack.secret) },
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  expect(r.ok).toBe(true);
}

async function signIn(page: Page, email: string, password: string) {
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Parol", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Kirish", exact: true }).click();
}

const sessionCookie = async (page: Page) => (await page.context().cookies()).find((c) => c.name.startsWith("sb-") && c.name.includes("auth-token"));

test.beforeEach(async () => {
  await fetch(`${gatewayUrl}/__e2e/auth/reset`, { method: "POST" });
  await sql("delete from public.rate_limits where key like 'admin_pw:%' or key like 'admin_link:%'");
  // shlyuzdagi parollar tozalandi — "parol o'rnatilgan" belgisi (audit) ham avvalgi ishga tushirishlardan qolmasin
  await sql("delete from public.audit_logs where target_id = $1 and action in ('admin.login_credentials_set', 'admin.owner_email_attach')", [USERS.workerB]);
  await sql("update public.admin_users set is_active = false where role = 'super_admin' and profile_id <> $1", [USERS.workerB]);
  await sql(
    `insert into public.admin_users (profile_id, role, permissions, is_active) values ($1, 'super_admin', '{}', true)
     on conflict (profile_id) do update set is_active = true, role = 'super_admin'`,
    [USERS.workerB],
  );
});
test.afterEach(async () => {
  await sql("delete from public.admin_users where profile_id = $1", [USERS.workerB]);
});

test("egasi Telegram'siz: email havolasi → kod sahifasi → panelda parol; keyingi safar email + parol → yana kod", async ({ page, context }) => {
  test.setTimeout(90_000);
  const [{ started }] = (await sql<{ started: string }>("select now()::text as started")) as [{ started: string }];
  await asGuest(context);

  // panel → kirish usullari: admin uchun uchinchi yo'l bor
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/auth\?next=%2Fadmin$/);
  await page.getByRole("link", { name: /Email va parol/ }).click();
  await expect(page).toHaveURL(/\/auth\/admin\?next=%2Fadmin$/);
  await expect(page.getByRole("heading", { level: 1, name: "Admin: email va parol" })).toBeVisible();
  await expect(page.getByText("parolning o'zi panelni ochmaydi")).toBeVisible();

  // parol hali yo'q → havola so'rash
  await page.getByRole("link", { name: "Parol yo'qmi yoki unutdingizmi?" }).click();
  await expect(page).toHaveURL(/\/auth\/admin\/tiklash$/);
  await page.getByLabel("Email", { exact: true }).fill("  Owner@E2E.uz ");
  await page.getByRole("button", { name: "Havola yuborish" }).click();
  await expect(page.getByRole("heading", { name: "Emailingizni tekshiring" })).toBeVisible();

  // email egasining (yagona super_admin) hisobiga biriktirildi va auditga yozildi
  const audit = await sql<{ action: string; target_id: string }>("select action, target_id::text from public.audit_logs where created_at >= $1 and action = 'admin.owner_email_attach'", [started]);
  expect(audit).toEqual([{ action: "admin.owner_email_attach", target_id: USERS.workerB }]);
  const link = await mailLink(OWNER_EMAIL);
  expect(link).toMatch(new RegExp(`^${stack.app}/auth/admin/havola#access_token=`));

  // havola → sessiya → autentifikator kodi (parol/havolaning o'zi panelni ochmaydi); tokenlar manzil satrida qolmaydi
  await page.goto(link!);
  await expect(page).toHaveURL(/\/admin\/mfa\?next=%2Fadmin%2Faccount%3Fsetup%3D1$/);
  await expect(page.getByRole("heading", { name: "Ikki bosqichli kirish" })).toBeVisible();
  expect(page.url()).not.toContain("access_token");

  // kod o'tildi (aal2) → kirish usullari: parol o'rnatish
  await loginAs(context, USERS.workerB, "aal2");
  await page.goto("/admin/account?setup=1");
  await expect(page.getByRole("heading", { level: 1, name: "Kirish usullari" })).toBeVisible();
  await expect(page.getByText("Emaildagi havola orqali kirdingiz")).toBeVisible();
  await expect(page.getByTestId("login-email")).toHaveText(OWNER_EMAIL);
  // email havola orqali biriktirilgan, parol hali yo'q — "o'rnatilmagan" (yolg'on ✓ emas)
  const passwordMethod = page.getByRole("listitem").filter({ hasText: "Email va parol (zaxira)" });
  await expect(passwordMethod).toContainText("O'rnatilmagan");
  const form = page.locator("form").filter({ has: page.getByLabel("Yangi parol") });
  await expect(form.getByLabel("Email", { exact: true })).toHaveValue(OWNER_EMAIL);
  const save = form.getByRole("button", { name: "Saqlash" });

  await form.getByLabel("Yangi parol").fill("qisqa");
  await save.click();
  await expect(form.getByRole("alert")).toHaveText("Parol kamida 12 belgi bo'lsin");
  await form.getByLabel("Yangi parol").fill(PASSWORD);
  await form.getByLabel("Parolni qayta yozing").fill(`${PASSWORD}!`);
  await save.click();
  await expect(form.getByRole("alert")).toHaveText("Parollar bir xil emas");
  await form.getByLabel("Parolni qayta yozing").fill(PASSWORD);
  await save.click();
  await expect(page.getByText("Saqlandi. Endi email va parol bilan ham kira olasiz.")).toBeVisible();
  await expect(passwordMethod).not.toContainText("O'rnatilmagan");
  await expect(passwordMethod.getByLabel("Yoqilgan")).toBeVisible();
  const set = await sql<{ after_data: Record<string, unknown> }>("select after_data from public.audit_logs where created_at >= $1 and action = 'admin.login_credentials_set'", [started]);
  expect(set).toHaveLength(1);
  // parol auditga yozilmaydi
  expect(JSON.stringify(set[0]!.after_data)).not.toContain(PASSWORD);

  // keyingi safar: email + parol (noto'g'ri — umumiy xato), to'g'ri → baribir kod sahifasi
  await asGuest(context);
  await page.goto("/auth/admin?next=/admin");
  await signIn(page, OWNER_EMAIL, "noto'g'ri parol 123");
  await expect(page.getByRole("alert").filter({ hasText: "Email yoki parol noto'g'ri" })).toBeVisible();
  expect(await sessionCookie(page)).toBeUndefined();
  await page.getByLabel("Parol", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Kirish", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/mfa$/);
  await expect(page.getByRole("heading", { name: "Ikki bosqichli kirish" })).toBeVisible();
  const events = await sql<{ event_type: string }>("select event_type from public.security_events where created_at >= $1 and event_type like 'auth.admin_%' order by created_at", [started]);
  expect(events.map((e) => e.event_type)).toEqual(expect.arrayContaining(["auth.admin_link_sent", "auth.admin_password_failed", "auth.admin_password_login"]));
});

test("parol yo'li faqat faol admin uchun: oddiy hisob yoki o'chirilgan admin — umumiy xato, sessiya yopiladi", async ({ page, context }) => {
  await setAuthPassword(USERS.workerA, "worker@e2e.uz", PASSWORD);
  await setAuthPassword(USERS.workerB, OWNER_EMAIL, PASSWORD);
  await sql("update public.admin_users set is_active = false where profile_id = $1", [USERS.workerB]);
  for (const email of ["worker@e2e.uz", OWNER_EMAIL]) {
    await asGuest(context);
    await page.goto("/auth/admin");
    await signIn(page, email, PASSWORD);
    await expect(page.getByRole("alert").filter({ hasText: "Email yoki parol noto'g'ri" })).toBeVisible();
    expect(await sessionCookie(page)).toBeUndefined();
  }
  // oddiy kirish ekranida bu yo'l ko'rinmaydi
  await page.goto("/auth");
  await expect(page.getByRole("link", { name: /Telefon raqam/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Email va parol/ })).toHaveCount(0);
});

test("havola so'rash: begona email — bir xil javob, xat yo'q; eskirgan havola — yangisini so'rash", async ({ page, context }) => {
  const [{ started }] = (await sql<{ started: string }>("select now()::text as started")) as [{ started: string }];
  await asGuest(context);
  await page.goto("/auth/admin/tiklash");
  await page.getByLabel("Email", { exact: true }).fill("begona@e2e.uz");
  await page.getByRole("button", { name: "Havola yuborish" }).click();
  await expect(page.getByRole("heading", { name: "Emailingizni tekshiring" })).toBeVisible();
  expect(await mailLink("begona@e2e.uz")).toBeNull();
  const [owner] = await sql<{ n: number }>("select count(*)::int as n from public.audit_logs where action = 'admin.owner_email_attach' and created_at >= $1", [started]);
  expect(owner!.n).toBe(0);

  await page.goto("/auth/admin/havola#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired");
  await expect(page.getByText("Havola eskirgan yoki allaqachon ishlatilgan")).toBeVisible();
  await page.getByRole("link", { name: "Yangi havola so'rash" }).click();
  await expect(page).toHaveURL(/\/auth\/admin\/tiklash$/);
});

test("havola sayt boshiga tushsa (Supabase Site URL) ham — o'z sahifasiga, keyin kod sahifasiga", async ({ page, context }) => {
  await setAuthPassword(USERS.workerB, OWNER_EMAIL, PASSWORD);
  await asGuest(context);
  await page.goto("/auth/admin/tiklash");
  await page.getByLabel("Email", { exact: true }).fill(OWNER_EMAIL);
  await page.getByRole("button", { name: "Havola yuborish" }).click();
  await expect(page.getByRole("heading", { name: "Emailingizni tekshiring" })).toBeVisible();
  const link = await mailLink(OWNER_EMAIL);
  expect(link).toBeTruthy();
  await page.goto(`/${link!.slice(link!.indexOf("#"))}`);
  await expect(page).toHaveURL(/\/admin\/mfa\?next=/);
  await expect(page.getByRole("heading", { name: "Ikki bosqichli kirish" })).toBeVisible();
});
