import { expect, test, type Page } from "@playwright/test";
import { USERS, asMode, loginAs, sql, stack } from "../support";

/**
 * Soddalashtirish (2026-11-15, ega: "telefonda kirganda kategoriyalar chiqsin — chap menyudagidek, har birining ostida kichik
 * harf bilan nima qilishi; eng tagida qizilda rolni o'zgartirish; AI o'rniga tushunarli so'z; bugungi va yangi ishlar —
 * ichiga yashirilsin («ochish», «ko'rish»); profil ixcham, rolni o'zgartirish eng tepada; ustalarda «E'lon joylash» yozuvi").
 */

const fold = (page: Page, name: string) => page.locator(`[data-fold="${name}"]`);

test.beforeEach(async () => {
  await sql(
    `insert into public.employer_profiles (profile_id, employer_type, display_name, onboarding_completed_at)
     values ($1, 'person', 'Bekzod aka', now()) on conflict (profile_id) do nothing`,
    [USERS.employer],
  );
});

test("ish izlovchi, telefon: bosh sahifada bo'limlar menyusi (izohli), eng tagida qizil rol almashtirish; yangi ishlar yig'ilgan", async ({ page, context }) => {
  await loginAs(context, USERS.workerA);
  await asMode(context, "worker");
  await page.goto("/");
  const menu = page.locator("[data-home-menu]");
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("heading", { name: "Bo'limlar" })).toBeVisible();
  // har bir bo'lim — nomi va ostida kichik izoh (nima qiladi)
  const jobs = menu.locator('[data-menu-item="jobs"]');
  await expect(jobs).toContainText("Vakansiyalar");
  await expect(jobs).toContainText("Barcha ishlar");
  await expect(menu.locator('[data-menu-item="map"]')).toContainText("Yaqin atrofdagi ishlar");
  // "AI" so'zi yo'q — "Yordamchi" (2026-11-15; avval "Barchasi siz uchun")
  await expect(menu.locator('[data-menu-item="ai"]')).toContainText("Yordamchi");
  await expect(menu).not.toContainText("AI");
  for (const key of ["ai", "jobs", "map", "applications", "saved", "messages", "profile", "masters", "settings", "help"]) {
    await expect(menu.locator(`[data-menu-item="${key}"]`)).toBeVisible();
  }
  // eng tagida — qizil "Ish beruvchiga o'tish"
  const sw = menu.locator("[data-role-switch]");
  await expect(sw).toHaveText(/Ish beruvchiga o'tish/);
  await expect(menu.locator(":scope > *").last()).toHaveAttribute("data-role-switch", "employer");
  await expect(sw).toHaveClass(/text-destructive/); // qizil
  // menyu sahifadagi oxirgi bo'lim (rol almashtirish eng tagida — yangi ishlar undan oldin)
  const feedY = (await fold(page, "home-feed").boundingBox())!.y;
  expect((await sw.boundingBox())!.y).toBeGreaterThan(feedY);
  // yangi ishlar — yopiq: "Yangi ishlar … Ko'rish"; bosilsa ochiladi
  const toggle = fold(page, "home-feed").locator("[data-fold-toggle]");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(toggle).toContainText("Ko'rish");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(toggle).toContainText("Yopish");
  // pastki qism ixcham: katta havolalar ro'yxati yo'q, huquqiy havolalar bor
  const footer = page.getByRole("contentinfo");
  await expect(footer.getByText("Ish izlovchilarga", { exact: true })).toBeHidden();
  await expect(footer.getByRole("link", { name: "Foydalanish shartlari" })).toBeVisible();
  // gorizontal toshish yo'q
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
});

