import { expect, test } from "@playwright/test";
import { USERS, loginAs, sql, stack } from "../support";

/**
 * Haftalik raqamlar (#263): admin bosh sahifasida o'tgan hafta va undan oldingi hafta yonma-yon; har dushanba 09:00 da
 * (Vercel Cron) adminlarga bildirishnoma — saytda va Telegram'da. Faqat sonlar, shaxsiy ma'lumot yo'q.
 * To'lovlar faqat sinov foydalanuvchilarida bo'ladi (boshqa speclar o'zinikini tozalaydi) — tushum va TOP raqamlari aniq.
 */

const PEOPLE = Object.values(USERS);
// o'tgan haftaning seshanbasi va undan oldingi haftaning seshanbasi, 12:00 Toshkent
const LAST_WEEK = "(date_trunc('week', now() at time zone 'Asia/Tashkent') - interval '6 days' + interval '12 hours') at time zone 'Asia/Tashkent'";
const WEEK_BEFORE = "(date_trunc('week', now() at time zone 'Asia/Tashkent') - interval '13 days' + interval '12 hours') at time zone 'Asia/Tashkent'";

async function cleanup() {
  await sql("delete from public.payments where profile_id = any($1)", [PEOPLE]);
  await sql("delete from public.notifications where dedupe_key like 'weekly:%'");
}

test.beforeEach(async () => {
  await cleanup();
  await sql(
    `insert into public.admin_users (profile_id, role, permissions, is_active) values ($1, 'super_admin', '{}', true)
     on conflict (profile_id) do update set is_active = true, role = 'super_admin'`,
    [USERS.workerB],
  );
});
test.afterEach(async () => {
  await cleanup();
  await sql("delete from public.admin_users where profile_id = $1", [USERS.workerB]);
});

test("bosh sahifa: o'tgan hafta va undan oldingi — tushum, TOP oluvchilar, qayta to'laganlar", async ({ page, context }) => {
  // o'tgan hafta: Tezkor 49 000 (Payme); undan oldin: Maksimal 99 000 (Click) — o'sha ish beruvchi, ya'ni qayta to'lagan
  await sql(
    `insert into public.payments (profile_id, purpose, plan, amount, status, provider, paid_at) values
       ($1, 'vacancy_publish', 'boost', 49000, 'paid', 'payme', ${LAST_WEEK}),
       ($1, 'vacancy_publish', 'max', 99000, 'paid', 'click', ${WEEK_BEFORE})`,
    [USERS.employer],
  );
  await loginAs(context, USERS.workerB, "aal2");
  await page.goto("/admin");
  const card = page.locator("[data-weekly-card]");
  await expect(card.getByRole("heading", { name: "Haftalik raqamlar" })).toBeVisible();
  await expect(card.locator("[data-weekly-period]")).toHaveText(/^\d{1,2}-\p{L}+ – \d{1,2}-\p{L}+$/u);
  const row = (key: string) => card.locator(`[data-weekly-row="${key}"]`);
  await expect(row("revenue").locator("td").nth(1)).toHaveText("49 000 so'm");
  await expect(row("revenue").locator("td").nth(2)).toHaveText("99 000 so'm");
  await expect(row("topBuyers").locator("td").nth(1)).toHaveText("1");
  await expect(row("topBuyers").locator("td").nth(2)).toHaveText("1");
  await expect(row("repeatBuyers").locator("td").nth(1)).toHaveText("1");
  for (const key of ["employers", "vacancies", "applications", "visitors", "per_vacancy"]) await expect(row(key)).toBeVisible();
  // tushum kamaydi — pastga strelka
  await expect(row("revenue").getByLabel("kamaydi")).toBeVisible();
});

test("cron: secret'siz 401; qo'lda (force) — har admin'ga bitta bildirishnoma, takrorlanmaydi", async ({ request, page, context }) => {
  const url = `${stack.app}/api/cron/weekly-report`;
  expect((await request.get(`${url}?force=1`)).status()).toBe(401);

  const first = await request.get(`${url}?force=1`, { headers: { authorization: "Bearer e2e-cron" } });
  expect(first.status()).toBe(200);
  expect((await first.json()).sent).toBeGreaterThanOrEqual(1);
  const rows = await sql<{ link: string; kind: string; tg_status: string }>(
    "select link, payload->>'kind' as kind, tg_status from public.notifications where profile_id = $1 and dedupe_key like 'weekly:%'",
    [USERS.workerB],
  );
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ link: "/admin", kind: "weekly_report" });

  const again = await request.get(`${url}?force=1`, { headers: { "x-cron-secret": "e2e-cron" } });
  expect(await again.json()).toMatchObject({ ok: true, sent: 0, skipped: "already_sent" });

  // bildirishnomalar sahifasida — sarlavha va qatorlar
  await loginAs(context, USERS.workerB, "aal2");
  await page.goto("/notifications");
  await expect(page.getByText(/^Haftalik raqamlar: \d{1,2}-/).first()).toBeVisible();
  await expect(page.getByText(/Yangi ish beruvchilar: \d+/).first()).toBeVisible();
});
