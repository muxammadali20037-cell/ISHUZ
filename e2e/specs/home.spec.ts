import { expect, test } from "@playwright/test";
import { USERS, asGuest, loginAs } from "../support";

/**
 * C8.2 · bosh sahifa va navigatsiya: har yo'l qayerga olib borishini aytadi va aynan o'sha joyni ochadi
 * (avval "Ish qidiryapman" tugmasi ish ro'yxatini emas, e'lon berish formasini ochardi).
 */

const PATHS = [
  { name: /O'zim haqimda e'lon berish/, url: /\/post\/worker$/, heading: /kasb/i },
  { name: /Ish e'loni berish/, url: /\/post\/vacancy$/, heading: /Qanday mutaxassis kerak/ },
  { name: /^Ish e'lonlari$/, url: /\/search\?mode=jobs$/, heading: /^Ish qidiraman/ },
  { name: /^Ishchilar$/, url: /\/search\?mode=workers$/, heading: /^Ishchi qidiraman/ },
];

for (const p of PATHS) {
  test(`bosh sahifa → "${p.name.source}" kutilgan sahifani ochadi`, async ({ page, context }) => {
    await asGuest(context);
    await page.goto("/");
    const link = page.getByRole("link", { name: p.name });
    await expect(link).toHaveCount(1);
    await link.click();
    await page.waitForURL(p.url);
    await expect(page.getByRole("heading", { level: 1 }).or(page.getByRole("heading", { level: 2 })).first()).toContainText(p.heading);
  });
}

test("bosh sahifa: bitta h1, rangli dominant kartalar yo'q, AI bonusi asosiy yo'llardan keyin", async ({ page, context }) => {
  await asGuest(context);
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  // to'liq rangli (primary/success) katta sirtlar: faqat tugmalar bo'lishi mumkin (balandligi < 80 px)
  const big = await page.evaluate(() => {
    const brand = [getComputedStyle(document.documentElement).getPropertyValue("--primary").trim(), getComputedStyle(document.documentElement).getPropertyValue("--success").trim()];
    const toHex = (rgb: string) => {
      const m = rgb.match(/\d+/g);
      return m ? `#${m.slice(0, 3).map((n) => Number(n).toString(16).padStart(2, "0")).join("")}` : "";
    };
    return Array.from(document.querySelectorAll<HTMLElement>("main *"))
      .filter((el) => brand.includes(toHex(getComputedStyle(el).backgroundColor)) && el.getBoundingClientRect().height >= 80)
      .map((el) => `${el.tagName}.${el.className.toString().slice(0, 60)}`);
  });
  expect(big).toEqual([]);
  // AI kartasi Suspense ichida oqim bilan keladi — o'lchashdan oldin joyiga tushishini kutamiz (CI'dagi poyga: top = 0)
  await expect(page.locator("#ai-pro-title")).toBeVisible();
  const order = await page.evaluate(() => {
    const y = (sel: string) => document.querySelector(sel)?.getBoundingClientRect().top ?? -1;
    return { post: y("main a[href='/post/worker']"), ai: y("#ai-pro-title") };
  });
  expect(order.post).toBeGreaterThan(0);
  expect(order.ai).toBeGreaterThan(order.post);
});

test("navigatsiya: mehmonda brend nomi va 'Kirish' ko'rinadi; faol bo'lim belgilanadi", async ({ page, context }) => {
  await asGuest(context);
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("/");
  await expect(page.getByRole("banner").getByText("topdim")).toBeVisible();
  await expect(page.getByRole("banner").getByRole("link", { name: "Kirish" })).toBeVisible();
  const nav = page.getByRole("navigation", { name: "Asosiy bo'limlar" });
  await expect(nav.getByRole("link", { name: "Bosh sahifa" })).toHaveAttribute("aria-current", "page");
  await nav.getByRole("link", { name: "Qidirish" }).click();
  await page.waitForURL(/\/search$/);
  await expect(nav.getByRole("link", { name: "Qidirish" })).toHaveAttribute("aria-current", "page");
  await expect(nav.getByRole("link", { name: "Bosh sahifa" })).not.toHaveAttribute("aria-current", "page");
});

test("navigatsiya: kirgan foydalanuvchida 360 px da sarlavha sig'adi (gorizontal siljish yo'q)", async ({ page, context }) => {
  await loginAs(context, USERS.workerA);
  for (const width of [360, 390]) {
    await page.setViewportSize({ width, height: 780 });
    await page.goto("/");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `${width}px`).toBeLessThanOrEqual(0);
    await expect(page.getByRole("banner").getByRole("link", { name: "Chat" })).toBeVisible();
    await expect(page.getByRole("banner").getByRole("link", { name: "Bildirishnomalar" })).toBeVisible();
  }
});

test("bosh sahifa kartalari: 360–1440 px da matn karta chetidan chiqmaydi", async ({ page, context }) => {
  await asGuest(context);
  const bad: string[] = [];
  for (const width of [360, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const over = await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLElement>("main ul > li > a, main ul > li > section, main ul > li a"))
        .filter((el) => el.scrollWidth > el.clientWidth + 1)
        .map((el) => `${(el.textContent ?? "").trim().slice(0, 30)} (+${el.scrollWidth - el.clientWidth}px)`),
    );
    bad.push(...over.map((o) => `${width}px: ${o}`));
  }
  expect(bad).toEqual([]);
});
