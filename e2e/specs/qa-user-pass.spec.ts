import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { USERS, asGuest, asMode, homeSearch, loginAs, sql, stack } from "../support";

/**
 * QA (2026-11-21, ega: "odam sifatida ilovaga kirib, hamma narsani qilib ko'r, xato top"): topilgan xatolar qaytmasin.
 *  1) ish izlovchida "Sizga mos" ochilganda pastki menyuda ikkita bo'lim birga yonib turardi (2026-11-21 dan menyu 3 ta;
 *     2026-11-22 dan "Sizga mos" yo'q — eski havola E'lonlarimga);
 *  2) ruschada 390 px ekranda bildirishnomalar va ustalar sarlavhasi ekrandan chiqib ketardi; 320 px da o'rtadagi
 *     "Найти/Подать" yozuvi kesilardi;
 *  3) e'lon joylashning 1-qadamida va taklif havolasi sahifasida sahifa nomi (h1) yo'q edi;
 *  4) chatda uzun gap ("Toshkentda sotuvchi ish kerak, tajribam 2 yil, … Chilonzor yoki Yunusobod …") — kasb o'rniga
 *     "chilonzor" yozilib, shu so'z bo'yicha qidirilardi; tushunarsiz matnda "Hududni tanlang" deyilardi.
 */

const host = new URL(stack.app).hostname;
const locale = (ctx: BrowserContext, value: string) => ctx.addCookies([{ name: "ishuz_locale", value, domain: host, path: "/" }]);
const overflow = (p: Page) => p.evaluate(() => document.documentElement.scrollWidth - innerWidth);

test("ish izlovchi: E'lonlarim ochiq — pastki menyuda faqat bitta faol bo'lim (eski «Sizga mos» havolasi ham shu yerga)", async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await loginAs(context, USERS.workerA);
  await asMode(context, "worker");
  // "Sizga mos" olib tashlandi (ega, 2026-11-22) — eski havola E'lonlarimga olib boradi
  await page.goto("/cabinet/matches");
  await expect(page).toHaveURL(/\/cabinet\/elonlar$/);
  const tabs = page.locator("[data-app-tabs]");
  await expect(tabs.locator("[aria-current='page']")).toHaveCount(1);
  await expect(tabs.locator("[aria-current='page']")).toHaveAttribute("data-tab", "my-listings");
  await page.goto("/jobs");
  await expect(tabs.locator("[aria-current='page']")).toHaveCount(1);
  await expect(tabs.locator("[aria-current='page']")).toHaveAttribute("data-tab", "chat");
});

test.describe("ruscha, tor ekran", () => {
  test.beforeAll(async () => {
    await sql("delete from public.notifications where profile_id = $1 and payload->>'qa' = '1'", [USERS.workerA]);
    for (let i = 0; i < 2; i++) {
      await sql(`insert into public.notifications (profile_id, type, payload, link) values ($1, 'system', '{"qa":"1","title":"Sinov"}', '/cabinet')`, [USERS.workerA]);
    }
  });
  test.afterAll(async () => {
    await sql("delete from public.notifications where profile_id = $1 and payload->>'qa' = '1'", [USERS.workerA]);
  });

  for (const width of [320, 390]) {
    test(`${width} px: bildirishnomalar va ustalar sahifalari ekrandan chiqmaydi`, async ({ page, context }) => {
      await page.setViewportSize({ width, height: 800 });
      await loginAs(context, USERS.workerA);
      await asMode(context, "worker");
      await locale(context, "ru");
      await page.goto("/notifications");
      await expect(page.getByRole("button", { name: "Отметить все как прочитанные" })).toBeVisible();
      expect(await overflow(page), "/notifications").toBeLessThanOrEqual(0);
      // E'lonlarim yorliqlari (Активные · Закрытые · Истёкшие) — nomlar kesilmaydi
      await page.goto("/cabinet/elonlar");
      const cut = await page.locator("[data-bucket-tab] span.truncate").evaluateAll((els) => els.filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent));
      expect(cut, "/cabinet/elonlar").toEqual([]);
      expect(await overflow(page), "/cabinet/elonlar").toBeLessThanOrEqual(0);
      for (const path of ["/ustalar", "/ustalar/qidiruv", "/ustalar/kabinet"]) {
        await page.goto(path);
        await expect(page.locator("[data-masters-post]")).toBeVisible();
        expect(await overflow(page), path).toBeLessThanOrEqual(0);
      }
    });
  }

  test("320 px: pastki menyu yozuvlari to'liq (4 tilda)", async ({ page, context }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await loginAs(context, USERS.workerA);
    await asMode(context, "worker");
    for (const lang of ["uz", "oz", "ru", "en"]) {
      await locale(context, lang);
      await page.goto("/chat");
      const labels = page.locator("[data-app-tabs] a > span:last-of-type, [data-app-tabs] a span.truncate");
      await expect(labels.first()).toBeVisible();
      const cut = await page.locator("[data-app-tabs] span.truncate").evaluateAll((els) =>
        els.filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent),
      );
      expect(cut, lang).toEqual([]);
    }
  });
});

