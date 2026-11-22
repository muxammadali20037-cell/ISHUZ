import { expect, test } from "@playwright/test";
import { USERS, asGuest, asMode, loginAs, sql } from "../support";

/**
 * Soddalashtirish 2 (ega, 2026-11-17):
 *  - mehmonning pastki menyusida "Xabarlar" o'rnida "Sohalar"; kirganlarda "Xabarlar" o'z joyida;
 *  - /sohalar — har bir soha qator bo'lib, eng ko'p ish o'rni bor soha tepada, ostida kichik yozuv bilan soni (haqiqiy);
 *  - birinchi kirishda — kunduzgi rejim (telefon tungi rejimda bo'lsa ham); tungi — faqat sozlamalarda tanlansa;
 *  - "men oila shifokoriman" → "Oilaviy shifokor" ("Oila huquqi yuristi" emas);
 *  - qidiruvda oylik maosh so'ralmaydi.
 */

const TAG = "Soddalashtirish 2 sinovi";

async function categories() {
  return sql<{ id: string; slug: string; name_uz: string; sort_order: number }>(
    "select id, slug, name_uz, sort_order from public.categories order by sort_order desc",
  );
}

test.afterEach(async () => {
  await sql("delete from public.vacancies where owner_profile_id = $1 and title like $2", [USERS.employer, `${TAG}%`]);
});

test("pastki menyu: mehmonda ham, kirganda ham bir xil 3 ta bo'lim (2026-11-21); /sohalar — «Chat» bo'limida", async ({ page, context }) => {
  const TABS = ["Qidiruv", "E'lonlarim", "Profil"];
  await asGuest(context);
  await asMode(context, "worker");
  await page.goto("/jobs");
  const nav = page.locator("nav.bottom-nav");
  await expect(nav.getByRole("link")).toHaveText(TABS);
  await page.goto("/sohalar");
  await expect(page.getByRole("heading", { level: 1, name: "Sohalar" })).toBeVisible();
  // /sohalar — ishlar katalogi (chatdan ochiladi): "Qidiruv" belgilanadi
  await expect(nav.getByRole("link", { name: "Qidiruv" })).toHaveAttribute("aria-current", "page");

  await loginAs(context, USERS.workerA);
  await asMode(context, "worker");
  await page.goto("/jobs");
  await expect(nav.getByRole("link")).toHaveText(TABS);
  // xabarlar — yuqori panelda
  await expect(page.getByRole("banner").getByRole("link", { name: "Xabarlar" })).toBeVisible();
});

test("/sohalar: har bir soha — qator; eng ko'p ish o'rni bor soha tepada; ostida soni (bazadagi faol vakansiyalar bilan bir xil)", async ({ page, context }) => {
  // eng oxirgi tartibdagi sohaga 3 ta, keyingisiga 2 ta faol vakansiya — ular ro'yxat tepasiga chiqishi kerak
  const [last, prev] = await categories();
  const [r] = await sql<{ id: string }>("select id from public.regions where slug = 'tashkent_city'");
  for (const [cat, n] of [[last!, 3], [prev!, 2]] as const) {
    for (let i = 0; i < n; i++) {
      await sql(
        `insert into public.vacancies (owner_profile_id, title, region_id, category_id, description, status, salary_from, salary_type, published_at, expires_at)
         values ($1, $2, $3, $4, 'Sinov e''loni: ish joyi tavsifi, grafik va shartlar', 'active', 3000000, 'monthly', now(), now() + interval '10 days')`,
        [USERS.employer, `${TAG} ${cat.slug} ${i}`, r!.id, cat.id],
      );
    }
  }
  // kutilgan sonlar — xuddi sahifa ishlatadigan funksiyadan (soxta raqam yo'q; testlar ketma-ket — boshqa e'lon qo'shilmaydi)
  const [row] = await sql<{ counts: { categories: Record<string, number> } }>("select public.home_market_counts() as counts");
  const counts = row!.counts;
  const all = await categories();
  const expected = [...all]
    .map((c) => ({ ...c, n: Number(counts.categories[c.id] ?? 0) }))
    .sort((a, b) => b.n - a.n || a.sort_order - b.sort_order);

  await asGuest(context);
  await asMode(context, "worker");
  await page.goto("/sohalar");
  const rows = page.locator("[data-fields] [data-field]");
  await expect(rows).toHaveCount(all.length);
  // tartib: ko'pi tepada (teng bo'lsa — odatiy tartib)
  expect(await rows.evaluateAll((els) => els.map((e) => e.getAttribute("data-field")))).toEqual(expected.map((c) => c.slug));
  const counted = await page.locator("[data-fields] [data-field-count]").evaluateAll((els) => els.map((e) => Number(e.getAttribute("data-field-count"))));
  expect(counted).toEqual(expected.map((c) => c.n));
  // ostidagi kichik yozuv
  const top = rows.first();
  const topCat = expected[0]!;
  await expect(top).toContainText(topCat.name_uz);
  await expect(top.locator("[data-field-count]")).toHaveText(`${topCat.n} ta ish o'rni`);
  const empty = expected.find((c) => c.n === 0);
  if (empty) await expect(page.locator(`[data-field="${empty.slug}"] [data-field-count]`)).toHaveText("Hozircha ish o'rni yo'q");
  // bitta ustun, telefonda yonga siljimaydi
  expect(new Set(await rows.evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().left)))).size).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
  // bosilsa — shu sohadagi ishlar
  await top.click();
  await page.waitForURL(new RegExp(`category=${topCat.slug}`));
});

