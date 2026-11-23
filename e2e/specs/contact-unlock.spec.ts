import { expect, test } from "@playwright/test";
import { USERS, asGuest, asMode, loginAs, sql, stack } from "../support";

/**
 * Master prompt, 4-bosqich (ega, 2026-11-22): ishchi raqamini ochish — A varianti (narx tugmaning o'zida).
 *  · bepul davr (Payme/Click ulanmaguncha): "Raqamni ko'rsatish" → raqam + "Chatda yozish" (juftlik yoziladi, 0 so'm);
 *  · pullik rejim (admin yoqadi): "Raqamni ochish · 5 000 so'm" → to'lov oynasi → hamyondan → raqam va chat shu sahifada;
 *    mehmonga — avval kirish (shu e'longa qaytadi), sahifada raqam yo'q.
 */
const PROF = "Elektrik (raqam ochish testi)";

async function workerId(): Promise<string> {
  const [w] = await sql<{ id: string }>("select id from public.worker_profiles where profile_id = $1 and is_primary", [USERS.workerA]);
  return w!.id;
}

async function cleanup() {
  await sql("update public.app_settings set value = 'false'::jsonb where key = 'contact_unlock_paid'");
  await sql("delete from public.conversations where unlock_target = $1", [USERS.workerA]);
  await sql("delete from public.contact_unlocks where target_profile_id = $1", [USERS.workerA]);
  await sql("delete from public.contact_reveals where target_kind = 'worker' and viewer_profile_id in ($1, $2)", [USERS.employer, USERS.workerB]);
  await sql("delete from public.wallet_ledger where profile_id = $1", [USERS.workerB]);
  await sql("delete from public.wallets where profile_id = $1", [USERS.workerB]);
  await sql("delete from public.payments where profile_id = $1 and purpose::text = 'contact_unlock'", [USERS.workerB]);
}

test.beforeEach(async () => {
  await cleanup();
  await sql("update public.app_settings set value = 'false'::jsonb where key in ('moderation_enabled', 'employer_verification_required', 'listings_paid')");
  await sql(
    `insert into public.worker_profiles (profile_id, headline, custom_profession, region_id, category_id, experience_level, is_public, status, onboarding_completed_at)
     select $1, $2, $2, r.id, (select id from public.categories limit 1), '3_5y', true, 'active', now() from public.regions r where r.slug = 'tashkent_city'
     on conflict (profile_id) where is_primary do update set headline = excluded.headline, custom_profession = excluded.custom_profession, status = 'active', is_public = true, onboarding_completed_at = now()`,
    [USERS.workerA, PROF],
  );
  await sql(
    `insert into public.worker_listing_phones (worker_id, phone) select id, '+998935550011' from public.worker_profiles where profile_id = $1 and is_primary
     on conflict (worker_id) do update set phone = excluded.phone, phone2 = null`,
    [USERS.workerA],
  );
  await sql("update public.worker_profiles set is_public = true where profile_id = $1 and is_primary", [USERS.workerA]);
});
test.afterEach(cleanup);

