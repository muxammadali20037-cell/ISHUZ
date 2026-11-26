import { expect, test, type BrowserContext } from "@playwright/test";
import { asGuest, gatewayUrl, sql } from "../support";

/**
 * Google orqali kirish (ega, 2026-11-26). Stend shlyuzi Supabase OAuth'ni (PKCE) emulyatsiya qiladi: test "Google
 * hisobi"ni beradi, tugma → /authorize → /api/auth/google/callback?code= → sessiya. Haqiqiy Google'ga so'rov ketmaydi.
 */
const EMAIL = "gulnora.google@e2e.uz";

async function googleAccount(identity: Record<string, unknown> | null) {
  await fetch(`${gatewayUrl}/__e2e/google`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ enabled: true, identity }) });
}

async function openLogin(context: BrowserContext) {
  await asGuest(context);
  const page = await context.newPage();
  await page.goto("/auth?role=1&next=%2Fcabinet");
  return page;
}

test.beforeEach(async () => {
  await sql("delete from auth.users where email = $1", [EMAIL]);
  await sql("delete from public.rate_limits where key like 'google:%'");
});

test("yangi foydalanuvchi: Google → hisob yaratiladi (ism Google'dan, rasm olinmaydi, email yopiq); qayta kirish — o'sha hisob", async ({ context }) => {
  await googleAccount({ email: EMAIL, full_name: "Gulnora Karimova", avatar_url: "https://lh3.googleusercontent.com/a/e2e-photo" });
  const page = await openLogin(context);
  const btn = page.locator("[data-google-login]");
  await expect(btn).toHaveText(/Google orqali kirish/);
  await expect(btn).toContainText("Google hisobingiz bilan — kod va parolsiz");
  await btn.click();
  await page.waitForURL((u) => new URL(u).pathname !== "/auth" && !new URL(u).pathname.startsWith("/api/"), { timeout: 20_000 });
  expect(new URL(page.url()).pathname).not.toMatch(/^\/auth/);

  const [u] = await sql<{ id: string; first_name: string; last_name: string; avatar_url: string | null; email: string | null; provider: string }>(
    `select p.id, p.first_name, p.last_name, p.avatar_url, c.email, a.raw_app_meta_data->>'provider' as provider
       from auth.users a join public.profiles p on p.id = a.id left join public.profile_contacts c on c.profile_id = a.id where a.email = $1`,
    [EMAIL],
  );
  expect(u).toMatchObject({ first_name: "Gulnora", last_name: "Karimova", avatar_url: null, email: EMAIL, provider: "google" });
  const [ev] = await sql<{ n: number }>("select count(*)::int as n from public.security_events where event_type = 'auth.google_login' and actor_id = $1", [u!.id]);
  expect(ev!.n).toBe(1);

  // qayta kirish — yangi hisob yaratilmaydi; o'zgartirilgan ism ustidan yozilmaydi
  await sql("update public.profiles set first_name = 'Gulya' where id = $1", [u!.id]);
  await context.clearCookies();
  const again = await openLogin(context);
  await again.locator("[data-google-login]").click();
  await again.waitForURL((x) => new URL(x).pathname === "/cabinet", { timeout: 20_000 });
  const rows = await sql<{ first_name: string }>("select p.first_name from auth.users a join public.profiles p on p.id = a.id where a.email = $1", [EMAIL]);
  expect(rows).toEqual([{ first_name: "Gulya" }]);
});

test("Google'da bekor qilinsa — kirish sahifasiga xabar bilan; bloklangan hisob — /blocked, sessiya ochilmaydi", async ({ context }) => {
  await googleAccount({ email: EMAIL, full_name: "Gulnora Karimova", deny: true });
  const page = await openLogin(context);
  await page.locator("[data-google-login]").click();
  await page.waitForURL(/\/auth\?.*google=failed/);
  await expect(page.locator("[data-google-failed]")).toHaveText("Google orqali kirib bo'lmadi. Qayta urinib ko'ring yoki Telegram orqali kiring.");

  // kod qalbaki yoki boshqa brauzerdan — sessiya ochilmaydi
  const forged = await page.request.get("/api/auth/google/callback?code=deadbeef&next=%2Fcabinet", { maxRedirects: 0 });
  expect(forged.status()).toBe(303);
  expect(forged.headers().location).toContain("google=failed");

  // bloklangan hisob
  await googleAccount({ email: EMAIL, full_name: "Gulnora Karimova" });
  await page.locator("[data-google-login]").click();
  await page.waitForURL((u) => !new URL(u).pathname.startsWith("/auth") && !new URL(u).pathname.startsWith("/api/"), { timeout: 20_000 });
  await sql("update public.profiles set is_blocked = true where id = (select id from auth.users where email = $1)", [EMAIL]);
  await context.clearCookies();
  const p2 = await openLogin(context);
  await p2.locator("[data-google-login]").click();
  await p2.waitForURL(/\/blocked/, { timeout: 20_000 });
  const cookies = await context.cookies();
  expect(cookies.some((c) => /^sb-.*-auth-token/.test(c.name) && c.value.length > 0 && !c.name.endsWith("code-verifier"))).toBe(false);
});

test("o'rnatilgan oynalarda (WebView, Instagram) Google tugmasi chiqmaydi — Google ularda kirishni bloklaydi", async ({ browser }) => {
  for (const ua of [
    "Mozilla/5.0 (Linux; Android 14; SM-A546E; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/131.0 Mobile Safari/537.36",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Instagram 300.0",
  ]) {
    const context = await browser.newContext({ userAgent: ua, baseURL: test.info().project.use.baseURL });
    const page = await openLogin(context);
    await expect(page.getByRole("navigation", { name: "Kirish usuli" }).getByRole("link", { name: /Telefon raqam orqali kirish/ })).toBeVisible();
    await expect(page.locator("[data-google-login]")).toHaveCount(0);
    await context.close();
  }
});