test("birinchi kirish — kunduzgi rejim (telefon tungi rejimda bo'lsa ham); tungi — faqat tanlansa", async ({ page, context }) => {
  await asGuest(context);
  await asMode(context, "worker");
  await context.clearCookies({ name: "ishuz_theme" });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await expect(page.locator("html")).not.toHaveClass(/(^|\s)dark(\s|$)/);
  // tanlangan bo'lsa — tanlangani
  await context.addCookies([{ name: "ishuz_theme", value: "dark", url: test.info().project.use.baseURL ?? "http://localhost:3300" }]);
  await page.goto("/");
  await expect(page.locator("html")).toHaveClass(/(^|\s)dark(\s|$)/);
  // "Tizim" — qurilmaga qarab
  await context.addCookies([{ name: "ishuz_theme", value: "system", url: test.info().project.use.baseURL ?? "http://localhost:3300" }]);
  await page.goto("/");
  await expect(page.locator("html")).toHaveClass(/(^|\s)dark(\s|$)/);
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await expect(page.locator("html")).not.toHaveClass(/(^|\s)dark(\s|$)/);
  await context.clearCookies({ name: "ishuz_theme" });
});

test("«men oila shifokoriman» → «Oilaviy shifokor» (oila huquqi yuristi emas); maosh so'ralmaydi", async ({ page, context }) => {
  await asGuest(context);
  await asMode(context, "worker");
  // 2026-11-21: bosh sahifa — chat; hudud tugma bilan, maosh umuman so'ralmaydi
  await page.goto("/");
  const box = page.locator("form[data-hydrated] #start-chat-text");
  await box.fill("men oila shifokoriman");
  await box.press("Enter");
  await page.locator("[data-guided-ai='ask-place'] [data-guided-place='all']").last().click();
  await box.blur();
  await page.locator("[data-guided-ai='next'] [data-guided-next-to='see']").last().click();
  const answer = page.locator("[data-guided-ai]").last();
  await expect(answer).toHaveAttribute("data-guided-ai", /^(results|none)$/, { timeout: 20_000 });
  await expect(answer.locator("[data-guided-summary]")).toContainText("Oilaviy shifokor");
  await expect(answer.locator("[data-guided-summary]")).not.toContainText(/yurist/i);
  await expect(page.locator("[data-guided-thread]")).not.toContainText(/maosh/i);
});

