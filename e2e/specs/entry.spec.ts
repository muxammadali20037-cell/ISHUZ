import { expect, test, type BrowserContext } from "@playwright/test";
import { USERS, asGuest, sql } from "../support";

/**
 * S1 · ilovaga kirish: ochilish ekrani ("topdim" so'ziga yaqinlashib kiradi), rejim tanlanmagan mehmon uchun kirish oynasi
 * (haqiqiy raqamlar, ikki katta maqsad, tez kirish, yangi vakansiyalar). Birinchi ochilishdagi til va tanishtiruv —
 * entry-flow.spec.ts.
 */

const cookie = async (ctx: BrowserContext, name: string) => (await ctx.cookies()).find((c) => c.name === name)?.value;

async function activeJobs(): Promise<number> {
  const [r] = await sql<{ n: string }>("select coalesce((select total_count from public.simple_search_vacancies(p_remote => false, p_no_experience => false, p_limit => 1, p_offset => 0) limit 1), 0) as n");
  return Number(r!.n);
}

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

  test("kirish oynasi: haqiqiy raqamlar, ikki katta maqsad, qidiruv, yangi vakansiyalar; ko'rish rejim yozmaydi", async ({ page, context }) => {
    await asGuest(context);
    await page.goto("/");
    const main = page.getByRole("main");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Nima qidiryapsiz?");
    const jobs = await activeJobs();
    const [today] = await sql<{ n: string }>(
      "select count(*) as n from public.vacancies where status = 'active' and (expires_at is null or expires_at > now()) and published_at >= date_trunc('day', now() at time zone 'Asia/Tashkent') at time zone 'Asia/Tashkent'",
    );
    await expect(main.getByText(`Bugun ${today!.n} ta yangi e'lon`)).toBeVisible();
    await expect(main.getByRole("button", { name: new RegExp(`^Ish topaman\\s*${jobs} ta vakansiya`) })).toBeVisible();
    await expect(main.getByRole("button", { name: /^Ishchi topaman/ })).toBeVisible();
    await expect(page.getByRole("searchbox", { name: "Ish qidirish" })).toBeVisible();
    await expect(main.getByRole("heading", { level: 2, name: "Yangi vakansiyalar" })).toBeVisible();
    const cards = main.getByRole("region", { name: "Yangi vakansiyalar" }).locator("article");
    await expect(cards.first()).toBeVisible();
    expect(await cards.count()).toBeLessThanOrEqual(5);
    await expect(main.getByText("Ro'yxatdan o'tmasdan ko'rish")).toBeVisible();
    await expect(main.getByRole("link", { name: "Kirish", exact: true })).toHaveAttribute("href", "/auth");
    // faqat ko'rish rejimni tanlamaydi
    expect(await cookie(context, "ib_mode")).toBeUndefined();
    // gorizontal siljish yo'q (360 px)
    await page.setViewportSize({ width: 360, height: 780 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  });

  test("maqsad plitkalari: 'Ish topaman' → ish qidiruvchi bosh sahifasi; 'Ishchi topaman' → ish beruvchi", async ({ page, context }) => {
    await asGuest(context);
    await page.goto("/");
    await page.getByRole("main").getByRole("button", { name: /^Ish topaman/ }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ish toping");
    expect(await cookie(context, "ib_mode")).toBe("worker");

    await asGuest(context);
    await context.clearCookies({ name: "ib_mode" });
    await page.goto("/");
    await page.getByRole("main").getByRole("button", { name: /^Ishchi topaman/ }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Xodim toping");
    expect(await cookie(context, "ib_mode")).toBe("employer");
  });

  test("tez kirish: 'Kunlik ish' → kunlik ishlar natijasi; 'E'lon berish' → vakansiya e'loni (rejim shunga mos)", async ({ page, context }) => {
    await asGuest(context);
    await page.goto("/");
    await page.getByRole("main").getByRole("button", { name: "Kunlik ish", exact: true }).click();
    await page.waitForURL(/\/search\?.*pay=daily/);
    await expect(page.locator("main article").filter({ hasText: "Omborchi" })).toHaveCount(1);
    expect(await cookie(context, "ib_mode")).toBe("worker");

    await asGuest(context);
    await context.clearCookies({ name: "ib_mode" });
    await page.goto("/");
    await page.getByRole("main").getByRole("button", { name: "E'lon berish", exact: true }).click();
    await page.waitForURL(/\/post\/vacancy/);
    expect(await cookie(context, "ib_mode")).toBe("employer");
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
    await page.getByRole("searchbox", { name: "Ish qidirish" }).fill("kassir");
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