test("sahifa nomi (h1): e'lon joylashning 1-qadami va taklif havolasi", async ({ page, context }) => {
  await asGuest(context);
  await asMode(context, "worker");
  await page.goto("/post/worker");
  await expect(page.locator("h1")).toHaveCount(1);
  await asMode(context, "employer");
  await page.goto("/post/vacancy");
  await expect(page.locator("h1")).toHaveCount(1);
  await loginAs(context, USERS.employer);
  await page.goto("/company/join");
  await expect(page.locator("h1")).toHaveCount(1);
  await page.goto("/company/join?token=notarealtoken123");
  await expect(page.locator("h1")).toHaveCount(1);
});

test("chat: uzun gapdan kasb to'g'ri olinadi (tuman nomi kasb bo'lmaydi); tushunarsiz matnda kasb so'raladi", async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loginAs(context, USERS.workerA);
  await asMode(context, "worker");
  await page.goto("/chat");
  const box = page.locator("form[data-hydrated] #start-chat-text");
  const settled = () => expect(page.locator("[data-guided-ai='thinking'], [data-guided-ai='searching']")).toHaveCount(0, { timeout: 20_000 });
  const last = () => page.locator("[data-guided-ai]").last();
  // birinchi xabar — bosh ekrandagi qidiruv qatoridan (2026-11-23)
  await homeSearch(page, "asdkjhqwe");
  await settled();
  // 2026-11-21: forma oynasi o'rniga chatda bitta aniq savol
  await expect(last()).toHaveAttribute("data-guided-ai", "ask-profession");
  await expect(last()).toContainText("«asdkjhqwe» degan kasbni tushunmadim.");

  await box.fill(
    "Toshkentda sotuvchi ish kerak, tajribam 2 yil, oylik kamida 4 million, Chilonzor yoki Yunusobod tumani bo'lsa yaxshi, haftasiga 5 kun ishlamoqchiman",
  );
  await box.press("Enter");
  await settled();
  // kasb ham, hudud ham tushunildi — boshqa savol yo'q; savol-javob bilan kelingani uchun avval tanlov (2026-11-22)
  await expect(last()).toHaveAttribute("data-guided-ai", "next");
  await box.blur();
  await last().locator("[data-guided-next-to='see']").click();
  await settled();
  // "chilonzor" kasb emas
  await expect(last()).toHaveAttribute("data-guided-ai", /results|none/);
  const summary = page.locator("[data-guided-summary]").last();
  await expect(summary).toContainText(/sotuvchi/i);
  await expect(summary).toContainText("Toshkent shahri");
  await expect(summary).not.toContainText(/chilonzor/i);
});