test("chat yozish maydoni: ko'rsatma («Masalan: men oshpazman») telefonda ham bitta qatorga sig'adi; maydon ekrandan chiqmaydi", async ({ page, context }) => {
  await asGuest(context);
  await asMode(context, "worker");
  for (const width of [320, 360, 390, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/");
    const box = page.locator("form[data-hydrated] #start-chat-text");
    await expect(box, `${width}px`).toHaveAttribute("placeholder", "Masalan: men oshpazman");
    // bitta qator (ko'rsatma ikkinchi qatorga o'tib, kesilib qolmaydi) va maydon ekran ichida
    expect(await box.evaluate((el) => el.scrollHeight <= el.clientHeight + 1), `${width}px`).toBe(true);
    const r = (await box.boundingBox())!;
    expect(r.x + r.width, `${width}px`).toBeLessThanOrEqual(width);
  }
});

test("«E'lonlarim» (pastki menyudan): o'zi joylagan e'lonlar va holati; bo'lmasa — «E'lon joylash»; mehmon — kirishga", async ({ page, context }) => {
  await sql(
    `insert into public.vacancies (owner_profile_id, title, region_id, description, status, salary_from, salary_type, published_at, expires_at)
     select $1, $2, r.id, 'Sinov e''loni: ish joyi tavsifi, grafik va shartlar', 'active', 3000000, 'monthly', now(), now() + interval '10 days'
     from public.regions r where r.slug = 'tashkent_city'`,
    [USERS.employer, `${TAG} faol`],
  );
  await sql(
    `insert into public.vacancies (owner_profile_id, title, region_id, description, status, salary_from, salary_type)
     select $1, $2, r.id, 'Sinov e''loni: ish joyi tavsifi, grafik va shartlar', 'paused', 3000000, 'monthly'
     from public.regions r where r.slug = 'tashkent_city'`,
    [USERS.employer, `${TAG} to'xtatilgan`],
  );
  // ish beruvchi: ikkala vakansiya va har birining holati
  await loginAs(context, USERS.employer);
  await asMode(context, "employer");
  await page.goto("/cabinet/elonlar");
  await expect(page.getByRole("heading", { level: 1, name: "E'lonlarim" })).toBeVisible();
  const active = page.locator("article").filter({ hasText: `${TAG} faol` });
  await expect(active).toContainText(/Faol/);
  // to'xtatilgan vakansiya — "Yopilgan" yorlig'ida (2026-11-21: Faol · Yopilgan · Muddati tugagan)
  const paused = page.locator("article").filter({ hasText: `${TAG} to'xtatilgan` });
  await expect(paused).toHaveCount(0);
  await expect(page.locator("[data-bucket-tab='closed']")).toContainText("1");
  await expect(page.locator("[data-my-listings-empty]")).toHaveCount(0);
  // ixcham (ega, 2026-11-17: "juda katta, tushunarsiz — soddalashtir"): kichik karta, tugmalar kichik va bir qatorda;
  // xabarnoma obunasi va "mos ishchilar" bu yerda yo'q
  const list = page.locator("[data-my-listings]");
  await expect(list).not.toContainText("xabar bering");
  await expect(list).not.toContainText("Mos ishchilar");
  await expect(active.getByRole("link", { name: "O'zgartirish" })).toBeVisible();
  // kartaning bosh qismi (nomi, "›") — e'lonning o'zini ochadi
  await expect(active.locator("[data-my-listing-open]")).toHaveAttribute("href", /^\/employer\/vacancies\/[0-9a-f-]{36}$/);
  await expect(active.getByRole("button", { name: "Ishchi topdim" })).toBeVisible();
  const chips = await active.locator("a:not([data-my-listing-open]), button").evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => ({ h: r.height, top: Math.round(r.top) })));
  for (const c of chips) expect(c.h).toBeLessThanOrEqual(44);
  expect(new Set(chips.map((c) => c.top)).size).toBe(1);
  expect((await active.boundingBox())!.height).toBeLessThan(240);
  await page.locator("[data-bucket-tab='closed']").click();
  await page.waitForURL(/holat=yopilgan$/);
  await expect(paused).toBeVisible();
  await expect(paused.locator("p").filter({ hasText: /To'xtatilgan|to'xtatilgan/ }).first()).toBeVisible();
  await expect(active).toHaveCount(0);

  // e'loni yo'q ish izlovchi: pastki menyudagi "E'lonlarim" (2026-11-20; avval — bosh sahifadagi qator) → bo'sh holat va "E'lon joylash"
  await sql("delete from public.worker_profiles where profile_id = $1", [USERS.workerB]);
  await sql("delete from public.master_listings where owner_profile_id = $1", [USERS.workerB]).catch(() => {});
  await loginAs(context, USERS.workerB);
  await asMode(context, "worker");
  await page.goto("/jobs");
  await page.locator("nav.bottom-nav").getByRole("link", { name: "E'lonlarim" }).click();
  await page.waitForURL(/\/cabinet\/elonlar$/);
  await expect(page.locator("[data-my-listings-empty]")).toHaveText("Hozircha e'loningiz yo'q.");
  await expect(page.getByRole("link", { name: "E'lon joylash" })).toHaveAttribute("href", "/chat?post=new");

  // mehmon — kirishga (qaytish manzili bilan)
  await asGuest(context);
  await page.goto("/cabinet/elonlar");
  await expect(page).toHaveURL(/\/auth\?next=%2Fcabinet%2Felonlar/);
});
