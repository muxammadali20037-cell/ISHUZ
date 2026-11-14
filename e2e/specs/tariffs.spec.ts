import { expect, test } from "@playwright/test";
import { USERS, asGuest, asMode, loginAs, sql } from "../support";

/**
 * Tariflar (0080; ega, 2026-11-14: "tarif ko'tarilgan sari imkoniyatlar kengayib borsin, narxni baland qo'yma"):
 * ochiq "Tariflar" sahifasi (bazadagi narxlar, e'lon bepul bo'lsa — Oddiy "Bepul"); bepul joylangan faol vakansiyani
 * "TOP qilish" — Tezkor/Maksimal, balansdan bir bosishda → qidiruvda TOP; ishchi e'loni Maksimal → TOP va AI PRO.
 */

const PEOPLE = [USERS.employer, USERS.workerA];

async function cleanup() {
  await sql("delete from public.wallet_ledger where profile_id = any($1)", [PEOPLE]);
  await sql("delete from public.wallets where profile_id = any($1)", [PEOPLE]);
  await sql("delete from public.payments where profile_id = any($1)", [PEOPLE]);
  await sql("delete from public.vacancies where owner_profile_id = $1 and title like 'T80 %'", [USERS.employer]);
  await sql("delete from public.ai_alert_subscriptions where profile_id = any($1)", [PEOPLE]);
  await sql("delete from public.rate_limits where key like any($1)", [PEOPLE.map((u) => `%${u}%`)]);
}

test.beforeEach(async () => {
  // prod holati: e'lon joylash bepul, tariflar yoqilgan
  await sql("update public.app_settings set value = 'false'::jsonb where key = 'listings_paid'");
  await cleanup();
});
test.afterEach(cleanup);

test("ochiq 'Tariflar': ish beruvchi va ish izlovchi uchun 3 darajadan; narx o'sib boradi; e'lon bepul — Oddiy 'Bepul'", async ({ page, context }) => {
  await asGuest(context);
  await page.goto("/pricing");
  await expect(page.getByRole("heading", { level: 1, name: "Tariflar" })).toBeVisible();
  for (const kind of ["vacancy", "worker"]) {
    await expect(page.locator(`[data-tariff^="${kind}-"]`)).toHaveCount(3);
    await expect(page.locator(`[data-tariff="${kind}-basic"]`)).toContainText("Bepul");
  }
  await expect(page.locator('[data-tariff="vacancy-max"]')).toContainText("99 000 so'm");
  await expect(page.locator('[data-tariff="vacancy-max"]')).toContainText("10 kun qidiruvda eng tepada");
  await expect(page.locator('[data-tariff="worker-max"]')).toContainText("AI PRO");
  // narxlar — bazadagi bilan bir xil (soxta raqam yo'q)
  const [t] = await sql<{ j: { vacancy: { price: number }[] } }>("select public.public_tariffs() as j");
  expect(t!.j.vacancy.map((x) => x.price)).toEqual([30000, 49000, 99000]);
});

