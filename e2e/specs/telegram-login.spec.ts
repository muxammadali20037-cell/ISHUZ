import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { USERS, asGuest, loginAs } from "../support";

/**
 * D5 · Telegram Mini App: ochilganda kirmagan foydalanuvchi avtomatik kiradi ("Kirish" bosilmaydi), bir marta.
 * Stendda bot kaliti yo'q — Telegram muhiti (window.Telegram.WebApp) taqlid qilinadi, /api/auth/telegram javobi esa
 * test ichida beriladi (haqiqiy initData imzo tekshiruvi — unit: src/lib/telegram/verify.test.ts).
 */

async function asMiniApp(page: Page) {
  await page.addInitScript(() => {
    const noop = () => {};
    (window as unknown as { Telegram: unknown }).Telegram = {
      WebApp: {
        initData: "query_id=AAE&user=%7B%22id%22%3A42%2C%22first_name%22%3A%22Botir%22%7D&auth_date=1760000000&hash=test",
        initDataUnsafe: { user: { id: 42, first_name: "Botir" } },
        colorScheme: "light",
        themeParams: {},
        platform: "android",
        version: "7.10",
        ready: noop,
        expand: noop,
        close: noop,
        BackButton: { show: noop, hide: noop, onClick: noop, offClick: noop, isVisible: false },
        MainButton: { show: noop, hide: noop, setText: noop, onClick: noop, offClick: noop, showProgress: noop, hideProgress: noop, enable: noop, disable: noop },
        openTelegramLink: noop,
        openLink: noop,
      },
    };
  });
}

/** /api/auth/telegram: "ok" — sessiya cookie'si qo'yiladi (haqiqiy server kabi), aks holda berilgan status */
async function telegramApi(page: Page, context: BrowserContext, status: number) {
  const calls: string[] = [];
  await page.route("**/api/auth/telegram", async (route) => {
    calls.push(route.request().postData() ?? "");
    if (status === 200) await loginAs(context, USERS.workerB);
    await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(status === 200 ? { ok: true } : { ok: false, error: "telegram_not_configured" }) });
  });
  return calls;
}

const loginLink = (page: Page) => page.locator("header").getByRole("link", { name: "Kirish" });

test("Mini App ochilganda — avtomatik kiradi, 'Kirish' bosish shart emas; keyingi sahifalarda qayta so'ramaydi", async ({ page, context }) => {
  await asGuest(context);
  await asMiniApp(page);
  const calls = await telegramApi(page, context, 200);
  await page.goto("/");
  await expect(page.getByText("Telegram hisobingiz orqali kirdingiz")).toBeVisible();
  await expect(loginLink(page)).toHaveCount(0);
  expect(calls).toHaveLength(1);
  expect(JSON.parse(calls[0]!)).toMatchObject({ initData: expect.stringContaining("hash=test"), locale: "uz" });
  await page.goto("/search");
  await page.goto("/cabinet");
  await expect(page.getByRole("heading", { level: 1, name: "Kabinetim" })).toBeVisible();
  expect(calls).toHaveLength(1);
});

test("server rad etsa (bot sozlanmagan) — sahifa ishlayveradi, qayta-qayta urinmaydi", async ({ page, context }) => {
  await asGuest(context);
  await asMiniApp(page);
  const calls = await telegramApi(page, context, 503);
  await page.goto("/");
  await expect.poll(() => calls.length).toBe(1);
  await expect(loginLink(page)).toBeVisible();
  await page.goto("/search");
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  expect(calls).toHaveLength(1);
});

test("oddiy brauzerda (Telegram emas) va kirgan foydalanuvchida — so'rov yuborilmaydi", async ({ page, context }) => {
  await asGuest(context);
  const calls = await telegramApi(page, context, 200);
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  expect(calls).toHaveLength(0);
  await expect(loginLink(page)).toBeVisible();

  await loginAs(context, USERS.workerB);
  await asMiniApp(page);
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  expect(calls).toHaveLength(0);
});
