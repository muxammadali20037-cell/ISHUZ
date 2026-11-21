import { expect, test, type Page } from "@playwright/test";
import { USERS, asGuest, asMode, sql } from "../support";

/**
 * Telegram birinchi o'rinda (ega, 2026-11-18): kanal postidagi tugma t.me/<bot>?startapp=… bilan Mini App'ni ochadi —
 * ilova kerakli sahifaga (vakansiyaga) o'zi o'tadi. Faqat ichki yo'l (tashqi manzilga yo'naltirib bo'lmaydi). Kanal oynasidagi
 * "Kanalga o'tish" Mini App ichida Telegram'ning o'zida ochiladi (openTelegramLink). Telegram muhiti (window.Telegram.WebApp) taqlid qilinadi.
 */

async function miniApp(page: Page, startParam: string | null) {
  await page.route("**/api/auth/telegram", (r) => r.fulfill({ status: 401, json: { error: "invalid" } }));
  await page.addInitScript((startParam) => {
    const noop = () => {};
    const opened: string[] = [];
    (window as unknown as { __opened: string[] }).__opened = opened;
    (window as unknown as { Telegram: unknown }).Telegram = {
      WebApp: {
        initData: "query_id=AAE&user=%7B%22id%22%3A42%2C%22first_name%22%3A%22Botir%22%7D&auth_date=1760000000&hash=test",
        initDataUnsafe: { user: { id: 42, first_name: "Botir" }, ...(startParam ? { start_param: startParam } : {}) },
        colorScheme: "light",
        themeParams: {},
        platform: "android",
        version: "7.0",
        ready: noop,
        expand: noop,
        close: noop,
        BackButton: { show: noop, hide: noop, onClick: noop, offClick: noop, isVisible: false },
        MainButton: { show: noop, hide: noop, setText: noop, onClick: noop, offClick: noop, showProgress: noop, hideProgress: noop, enable: noop, disable: noop },
        openTelegramLink: (u: string) => opened.push(u),
        openLink: noop,
      },
    };
  }, startParam);
}

test.beforeEach(async ({ context }) => {
  await asGuest(context);
  await asMode(context, "worker");
});

test("startapp=j_<slug> — ilova vakansiya sahifasida ochiladi", async ({ page }) => {
  const [v] = await sql<{ slug: string }>(
    `insert into public.vacancies (owner_profile_id, title, region_id, description, status, salary_negotiable, published_at, expires_at)
     select $1, 'Oshpaz (startapp)', r.id, 'Milliy taomlar oshxonasiga oshpaz kerak.', 'active', true, now(), now() + interval '20 days'
     from public.regions r where r.slug = 'tashkent_city' returning slug`,
    [USERS.employer],
  );
  test.info().annotations.push({ type: "slug", description: v!.slug });
  await miniApp(page, `j_${v!.slug}`);
  await page.goto("/");
  await expect(page).toHaveURL(new RegExp(`/jobs/${v!.slug}$`));
  // orqaga qaytilganda qayta o'tmaydi (bir ochilishda bir marta)
  await page.goto("/");
  await page.waitForTimeout(800);
  await expect(page).toHaveURL(/\/$/);
  await sql("delete from public.vacancies where slug = $1", [v!.slug]);
});

test("xavfli start_param — bosh sahifada qoladi", async ({ page }) => {
  await miniApp(page, "p_" + Buffer.from("//evil.example/x").toString("base64url"));
  await page.goto("/");
  // bosh sahifa — chat (2026-11-21)
  await expect(page.locator("main [data-start-chat]")).toBeVisible();
  await page.waitForTimeout(800);
  await expect(page).toHaveURL(/localhost:\d+\/$/);
});

test("kanal oynasi Mini App ichida: «Kanalga o'tish» — kanal Telegram'ning o'zida ochiladi", async ({ page, context }) => {
  // 2026-11-21: chatda kanal qatori yo'q — kirgandan keyin oyna chiqadi (ega: "Obuna bo'lish yoki Keyinroq")
  const keep = (await context.cookies()).filter((c) => c.name !== "ib_channel");
  await context.clearCookies();
  await context.addCookies(keep);
  await miniApp(page, null);
  await page.goto("/");
  const prompt = page.locator("[data-channel-prompt]");
  await expect(prompt).toBeVisible({ timeout: 10_000 });
  await prompt.getByRole("button", { name: "Kanalga o'tish" }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __opened: string[] }).__opened)).toEqual(["https://t.me/ish_topdim_uz"]);
  await expect(page).toHaveURL(/localhost:\d+\/$/);
});
