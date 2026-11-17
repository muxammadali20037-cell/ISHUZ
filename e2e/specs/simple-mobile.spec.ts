import { expect, test, type Page } from "@playwright/test";
import { USERS, asMode, loginAs, sql, stack } from "../support";

/**
 * Soddalashtirish (2026-11-15, ega: "telefonda kirganda kategoriyalar chiqsin — chap menyudagidek, har birining ostida kichik
 * harf bilan nima qilishi; eng tagida rolni o'zgartirish (2026-11-17: rangsiz); AI o'rniga tushunarli so'z; bugungi va yangi ishlar —
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

test("ish izlovchi, telefon: bosh sahifada bo'limlar menyusi (izohli, rangsiz), eng tagida rol almashtirish; yangi ishlar yig'ilgan", async ({ page, context }) => {
  await loginAs(context, USERS.workerA);
  await asMode(context, "worker");
  await page.goto("/");
  const menu = page.locator("[data-home-menu]");
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("heading", { name: "Bo'limlar" })).toBeVisible();
  // ega (2026-11-17, uchinchi: "tartibsiz — pastki menyuda bor narsalar, profildagi sozlamalar bosh sahifada ham bor"):
  // faqat boshqa joyda yo'q 6 ta yo'l, bitta ustunda; "E'lon joylash" — tepada
  const order = ["masters", "ai", "daily", "remote", "noexp", "near"];
  expect(await menu.locator("[data-menu-item]").evaluateAll((els) => els.map((e) => e.getAttribute("data-menu-item")))).toEqual(order);
  await expect(menu.locator('[data-menu-item="post"]')).toHaveCount(0);
  await expect(menu.locator('[data-menu-item="daily"]')).toContainText("Kunlik ish");
  await expect(menu.locator('[data-menu-item="remote"]')).toContainText("Masofaviy ish");
  await expect(menu.locator('[data-menu-item="noexp"]')).toContainText("Tajriba talab qilinmaydigan ishlar");
  await expect(menu.locator('[data-menu-item="near"]')).toContainText("Yaqin atrofdagi ishlar");
  // takrorlar yo'q: pastki menyudagilar (ishlar, arizalar, xabarlar, profil) va Profildagilar (saqlanganlar, sozlamalar, yordam)
  for (const key of ["jobs", "map", "applications", "saved", "messages", "profile", "settings", "help"]) {
    await expect(menu.locator(`[data-menu-item="${key}"]`)).toHaveCount(0);
  }
  // bitta ustun: hamma qatorlar bir xil chap chetda
  const lefts = await menu.locator("[data-menu-item]").evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().left)));
  expect(new Set(lefts).size).toBe(1);
  // tepadagi tez qidiruv kartochkalari yo'q — hammasi bo'limlarda
  await expect(page.locator("[data-home-shortcuts]")).toHaveCount(0);
  // har bir bo'lim — nomi va ostida kichik izoh (nima qiladi)
  await expect(menu.locator('[data-menu-item="daily"]')).toContainText("Bugun ishlab, bugun haq olish");
  // "AI" so'zi yo'q — "Yordamchi" (2026-11-15; avval "Barchasi siz uchun")
  await expect(menu.locator('[data-menu-item="ai"]')).toContainText("Yordamchi");
  await expect(menu).not.toContainText("AI");
  for (const key of order) {
    await expect(menu.locator(`[data-menu-item="${key}"]`)).toBeVisible();
  }
  // eng tagida — "Ish beruvchiga o'tish" (2026-11-17: rangsiz — qizil emas)
  const sw = menu.locator("[data-role-switch]");
  await expect(sw).toHaveText(/Ish beruvchiga o'tish/);
  await expect(menu.locator(":scope > *").last()).toHaveAttribute("data-role-switch", "employer");
  await expect(sw).not.toHaveClass(/text-destructive/);
  // bosh menyu rangsiz (ega, 2026-11-17: "ranglar umuman yoqmayapti"): hamma belgi va nom bir xil rangda, "yangi" nuqtalari yo'q
  const tileColors = await menu.locator("[data-menu-item] > span:first-child").evaluateAll((els) => els.map((e) => getComputedStyle(e).color + "|" + getComputedStyle(e).backgroundColor));
  expect(new Set(tileColors).size).toBe(1);
  const labelColors = await menu.locator("[data-menu-item] span.font-bold").evaluateAll((els) => els.map((e) => getComputedStyle(e).color));
  expect(new Set(labelColors).size).toBe(1);
  await expect(menu.locator("[data-new-dot]")).toHaveCount(0);
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
    await expect(menu.locator('[data-menu-item="exp"]')).toContainText("Tajribali ishchi");
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

test("Profil: tepada rolni almashtirish; sodda — «Mening dunyom», «O'zim haqimda e'lon», Yordamchi, Universal ustalar yo'q; bitta ro'yxat", async ({ page, context }) => {
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
  // faqat ikkita yig'ilgan bo'lim: e'lonlarim va PRO kuzatuv (ega, 2026-11-17: "profil juda chalkash")
  expect(await page.locator("main [data-fold]").evaluateAll((els) => els.map((e) => e.getAttribute("data-fold")))).toEqual(["my-listings", "pro"]);
  for (const name of ["my-listings", "pro"]) {
    await expect(fold(page, name).locator("[data-fold-toggle]")).toHaveAttribute("aria-expanded", "false");
  }
  await expect(fold(page, "my-listings").locator("[data-fold-toggle]")).toContainText("Ko'rish");
  const main = page.locator("main");
  await expect(main).not.toContainText("Mening dunyom");
  await expect(main).not.toContainText("O'zim haqimda e'lon");
  await expect(main.locator("[data-ai-entry], [data-masters-entry]")).toHaveCount(0);
  // bitta oddiy ro'yxat, chiqish tugmasi oxirida — hech narsani ochmasdan ko'rinadi
  const links = page.locator("[data-cabinet-links]");
  await expect(links.getByRole("link", { name: "Saqlanganlar" })).toBeVisible();
  await expect(links.getByRole("link", { name: "Sozlamalar" })).toBeVisible();
  // "Yordam" — bosh sahifadan shu yerga ko'chdi (2026-11-17)
  await expect(links.getByRole("link", { name: "Yordam", exact: true })).toHaveAttribute("href", "/help");
  await expect(links.getByRole("button", { name: "Hisobdan chiqish" })).toBeVisible();
  // eski "Rolni o'zgartirish" havolasi takrorlanmaydi
  await expect(page.getByRole("link", { name: "Rolni o'zgartirish" })).toHaveCount(0);
  // eski /dunyo manzili — profilga
  await page.goto("/dunyo");
  await expect(page).toHaveURL(/\/cabinet$/);
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
