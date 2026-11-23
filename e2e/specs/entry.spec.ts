import { expect, test, type BrowserContext } from "@playwright/test";
import { USERS, asGuest, homeSearch, sql } from "../support";

/**
 * S1 · ilovaga kirish: ochilish ekrani ("topdim" so'ziga yaqinlashib kiradi) va rejim tanlanmagan mehmon uchun bosh sahifa.
 * 2026-11-21 (ega): bosh sahifa — darhol chat ("Ish yoki ishchini oson toping"), maqsadni AI yozilganidan aniqlaydi; chatning
 * to'liq oqimi — guided-chat.spec.ts.
 */

const cookie = async (ctx: BrowserContext, name: string) => (await ctx.cookies()).find((c) => c.name === name)?.value;

test.describe("kirish", () => {
  test.beforeAll(async () => {
    await sql("delete from public.vacancies where owner_profile_id = $1", [USERS.employer]);
    const [r] = await sql<{ id: string }>("select id from public.regions where slug = 'tashkent_city'");
    await sql(
      `insert into public.vacancies (owner_profile_id, title, region_id, description, status, salary_from, salary_type, experience_min_months, published_at, expires_at)
       values ($1, 'Kassir', $2, 'Do''konga kassir kerak, 9 dan 18 gacha', 'active', 4000000, 'monthly', 0, now(), now() + interval '10 days'),
              ($1, 'Omborchi', $2, 'Omborga yordamchi kerak, kunlik to''lov', 'active', 200000, 'daily', 0, now(), now() + interval '10 days')`,
      [USERS.employer, r!.id],
    );
  });
  test.afterAll(async () => {
    await sql("delete from public.vacancies where owner_profile_id = $1", [USERS.employer]);
  });

  test("bosh sahifa (mehmon) — darhol chat: sarlavha, qidiruv qatori, uchta tugma; ko'rish rejim yozmaydi", async ({ page, context }) => {
    await asGuest(context);
    await page.goto("/");
    const main = page.getByRole("main");
    // 2026-11-21 (ega): reklama sahifasi va misollar yo'q; 2026-11-23: C varianti — qidiruv qatori va uchta tugma
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ishingiz shu yerdan boshlanadi!");
    await expect(main.locator("[data-guided-start]")).toHaveCount(3);
    await expect(main.getByRole("search")).toBeVisible();
    await expect(main.locator("[data-home-q]")).toHaveAttribute("placeholder", "Yozing, o'zingizga mosini toping");
    await expect(main.getByRole("button", { name: /^Men ish qidiryapman/ })).toHaveCount(0);
    await expect(page.getByRole("banner").getByRole("link", { name: "Kirish", exact: true })).toHaveAttribute("href", /^\/auth/);
    // faqat ko'rish rejimni tanlamaydi
    expect(await cookie(context, "ib_mode")).toBeUndefined();
    // gorizontal siljish yo'q (360 px)
    await page.setViewportSize({ width: 360, height: 780 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  });

  test("maqsad yozilganidan aniqlanadi: «ish kerak» → ish qidiruvchi; «menga … kerak» → ish beruvchi (rejim eslab qolinadi)", async ({ context }) => {
    for (const [text, mode] of [["Men elektrikman, ish kerak", "worker"], ["Menga haydovchi kerak", "employer"]] as const) {
      await asGuest(context);
      await context.clearCookies({ name: "ib_mode" });
      // yangi tab — oldingi suhbat (shu tabda saqlanadi) aralashmasin
      const page = await context.newPage();
      await page.goto("/");
      await homeSearch(page, text);
      await expect(page.locator("[data-ai-you]").first()).toHaveText(`Siz: ${text}`);
      // suhbat boshlangach — bo'sh holatdagi yozuv va tugmalar ko'rinmaydi (sarlavha faqat ekran o'qigich uchun)
      await expect(page.locator("[data-guided-start]")).toHaveCount(0);
      await expect.poll(() => cookie(context, "ib_mode"), text).toBe(mode);
      await page.close();
    }
  });

  test("ochilish ekrani: sessiyada bir marta, bosishni to'smaydi, ~1.3 s da yo'qoladi; harakat kamaytirilganda yo'q", async ({ page, context }) => {
    // avtomatlashtirilgan brauzerda splash o'chiq (navigator.webdriver) — bu testda oddiy foydalanuvchi kabi
    await context.addInitScript(() => Object.defineProperty(navigator, "webdriver", { get: () => false }));
    await asGuest(context);
    await page.goto("/");
    const splash = page.locator(".splash");
    expect(await page.evaluate(() => document.documentElement.classList.contains("no-splash"))).toBe(false);
    // kontent ostida allaqachon chizilgan; splash bosishlarni o'tkazib yuboradi (sun'iy kutish yo'q)
    expect(await splash.evaluate((el) => [getComputedStyle(el).display, getComputedStyle(el).pointerEvents])).toEqual(["flex", "none"]);
    await page.locator("[data-home-q]").fill("kassir");
    await expect(splash).toBeHidden({ timeout: 2500 });
    // shu sessiyada qayta ochilsa — yo'q
    await page.reload();
    expect(await page.evaluate(() => document.documentElement.classList.contains("no-splash"))).toBe(true);
    await expect(splash).toBeHidden();

    const other = await context.newPage();
    await other.emulateMedia({ reducedMotion: "reduce" });
    await other.goto("/");
    await expect(other.locator(".splash")).toBeHidden();
    await other.close();
  });
});
