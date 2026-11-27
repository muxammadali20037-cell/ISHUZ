import { expect, test } from "@playwright/test";
import { USERS, loginAs, sql } from "../support";

/**
 * Admin "To'lovlar" — kunlik daromad hisoboti (ega, 2026-11-27: "admin panelda kunlik daromad va to'lovlar hisoboti").
 * Payme/Click tushumi to'langan kuni, qaytarilgan — qaytarilgan kuni ayriladi, hamyondan to'lov sanalmaydi.
 * To'lovlar faqat sinov foydalanuvchilarida bo'ladi (boshqa speclar ham o'zinikini tozalaydi) — raqamlar aniq.
 */

const PEOPLE = Object.values(USERS);

async function cleanup() {
  await sql("delete from public.wallet_ledger where profile_id = any($1)", [PEOPLE]);
  await sql("delete from public.wallets where profile_id = any($1)", [PEOPLE]);
  await sql("delete from public.payments where profile_id = any($1)", [PEOPLE]);
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

test("7 kun: sof tushum, to'lovlar soni, bugun, tizim va maqsad bo'yicha; qaytarilgan ayriladi", async ({ page, context }) => {
  // bugun Click 100 000; 2 kun oldin Payme 50 000; 3 kun oldin Payme 20 000 — bugun qaytarilgan
  await sql(
    `insert into public.payments (profile_id, purpose, amount, status, provider, paid_at, cancelled_at) values
       ($1, 'wallet_topup', 100000, 'paid', 'click', now() - interval '1 minute', null),
       ($1, 'wallet_topup', 50000, 'paid', 'payme', now() - interval '2 days', null),
       ($1, 'wallet_topup', 20000, 'cancelled', 'payme', now() - interval '3 days', now() - interval '1 minute'),
       ($1, 'wallet_topup', 30000, 'pending', 'payme', null, null)`,
    [USERS.employer],
  );
  await loginAs(context, USERS.workerB, "aal2");
  await page.goto("/admin/payments?days=7");
  const report = page.locator("[data-revenue-report]");
  await expect(report.getByRole("heading", { name: "Daromad hisoboti" })).toBeVisible();
  await expect(report.locator('[data-revenue-stat="net"]')).toContainText("150 000 so'm");
  await expect(report.locator('[data-revenue-stat="net"]')).toContainText("Qaytarilgan: 20 000 so'm");
  await expect(report.locator('[data-revenue-stat="count"]')).toContainText("3");
  await expect(report.locator('[data-revenue-stat="count"]')).toContainText("Yana 1 ta kutilmoqda");
  await expect(report.locator('[data-revenue-stat="today"]')).toContainText("80 000 so'm");
  await expect(report.locator('[data-revenue-by="provider"]')).toContainText("Click · 1 marta");
  await expect(report.locator('[data-revenue-by="provider"]')).toContainText("Payme · 2 marta");
  await expect(report.locator('[data-revenue-by="purpose"]')).toContainText("Hamyonni to'ldirish · 3 marta");
  await expect(report.locator('[data-revenue-by="purpose"]')).toContainText("170 000 so'm");
  // kunlar jadvali — faqat to'lov bo'lgan kunlar (3 ta)
  await expect(report.locator("[data-revenue-day]")).toHaveCount(3);
  // oxirgi to'lovlar ro'yxati ham joyida
  await expect(page.getByRole("heading", { name: "Oxirgi to'lovlar" })).toBeVisible();
});

test("to'lov bo'lmagan davr — bo'sh holat, xato yo'q", async ({ page, context }) => {
  await loginAs(context, USERS.workerB, "aal2");
  await page.goto("/admin/payments?days=30");
  const report = page.locator("[data-revenue-report]");
  await expect(report.locator('[data-revenue-stat="net"]')).toContainText("0 so'm");
  await expect(report.locator("[data-revenue-days]")).toContainText("Oxirgi 30 kunda to'lov bo'lmagan.");
  await expect(report.locator('[data-revenue-by="purpose"]')).toContainText("Bu davrda to'lov yo'q");
});
