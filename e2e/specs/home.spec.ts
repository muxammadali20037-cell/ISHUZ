import { expect, test } from "@playwright/test";
import { USERS, asGuest, asMode, loginAs, sql } from "../support";

/**
 * R-C · bosh sahifa: birinchi ekranda qidiruv va haqiqiy e'lonlar. Har bir yo'l aytgan joyini ochadi:
 * qidiruv qatori → natijalar; tez filtr → shu filtrli natijalar; "Barcha kasblar" → kasb tanlash; e'lon berish → forma.
 */
const PATHS = [
  { mode: "worker", name: /^O'zim haqimda e'lon berish/, url: /\/post\/worker$/, heading: /kasb/i },
  { mode: "worker", name: /^Barcha kasblar$/, url: /\/search\?mode=jobs$/, heading: /^Ish qidiraman/ },
  { mode: "worker", name: /^Kunlik ish$/, url: /\/search\?mode=jobs&region=all&pay=daily$/, heading: /Kunlik ishlar/ },
  { mode: "employer", name: /^Vakansiya joylash$/, url: /\/post\/vacancy$/, heading: /Qanday mutaxassis kerak/ },
  { mode: "employer", name: /^Tajribali$/, url: /\/search\?mode=workers&region=all&exp=1&any=1$/, heading: /Ishchilar: Barcha kasblar/ },
] as const;

for (const p of PATHS) {
  test(`bosh sahifa (${p.mode}) → "${p.name.source}" kutilgan sahifani ochadi`, async ({ page, context }) => {
    await asGuest(context);
    await asMode(context, p.mode);
    await page.goto("/");
    // ro'yxat bo'sh bo'lsa (toza baza) "O'zim haqimda e'lon berish" bo'sh holatda ham turadi — birinchi ko'rinadiganini bosamiz
    const link = page.getByRole("main").getByRole("link", { name: p.name }).first();
    await expect(link).toBeVisible();
    await link.click();
    await page.waitForURL(p.url);
    await expect(page.getByRole("heading", { level: 1 }).or(page.getByRole("heading", { level: 2 })).first()).toContainText(p.heading);
  });
}

test("bosh sahifa: qidiruv qatori → kompaniya nomi bo'yicha natija (matn kasbga aylanmasa ham)", async ({ page, context }) => {
  await sql("delete from public.vacancies where owner_profile_id = $1", [USERS.employer]);
  const [co] = await sql<{ id: string }>(
    `insert into public.companies (name, slug, verification_status) values ('Sarbon Savdo', 'sarbon-savdo-e2e', 'verified')
     on conflict (slug) do update set name = excluded.name returning id`,
  );
  await sql(
    `insert into public.vacancies (owner_profile_id, company_id, title, region_id, description, status, salary_from, salary_type, experience_min_months, published_at, expires_at)
     select $1, $2, 'Kassir', r.id, 'Do''konga kassir kerak, 9 dan 18 gacha', 'active', 4000000, 'monthly', 0, now(), now() + interval '10 days'
     from public.regions r where r.slug = 'tashkent_city'`,
    [USERS.employer, co!.id],
  );
  try {
    await asGuest(context);
    await page.goto("/");
    await page.getByRole("searchbox", { name: "Ish qidirish" }).fill("Sarbon");
    await page.getByRole("button", { name: "Topish" }).click();
    await page.waitForURL(/\/search\?mode=jobs&q=Sarbon/);
    const card = page.locator("main article").filter({ hasText: "Kassir" });
    await expect(card).toHaveCount(1);
    // kompaniya va haqiqiy "tasdiqlangan" belgisi; maosh davri bilan
    await expect(card.getByText("Sarbon Savdo")).toBeVisible();
    await expect(card.getByRole("img", { name: "Tasdiqlangan kompaniya" })).toBeVisible();
    await expect(card).toContainText("so'm/oy");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("«Sarbon»");
  } finally {
    await sql("delete from public.vacancies where owner_profile_id = $1", [USERS.employer]);
    await sql("delete from public.companies where slug = 'sarbon-savdo-e2e'");
  }
});

test("bosh sahifa: bitta h1, rangli dominant kartalar yo'q; qidiruv birinchi ekranda, AI bonusi ro'yxatdan keyin", async ({ page, context }) => {
  await asGuest(context);
  await asMode(context, "worker");
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ish toping");
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
  // qidiruv va tez filtrlar birinchi ekranda (390×844)
  const search = await page.getByRole("searchbox", { name: "Ish qidirish" }).boundingBox();
  expect(search!.y + search!.height).toBeLessThan(400);
  await expect(page.getByRole("group", { name: "Tez filtrlar" }).getByRole("link", { name: /Butun O'zbekiston/ })).toBeVisible();
  // AI qatori Suspense ichida oqim bilan keladi — o'lchashdan oldin joyiga tushishini kutamiz
  const ai = page.getByRole("link", { name: /AI yordamchi/ });
  await expect(ai).toBeVisible();
  const order = await page.evaluate(() => {
    const y = (sel: string) => document.querySelector(sel)?.getBoundingClientRect().top ?? -1;
    return { list: y("#home-feed"), ai: y("main a[href^='/ai-alerts']") };
  });
  expect(order.list).toBeGreaterThan(0);
  expect(order.ai).toBeGreaterThan(order.list);
});

test("navigatsiya: mehmonda brend nomi va 'Kirish' ko'rinadi; faol bo'lim belgilanadi", async ({ page, context }) => {
  await asGuest(context);
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("/");
  await expect(page.getByRole("banner").getByText("topdim")).toBeVisible();
  await expect(page.getByRole("banner").getByRole("link", { name: "Kirish" })).toBeVisible();
  // R-B: ish qidiruvchi (rejim tanlamagan mehmon ham) — Ishlar · Saqlanganlar · Arizalar · Profil
  const nav = page.getByRole("navigation", { name: "Asosiy bo'limlar" }).last();
  await expect(nav.getByRole("link")).toHaveText(["Ishlar", "Saqlanganlar", "Arizalar", "Profil"]);
  await expect(nav.getByRole("link", { name: "Ishlar" })).toHaveAttribute("aria-current", "page");
  await nav.getByRole("link", { name: "Saqlanganlar" }).click();
  await page.waitForURL(/\/saved$/);
  await expect(nav.getByRole("link", { name: "Saqlanganlar" })).toHaveAttribute("aria-current", "page");
  await expect(nav.getByRole("link", { name: "Ishlar" })).not.toHaveAttribute("aria-current", "page");
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

test("bosh sahifa kartalari: 360–1440 px da matn karta chetidan chiqmaydi (ikkala rejimda va rejim tanlanmaganda)", async ({ page, context }) => {
  await asGuest(context);
  const bad: string[] = [];
  const modes: ("worker" | "employer" | null)[] = [null, "worker", "employer"];
  for (const [mode, width] of modes.flatMap((m) => [360, 768, 1024, 1440].map((w) => [m, w] as const))) {
    await asGuest(context);
    if (mode) await asMode(context, mode);
    else await context.clearCookies({ name: "ib_mode" });
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const over = await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLElement>("main ul > li > a, main ul > li > section, main ul > li a, main section button"))
        .filter((el) => el.scrollWidth > el.clientWidth + 1)
        .map((el) => `${(el.textContent ?? "").trim().slice(0, 30)} (+${el.scrollWidth - el.clientWidth}px)`),
    );
    bad.push(...over.map((o) => `${mode ?? "rejimsiz"} ${width}px: ${o}`));
  }
  expect(bad).toEqual([]);
});
