import { createHash, randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import { USERS, asGuest, asMode, loginAs, sql, stack } from "../support";

/**
 * Ega (2026-11-18):
 *  1) "Hozir ish qidirmoqda" — e'lon tagida qizil qalin (vakansiyada "Hozir ishchi qidirmoqda"), ko'zga tashlansin;
 *  2) telefon raqam hammaga — mehmonga "Raqamni ko'rsatish" tugmasi bilan (0084), e'londa raqam majburiy;
 *  3) Telegram orqali kirish kodsiz: bot "✅ Kirish" → brauzer o'zi kiradi (0085).
 */
const host = new URL(stack.app).hostname;
const VAC = "Sotuvchi (telefon testi)";

async function seed() {
  await sql("update public.app_settings set value = 'false'::jsonb where key in ('moderation_enabled', 'employer_verification_required', 'listings_paid')");
  await sql(
    `insert into public.employer_profiles (profile_id, employer_type, display_name, onboarding_completed_at)
     values ($1, 'person', 'Dilnoza', now()) on conflict (profile_id) do nothing`,
    [USERS.employer],
  );
  await sql(
    `insert into public.vacancies (owner_profile_id, title, region_id, category_id, description, status, salary_negotiable, published_at, expires_at)
     select $1, $2, r.id, (select id from public.categories limit 1), 'Do''konga sotuvchi kerak, tajriba shart emas', 'active', true, now(), now() + interval '10 days'
       from public.regions r where r.slug = 'tashkent_city'`,
    [USERS.employer, VAC],
  );
  // ishchi A — faol, e'londa ikki raqam; ishchi B — "takliflarga ochiq", e'lon raqamisiz, hisob raqami "so'rov bilan"
  for (const [id, headline, status] of [
    [USERS.workerA, "Elektrik", "active"],
    [USERS.workerB, "Santexnik", "open"],
  ] as const) {
    await sql(
      `insert into public.worker_profiles (profile_id, headline, custom_profession, region_id, category_id, experience_level, is_public, status, onboarding_completed_at)
       select $1, $2, $2, r.id, (select id from public.categories limit 1), '3_5y', true, $3, now() from public.regions r where r.slug = 'tashkent_city'
       on conflict (profile_id) where is_primary do update set headline = excluded.headline, custom_profession = excluded.custom_profession, status = excluded.status, is_public = true, onboarding_completed_at = now()`,
      [id, headline, status],
    );
  }
  await sql("update public.worker_profiles set is_public = true where profile_id in ($1, $2)", [USERS.workerA, USERS.workerB]);
  await sql(
    `insert into public.worker_listing_phones (worker_id, phone, phone2) select id, '+998935550011', '+998935550022' from public.worker_profiles where profile_id = $1 and is_primary
     on conflict (worker_id) do update set phone = excluded.phone, phone2 = excluded.phone2`,
    [USERS.workerA],
  );
  await sql("delete from public.worker_listing_phones where worker_id = (select id from public.worker_profiles where profile_id = $1 and is_primary)", [USERS.workerB]);
  await sql("update public.profile_contacts set phone_visibility = 'on_request' where profile_id = $1", [USERS.workerB]);
}

let visibility: string | null = null;
test.beforeEach(async () => {
  const [pc] = await sql<{ v: string }>("select phone_visibility::text as v from public.profile_contacts where profile_id = $1", [USERS.workerB]);
  visibility = pc?.v ?? null;
  await seed();
});
test.afterEach(async () => {
  await sql("delete from public.vacancies where owner_profile_id = $1 and title = $2", [USERS.employer, VAC]);
  await sql("delete from public.worker_profiles where profile_id in ($1, $2) and headline in ('Elektrik', 'Santexnik')", [USERS.workerA, USERS.workerB]);
  if (visibility) await sql("update public.profile_contacts set phone_visibility = $2::public.phone_visibility where profile_id = $1", [USERS.workerB, visibility]);
});

test("qizil qalin holat: vakansiyada «Hozir ishchi qidirmoqda», faol ishchida «Hozir ish qidirmoqda» (ochiq holatda — yo'q)", async ({ page, context }) => {
  await asGuest(context);
  await asMode(context, "worker");
  await page.goto("/search?mode=jobs&any=1&region=all");
  const card = page.locator("article", { hasText: VAC });
  const hiring = card.locator("[data-live-status='hiring']");
  await expect(hiring).toHaveText("Hozir ishchi qidirmoqda");
  const style = await hiring.evaluate((el) => ({ color: getComputedStyle(el).color, weight: Number(getComputedStyle(el).fontWeight) }));
  expect(style.color).toBe("rgb(198, 47, 62)");
  expect(style.weight).toBeGreaterThanOrEqual(800);

  // vakansiya sahifasida ham — sarlavha tagida
  await card.getByRole("link", { name: VAC }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(VAC);
  await expect(page.getByRole("main").locator("[data-live-status='hiring']").first()).toBeVisible();

  await asMode(context, "employer");
  await page.goto("/search?mode=workers&any=1&region=all");
  const active = page.locator("article", { hasText: "Elektrik" });
  await expect(active.locator("[data-live-status='seeking']")).toHaveText("Hozir ish qidirmoqda");
  await expect(page.locator("article", { hasText: "Santexnik" }).locator("[data-live-status]")).toHaveCount(0);
});

test("mehmon: «Raqamni ko'rsatish» — e'londagi raqamlar; raqam yo'q bo'lsa — shuni aytadi; sahifada oldindan raqam yo'q", async ({ page, context }) => {
  await asGuest(context);
  await asMode(context, "employer");
  const [a] = await sql<{ id: string }>("select id from public.worker_profiles where profile_id = $1 and is_primary", [USERS.workerA]);
  await page.goto(`/listing/${a!.id}`);
  const contact = page.locator("#contact");
  await expect(contact.locator("a[href^='tel:']")).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText("93 555 00 11");
  await contact.getByRole("button", { name: "Raqamni ko'rsatish" }).click();
  const shown = contact.locator("[data-revealed-phone]");
  await expect(shown.locator("a[href='tel:+998935550011']")).toHaveCount(2); // tugma + raqamning o'zi
  await expect(shown.locator("a[href='tel:+998935550022']")).toBeVisible();

  const [b] = await sql<{ id: string }>("select id from public.worker_profiles where profile_id = $1 and is_primary", [USERS.workerB]);
  await page.goto(`/listing/${b!.id}`);
  await page.locator("#contact").getByRole("button", { name: "Raqamni ko'rsatish" }).click();
  const none = page.locator("#contact [data-reveal-error='none']");
  await expect(none).toContainText("Bu e'londa ochiq raqam yo'q");
  // 4-bosqich: ariza va raqam so'rovi yo'q — kirish ham yordam bermaydi, shuning uchun taklif qilinmaydi
  await expect(none.getByRole("link", { name: "Kirish" })).toHaveCount(0);
});

test("Telegram orqali kodsiz kirish: bot tasdiqlagach — o'sha brauzer kiradi; boshqa brauzer va qayta ishlatish — yo'q", async ({ page, context, browser }) => {
  await asGuest(context);
  const sha = (s: string) => createHash("sha256").update(s).digest("hex");
  const token = randomBytes(32).toString("base64url");
  const nonce = randomBytes(32).toString("base64url");
  const [row] = await sql<{ id: string }>("select public.telegram_web_login_create($1, $2, 'Chrome · Android') as id", [sha(token), sha(nonce)]);
  await context.addCookies([{ name: "ib_tgweb", value: `${row!.id}.${nonce}`, domain: host, path: "/api/auth/telegram-web" }]);
  const status = async (req = page.request) => (await (await req.post("/api/auth/telegram-web/status", { headers: { origin: stack.app }, data: {} })).json()) as { status: string };

  expect(await status()).toEqual({ status: "pending" });
  // bot: "✅ Kirish" (webhook shu funksiyani chaqiradi)
  await sql("select public.telegram_web_login_confirm($1, 777000111, $2)", [row!.id, USERS.workerA]);

  // havola boshqa qurilmaga o'tib qolsa ham — sessiyani faqat so'rovni boshlagan brauzer oladi
  const other = await browser.newContext({ baseURL: stack.app });
  await other.addCookies([{ name: "ib_tgweb", value: `${row!.id}.${randomBytes(32).toString("base64url")}`, domain: host, path: "/api/auth/telegram-web" }]);
  expect(await status(other.request)).toEqual({ status: "invalid" });
  await other.close();

  expect(await status()).toEqual({ status: "ok" });
  await page.goto("/cabinet");
  await expect(page).toHaveURL(/\/cabinet/);
  await expect(page.getByRole("link", { name: "Kirish" })).toHaveCount(0);
  // bir martalik: cookie o'chirilgan, so'rov ishlatilgan
  expect((await context.cookies()).some((c) => c.name === "ib_tgweb" && c.value)).toBe(false);
  const [used] = await sql<{ consumed: boolean }>("select consumed_at is not null as consumed from public.telegram_web_logins where id = $1", [row!.id]);
  expect(used!.consumed).toBe(true);
});