test("rol almashtirish — bir bosishda: ish izlovchi → ish beruvchi va qaytib (bosh sahifa o'sha rolda ochiladi)", async ({ page, context }) => {
  const role = async (id: string) => (await sql<{ active_role: string | null }>("select active_role from public.profiles where id = $1", [id]))[0]!.active_role;
  const beforeA = await role(USERS.workerA);
  const beforeE = await role(USERS.employer);
  try {
    await loginAs(context, USERS.workerA);
    await asMode(context, "worker");
    await page.goto("/");
    await page.locator("[data-home-menu] [data-role-switch]").click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Qanday xodim kerak?");
    expect((await context.cookies()).find((c) => c.name === "ib_mode")?.value).toBe("employer");
    expect(await role(USERS.workerA)).toBe("employer");

    await loginAs(context, USERS.employer);
    await asMode(context, "employer");
    await page.goto("/");
    const menu = page.locator("[data-home-menu]");
    await expect(menu.locator('[data-menu-item="my_vacancies"]')).toContainText("Joylagan vakansiyalar");
    await expect(menu.locator("[data-role-switch]")).toHaveText(/Ish izlovchiga o'tish/);
    await menu.locator("[data-role-switch]").click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Qanday ish qidiryapsiz?");
    expect((await context.cookies()).find((c) => c.name === "ib_mode")?.value).toBe("worker");
  } finally {
    await sql("update public.profiles set active_role = $2 where id = $1", [USERS.workerA, beforeA]);
    await sql("update public.profiles set active_role = $2 where id = $1", [USERS.employer, beforeE]);
  }
});

test("ish beruvchi, telefon: raqamlar va menyu; uzun ro'yxatlar telefonda yo'q (kompyuterda bor)", async ({ page, context, browser }) => {
  await loginAs(context, USERS.employer);
  await asMode(context, "employer");
  await page.goto("/");
  await expect(page.locator("[data-home-menu]")).toBeVisible();
  // qisqa ko'rsatkichlar (haqiqiy raqamlar) — telefonda ham bor
  await expect(page.getByRole("group", { name: "Qisqa ko'rsatkichlar" })).toBeVisible();
  // vakansiya joylash — katta tugma, izohsiz
  await expect(page.getByRole("link", { name: "Vakansiya joylash" }).first()).toBeVisible();

  const desk = await browser.newContext({ baseURL: stack.app, viewport: { width: 1280, height: 900 } });
  await loginAs(desk, USERS.employer);
  await asMode(desk, "employer");
  const p = await desk.newPage();
  await p.goto("/");
  // kompyuterda — chap yon menyu bor, bosh sahifa menyusi yo'q
  await expect(p.locator("[data-home-menu]")).toBeHidden();
  await expect(p.locator("aside").getByRole("link", { name: /^Yordamchi/ })).toBeVisible();
  await desk.close();
});

test("kompyuterda yangi ishlar ochiq (yig'ish tugmasi yo'q)", async ({ browser }) => {
  const desk = await browser.newContext({ baseURL: stack.app, viewport: { width: 1280, height: 900 } });
  await loginAs(desk, USERS.workerA);
  await asMode(desk, "worker");
  const p = await desk.newPage();
  await p.goto("/");
  await expect(p.locator("[data-home-menu]")).toBeHidden();
  await expect(fold(p, "home-feed").locator("[data-fold-toggle]")).toBeHidden();
  await expect(p.locator("#home-feed")).toBeVisible();
  await desk.close();
});

test("'Yordamchi': alohida to'liq ekran (menyular yo'q); bugungi ishlar yopiq — «Ochish» bilan ochiladi; tezkor imkoniyatlar ekranda", async ({ page, context }) => {
  await loginAs(context, USERS.workerA);
  await asMode(context, "worker");
  await page.goto("/ai");
  await expect(page.getByRole("heading", { level: 1, name: "Yordamchi" })).toBeVisible();
  // alohida ekran: yuqori panel, pastki menyu yo'q; yozish maydoni ekran tagida
  await expect(page.locator("nav.bottom-nav")).toHaveCount(0);
  await expect(page.locator("header [data-bar-logo]")).toHaveCount(0);
  const composer = await page.getByLabel("Nima qidiryapsiz?").boundingBox();
  expect(composer!.y + composer!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  // tezkor imkoniyatlar (2026-11-16: erkin suhbat yo'q): ish qidirish, CV, xabarlar — hammasi ekranda (yonga surilmaydi);
  // "Masalan, bosing" yo'q
  const quick = page.locator("[data-ai-quick]:visible");
  await expect(quick.locator("[data-quick]")).toHaveText([/Ish qidirish/, /CV yaratish/, /PRO kuzatuv/]);
  for (const box of await quick.locator("[data-quick]").evaluateAll((els) => els.map((e) => e.getBoundingClientRect().right))) {
    expect(box).toBeLessThanOrEqual(390);
  }
  await expect(page.getByText("Masalan, bosing:")).toHaveCount(0);
  const brief = fold(page, "ai-brief");
  const toggle = brief.locator("[data-fold-toggle]");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(toggle).toContainText("Ochish");
  await expect(page.locator("[data-ai-brief]")).toBeHidden();
  await toggle.click();
  await expect(page.locator("[data-ai-brief] li").first()).toBeVisible();
});

test("Profil: tepada rolni almashtirish, bo'limlar yig'ilgan («Ko'rish», «Ochish»)", async ({ page, context }) => {
  await loginAs(context, USERS.workerA);
  await asMode(context, "worker");
  await page.goto("/cabinet");
  await expect(page.getByRole("heading", { level: 1, name: "Profil" })).toBeVisible();
  // rolni almashtirish — sarlavhadan keyingi birinchi narsa
  const sw = page.locator("main [data-role-switch]");
  await expect(sw).toHaveText(/Ish beruvchiga o'tish/);
  await expect(sw).toContainText("Hozir: Ish izlovchi");
  const h1Box = (await page.getByRole("heading", { level: 1 }).boundingBox())!;
  const swBox = (await sw.boundingBox())!;
  expect(swBox.y).toBeGreaterThan(h1Box.y);
  expect(swBox.y - (h1Box.y + h1Box.height)).toBeLessThan(40);
  for (const name of ["my-listings", "world", "pro", "links-activity", "links-account"]) {
    await expect(fold(page, name).locator("[data-fold-toggle]")).toHaveAttribute("aria-expanded", "false");
  }
  await expect(fold(page, "my-listings").locator("[data-fold-toggle]")).toContainText("Ko'rish");
  // "Hisob" ochilsa — chiqish tugmasi
  await fold(page, "links-account").locator("[data-fold-toggle]").click();
  await expect(page.getByRole("button", { name: "Hisobdan chiqish" })).toBeVisible();
  // eski "Rolni o'zgartirish" havolasi takrorlanmaydi
  await expect(page.getByRole("link", { name: "Rolni o'zgartirish" })).toHaveCount(0);
});

test("Universal ustalar, telefon: sarlavhada «E'lon joylash» yozuvi (faqat «+» emas), 320 px da ham sig'adi", async ({ browser }) => {
  for (const width of [320, 360, 390]) {
    const ctx = await browser.newContext({ baseURL: stack.app, viewport: { width, height: 800 } });
    await loginAs(ctx, USERS.workerA);
    const p = await ctx.newPage();
    await p.goto("/ustalar");
    const post = p.locator("[data-masters-post]");
    await expect(post, `${width}px`).toHaveText(/E'lon joylash/);
    expect(await post.evaluate((el) => el.scrollWidth <= el.clientWidth + 1), `${width}px`).toBe(true);
    expect(await p.evaluate(() => document.documentElement.scrollWidth - innerWidth), `${width}px`).toBeLessThanOrEqual(0);
    await ctx.close();
  }
});