test("bepul davr: «Raqamni ko'rsatish» → raqam va «Chatda yozish» (juftlik 0 so'mga yoziladi), qayta kirganda — darhol ochiq", async ({ page, context }) => {
  await loginAs(context, USERS.employer);
  await asMode(context, "employer");
  const id = await workerId();
  await page.goto(`/listing/${id}`);
  const contact = page.locator("#contact");
  await expect(contact.locator("a[href^='tel:']")).toHaveCount(0);
  await expect(contact.locator("[data-unlock-button]")).toHaveCount(0);
  await contact.getByRole("button", { name: "Raqamni ko'rsatish" }).click();
  await expect(contact.locator("[data-revealed-phone] a[href='tel:+998935550011']").first()).toBeVisible();
  const [u] = await sql<{ amount: string }>("select amount from public.contact_unlocks where viewer_profile_id = $1 and target_profile_id = $2", [USERS.employer, USERS.workerA]);
  expect(Number(u!.amount)).toBe(0);

  // sahifa qayta ochilsa — raqam va chat darhol (tugmasiz)
  await page.reload();
  await expect(contact.locator("a[href='tel:+998935550011']").first()).toBeVisible();
  await contact.getByRole("button", { name: "Chatda yozish" }).click();
  await expect(page).toHaveURL(/\/messages\/[0-9a-f-]{36}$/);
  // ega (2026-11-23): e'lon suhbat tepasida qadalgan; yozish maydonida "Assalomu alaykum"dan boshlanadigan tayyor rasmiy xat
  const pinned = page.locator("[data-pinned-listing='worker']");
  await expect(pinned).toContainText("Qadalgan e'lon");
  await expect(pinned.locator("[data-pinned-title]")).toHaveText(PROF);
  await expect(pinned).toContainText("Toshkent shahri");
  await expect(pinned.locator("a")).toHaveAttribute("href", `/listing/${id}`);
  const draft = page.locator("textarea");
  await expect(draft).toHaveValue(
    `Assalomu alaykum, Anvar! «${PROF}» e'loningizni Ish topdim platformasida ko'rdim. Sizni bizga kerakli xodim deb o'yladim. Agar taklifimiz sizni qiziqtirsa, qulay vaqtda gaplashib olsak. Javobingizni kutaman.`,
  );
  // bir bosishda yuboriladi; keyingi ochilishda tayyor xat qaytmaydi (allaqachon yozilgan)
  await page.getByRole("button", { name: "Yuborish" }).click();
  await expect(draft).toHaveValue("");
  await expect(page.locator("[data-chat-messages]").getByText("Sizni bizga kerakli xodim deb o'yladim", { exact: false })).toBeVisible();
  await page.reload();
  await expect(page.locator("textarea")).toHaveValue("");
  await expect(page.locator("[data-pinned-listing='worker']")).toBeVisible();
});

test("pullik rejim: «Raqamni ochish · 5 000 so'm» → hamyondan to'lash → raqam va chat shu sahifada; mehmonga — kirish", async ({ page, context, browser }) => {
  await sql("update public.app_settings set value = 'true'::jsonb where key = 'contact_unlock_paid'");
  await sql("insert into public.wallets (profile_id, balance) values ($1, 12000) on conflict (profile_id) do update set balance = 12000", [USERS.workerB]);
  const id = await workerId();

  // mehmon: narx tugmada, bosilsa — kirish (shu e'longa qaytadi); sahifada raqam yo'q
  const guest = await browser.newContext({ baseURL: stack.app });
  await asGuest(guest);
  const gp = await guest.newPage();
  await gp.goto(`/listing/${id}`);
  const gButton = gp.locator("#contact [data-unlock-button]");
  await expect(gButton).toContainText("Raqamni ochish");
  await expect(gButton).toContainText("5 000");
  await expect(gButton).toHaveAttribute("href", `/auth?next=${encodeURIComponent(`/listing/${id}`)}`);
  await expect(gp.locator("body")).not.toContainText("93 555 00 11");
  await guest.close();

  await loginAs(context, USERS.workerB);
  await asMode(context, "employer");
  await page.goto(`/listing/${id}`);
  const contact = page.locator("#contact");
  await expect(contact.locator("a[href^='tel:']")).toHaveCount(0);
  await contact.locator("[data-unlock-button]").click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByText("Raqamni ochish")).toBeVisible();
  await expect(sheet.getByTestId("checkout-price")).toContainText("5 000");
  await sheet.getByRole("button", { name: /Balansdan to'lash/ }).click();
  await expect(sheet).toBeHidden();
  // sahifa yangilanadi: raqam (qo'ng'iroq) va chat — shu yerning o'zida
  await expect(contact.locator("a[href='tel:+998935550011']").first()).toBeVisible();
  await expect(contact.getByRole("button", { name: "Chatda yozish" })).toBeVisible();

  const [w] = await sql<{ balance: string }>("select balance from public.wallets where profile_id = $1", [USERS.workerB]);
  expect(Number(w!.balance)).toBe(7000);
  const [u] = await sql<{ amount: string }>("select amount from public.contact_unlocks where viewer_profile_id = $1 and target_profile_id = $2", [USERS.workerB, USERS.workerA]);
  expect(Number(u!.amount)).toBe(5000);
});
