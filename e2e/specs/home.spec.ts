import { expect, test } from "@playwright/test";
import { USERS, asGuest, asMode, loginAs, sql } from "../support";

/**
 * Bosh sahifa va navigatsiya. 2026-11-21 (ega: "kirgan zahoti chat"): bosh sahifa — chat (guided-chat.spec.ts); reklama
 * sahifasidagi qidiruv qatori, "Bo'limlar" tez yo'llari va Telegram kanal qatori olib tashlandi — ularning testlari ham.
 */

test("qidiruv sahifasi: qidiruv qatori → kompaniya nomi bo'yicha natija (matn kasbga aylanmasa ham)", async ({ page, context }) => {
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
    // 2026-11-21: bosh sahifa — chat; matnli qidiruv natijasi sahifasi o'z joyida
    await page.goto("/search?mode=jobs&q=Sarbon");
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

// 2026-11-20 (ega: "kirgandan keyin chatga kirsin"): kirgan foydalanuvchining "/" sahifasi — asosiy ekran (/chat);
// avvalgi kirgan bosh sahifa (qidiruv, "E'lonlarim", "Yangi ishlar", "Bo'limlar") endi ochilmaydi — uning ikki testi o'rniga
// simple-app.spec.ts ("kirgan foydalanuvchi: «/» → chat") tekshiradi. Mehmon bosh sahifasi testlari — shu faylda.

test("navigatsiya: mehmonda brend nomi va 'Kirish' ko'rinadi; faol bo'lim belgilanadi", async ({ page, context }) => {
  await asGuest(context);
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("/");
  await expect(page.getByRole("banner").getByText("topdim")).toBeVisible();
  await expect(page.getByRole("banner").getByRole("link", { name: "Kirish" })).toBeVisible();
  // 2026-11-21 (ega, master prompt): hamma uchun bir xil 3 ta bo'lim — Qidiruv · E'lonlarim · Profil
  const nav = page.getByRole("navigation", { name: "Asosiy bo'limlar" }).last();
  const TABS = ["Qidiruv", "E'lonlarim", "Profil"];
  await expect(nav.getByRole("link")).toHaveText(TABS);
  // bosh sahifa — chat, ya'ni "Qidiruv" bo'limi
  await expect(nav.locator("a[aria-current='page']")).toHaveCount(1);
  await expect(nav.getByRole("link", { name: "Qidiruv" })).toHaveAttribute("aria-current", "page");
  await nav.getByRole("link", { name: "Profil" }).click();
  await page.waitForURL(/\/cabinet$/);
  await expect(nav.getByRole("link", { name: "Profil" })).toHaveAttribute("aria-current", "page");
  await expect(nav.locator("a[aria-current='page']")).toHaveCount(1);
  // 360 px da yozuvlar sig'adi (kesilmaydi)
  for (const name of TABS) {
    const label = nav.getByRole("link", { name }).locator("span").first();
    expect(await label.evaluate((el) => el.scrollWidth <= el.clientWidth + 1), name).toBe(true);
  }
});

test("navigatsiya: kirgan foydalanuvchida 360 px da sarlavha sig'adi (gorizontal siljish yo'q)", async ({ page, context }) => {
  await loginAs(context, USERS.workerA);
  for (const width of [360, 390]) {
    await page.setViewportSize({ width, height: 780 });
    await page.goto("/");
    await page.waitForURL(/\/chat$/);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `${width}px`).toBeLessThanOrEqual(0);
    // 2026-11-20: xabarlar — sarlavhada (pastki menyuda 5 ta asosiy bo'lim, "Xabarlar" yo'q)
    await expect(page.getByRole("banner").getByRole("link", { name: "Xabarlar" })).toBeVisible();
    await expect(page.locator("nav.bottom-nav").getByRole("link", { name: "Xabarlar" })).toHaveCount(0);
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

test("chat sarlavhasi (ega, 2026-11-21): telefonda bitta qatorda, rejimga mos jaydari savol", async ({ page, context }) => {
  await asGuest(context);
  for (const [mode, text] of [[null, "Ish kerakmi yoki ishchi?"], ["worker", "Qanday ish qidiryapsiz?"], ["employer", "Sizga qanday ishchi kerak?"]] as const) {
    if (mode) await asMode(context, mode);
    else await context.clearCookies({ name: "ib_mode" });
    for (const width of [320, 360, 390, 412]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/");
      const h1 = page.locator("main h1");
      await expect(h1).toHaveText(text);
      // bitta qator: balandlik ≈ bitta qator balandligi
      const [h, lh] = await h1.evaluate((el) => [el.getBoundingClientRect().height, parseFloat(getComputedStyle(el).lineHeight)]);
      expect(h, `${mode} ${width}px`).toBeLessThan(lh * 1.5);
      expect(await h1.evaluate((el) => el.scrollWidth <= el.clientWidth + 1), `${mode} ${width}px`).toBe(true);
    }
  }
});
