import { expect, test, type Page } from "@playwright/test";
import { asGuest } from "../support";

/**
 * Telegram Mini App haqiqiy ilova kabi: telefonda ochilganda butun ekranni egallaydi (Bot API 8.0 requestFullscreen),
 * pastga surib yopilmaydi (disableVerticalSwipes), Telegram panellari ilova ranglarida, sarlavha va pastki menyu tizim paneli
 * hamda Telegram'ning ✕/⋯ tugmalari ostiga tushmaydi. Telegram muhiti (window.Telegram.WebApp) taqlid qilinadi.
 */

type Calls = { name: string; arg?: string }[];

async function miniApp(page: Page, platform: string, version: string) {
  await page.addInitScript(
    ({ platform, version }) => {
      const calls: { name: string; arg?: string }[] = [];
      const handlers: Record<string, (() => void)[]> = {};
      const noop = () => {};
      const wa = {
        initData: "query_id=AAE&user=%7B%22id%22%3A42%2C%22first_name%22%3A%22Botir%22%7D&auth_date=1760000000&hash=test",
        initDataUnsafe: { user: { id: 42, first_name: "Botir" } },
        colorScheme: "light",
        themeParams: {},
        platform,
        version,
        isFullscreen: false,
        safeAreaInset: { top: 0, bottom: 0, left: 0, right: 0 },
        contentSafeAreaInset: { top: 0, bottom: 0, left: 0, right: 0 },
        ready: () => calls.push({ name: "ready" }),
        expand: () => calls.push({ name: "expand" }),
        close: noop,
        requestFullscreen: () => {
          calls.push({ name: "requestFullscreen" });
          // haqiqiy Telegram kabi: to'liq ekranga o'tadi va chetlarni xabar qiladi
          setTimeout(() => {
            wa.isFullscreen = true;
            wa.safeAreaInset = { top: 24, bottom: 20, left: 0, right: 0 };
            wa.contentSafeAreaInset = { top: 46, bottom: 0, left: 0, right: 0 };
            for (const e of ["fullscreenChanged", "safeAreaChanged", "contentSafeAreaChanged"]) (handlers[e] ?? []).forEach((h) => h());
          }, 30);
        },
        disableVerticalSwipes: () => calls.push({ name: "disableVerticalSwipes" }),
        setHeaderColor: (c: string) => calls.push({ name: "setHeaderColor", arg: c }),
        setBackgroundColor: (c: string) => calls.push({ name: "setBackgroundColor", arg: c }),
        setBottomBarColor: (c: string) => calls.push({ name: "setBottomBarColor", arg: c }),
        onEvent: (e: string, h: () => void) => (handlers[e] ??= []).push(h),
        offEvent: (e: string, h: () => void) => (handlers[e] = (handlers[e] ?? []).filter((x) => x !== h)),
        BackButton: { show: noop, hide: noop, onClick: noop, offClick: noop, isVisible: false },
        MainButton: { show: noop, hide: noop, setText: noop, onClick: noop, offClick: noop, showProgress: noop, hideProgress: noop, enable: noop, disable: noop },
        openTelegramLink: noop,
        openLink: noop,
      };
      (window as unknown as { Telegram: unknown; __tgCalls: unknown }).Telegram = { WebApp: wa };
      (window as unknown as { __tgCalls: unknown }).__tgCalls = calls;
    },
    { platform, version },
  );
  // avtomatik kirish bu testga tegishli emas
  await page.route("**/api/auth/telegram", (r) => r.fulfill({ status: 503, json: { error: "telegram_not_configured" } }));
}

const calls = (page: Page) => page.evaluate(() => (window as unknown as { __tgCalls: Calls }).__tgCalls);

test.describe("Telegram Mini App: to'liq ekran", () => {
  test.use({ hasTouch: true, isMobile: true });

  test("telefonda: butun ekran, surib yopilmaydi, panellar ilova rangida; sarlavha va menyu Telegram tugmalari ostida", async ({ page, context }) => {
    await asGuest(context);
    await miniApp(page, "android", "8.0");
    await page.goto("/");
    await expect(page.locator("html")).toHaveClass(/\btg-fullscreen\b/);
    const names = (await calls(page)).map((c) => c.name);
    expect(names).toEqual(expect.arrayContaining(["ready", "expand", "requestFullscreen", "disableVerticalSwipes"]));
    const colors = Object.fromEntries((await calls(page)).filter((c) => c.arg).map((c) => [c.name, c.arg]));
    expect(colors).toEqual({ setHeaderColor: "#ffffff", setBackgroundColor: "#f6f8fb", setBottomBarColor: "#ffffff" });

    // sarlavha: tizim paneli (24) + Telegram tugmalari (46) ostidan; pastki menyu: tizim chizig'i (20) ustida
    const header = page.locator("header").first();
    await expect.poll(() => header.evaluate((el) => getComputedStyle(el).paddingTop)).toBe("70px");
    await expect.poll(() => page.locator("nav.bottom-nav").evaluate((el) => getComputedStyle(el).paddingBottom)).toBe("20px");
    const box = await header.boundingBox();
    expect(box!.y).toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  });

  test("kompyuter Telegram'ida: butun monitorni egallamaydi (faqat kengaytiriladi); eski versiyada xato bermaydi", async ({ browser }) => {
    for (const [platform, version] of [
      ["tdesktop", "8.0"],
      ["android", "7.2"],
    ] as const) {
      const ctx = await browser.newContext();
      await asGuest(ctx);
      const page = await ctx.newPage();
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await miniApp(page, platform, version);
      await page.goto("/");
      await expect(page.locator("html")).toHaveClass(/\btg\b/);
      const names = (await calls(page)).map((c) => c.name);
      expect(names).toContain("expand");
      expect(names).not.toContain("requestFullscreen");
      if (version === "7.2") expect(names).not.toContain("disableVerticalSwipes");
      await expect(page.locator("html")).not.toHaveClass(/tg-fullscreen/);
      expect(errors).toEqual([]);
      await ctx.close();
    }
  });
});