test("bepul joylangan faol vakansiya: 'TOP qilish' → Maksimal, balansdan → qidiruvda birinchi, 'TOP · … gacha'", async ({ page, context }) => {
  test.setTimeout(90_000);
  const [r] = await sql<{ id: string }>("select id from public.regions where slug = 'tashkent_city'");
  const [c] = await sql<{ id: string }>("select id from public.categories where is_active order by sort_order limit 1");
  const [v] = await sql<{ id: string }>(
    `insert into public.vacancies (owner_profile_id, title, category_id, region_id, description, status, salary_negotiable, published_at, expires_at, paid_until)
     values ($1, 'T80 Kassir', $2, $3, 'Kassada ishlash', 'active', true, now(), now() + interval '10 days', now() + interval '10 days') returning id`,
    [USERS.employer, c!.id, r!.id],
  );
  await sql("insert into public.wallets (profile_id, balance) values ($1, 200000)", [USERS.employer]);
  await loginAs(context, USERS.employer);
  await asMode(context, "employer");
  await page.goto(`/employer/vacancies/${v!.id}`);
  await page.locator("[data-boost]").click();
  const dialog = page.getByRole("dialog", { name: "TOP qilish" });
  const tiers = dialog.locator("[data-tiers] [data-tier]");
  // faol e'lon — faqat kuchaytirish: Tezkor va Maksimal (Oddiy yo'q)
  await expect(tiers).toHaveCount(2);
  await dialog.locator('[data-tier="max"]').click();
  // birinchi to'lov chegirmasi: 99 000 → 49 500
  await expect(dialog.getByTestId("checkout-price")).toHaveText("49 500 so'm");
  await expect(dialog.getByText("10 kun qidiruvda eng tepada")).toBeVisible();
  await dialog.getByRole("button", { name: /Balansdan to'lash · 49 500 so'm/ }).click();
  await page.waitForURL(/\/billing\/return\?order=\d+/);
  const [after] = await sql<{ featured: boolean; days: number; plan: string; amount: number }>(
    `select v.is_featured and v.featured_until > now() + interval '9 days' as featured,
            round(extract(epoch from v.paid_until - now()) / 86400)::int as days, p.plan, p.amount::int as amount
       from public.vacancies v join public.payments p on p.vacancy_id = v.id where v.id = $1`,
    [v!.id],
  );
  expect(after).toMatchObject({ featured: true, plan: "max", amount: 49500 });
  expect(after!.days).toBeGreaterThanOrEqual(39); // 10 kun (bepul) + 30 kun
  await page.goto(`/employer/vacancies/${v!.id}`);
  await expect(page.locator("[data-featured]")).toContainText("TOP");
});

test("ishchi e'loni: 'E'lonimni TOP qilish' → Maksimal — 7 kun TOP va 30 kun AI PRO", async ({ page, context }) => {
  test.setTimeout(90_000);
  const [r] = await sql<{ id: string }>("select id from public.regions where slug = 'tashkent_city'");
  const [node] = await sql<{ id: string }>("select id from public.profession_nodes where selectable and is_active and name_uz = 'Sotuvchi' limit 1");
  await sql("delete from public.worker_profiles where profile_id = $1", [USERS.workerA]);
  await sql(
    `insert into public.worker_profiles (profile_id, headline, region_id, profession_node_id, experience_level, onboarding_completed_at, is_public, listed_until)
     values ($1, 'Sotuvchi', $2, $3, '1_2y', now(), true, now() + interval '10 days')`,
    [USERS.workerA, r!.id, node!.id],
  );
  await sql("insert into public.wallets (profile_id, balance) values ($1, 50000)", [USERS.workerA]);
  try {
    await loginAs(context, USERS.workerA);
    await asMode(context, "worker");
    await page.goto("/profile/listing");
    await page.locator("[data-boost]").click();
    const dialog = page.getByRole("dialog", { name: "TOP qilish" });
    await dialog.locator('[data-tier="max"]').click();
    await expect(dialog.getByTestId("checkout-price")).toHaveText("9 500 so'm");
    await expect(dialog.getByText("30 kun AI PRO")).toBeVisible();
    await dialog.getByRole("button", { name: /Balansdan to'lash · 9 500 so'm/ }).click();
    await page.waitForURL(/\/billing\/return\?order=\d+/);
    const [w] = await sql<{ top: boolean; ai: boolean }>(
      `select w.promoted_until > now() + interval '6 days' as top,
              exists (select 1 from public.ai_alert_subscriptions a where a.profile_id = w.profile_id and a.paid_until > now() + interval '29 days') as ai
         from public.worker_profiles w where w.profile_id = $1`,
      [USERS.workerA],
    );
    expect(w).toEqual({ top: true, ai: true });
  } finally {
    await sql("delete from public.worker_profiles where profile_id = $1", [USERS.workerA]);
  }
});
