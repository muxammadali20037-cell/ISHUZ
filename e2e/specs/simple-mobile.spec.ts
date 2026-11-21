import { expect, test, type Page } from "@playwright/test";
import { USERS, asGuest, asMode, loginAs, sql, stack } from "../support";

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

// 2026-11-20 (ega: "kirgandan keyin chatga kirsin"): kirgan foydalanuvchining "/" — chat (/chat); bo'limlar menyusi endi mehmon
// bosh sahifasida (kirganniki — rol almashtirish, "E'lonlarim" va "Yangi ishlar" qatorlari bilan — ochilmaydi)
test("mehmon (ish izlovchi), telefon: bosh sahifada bo'limlar menyusi (izohli, rangsiz)", async ({ page, context }) => {
  await asGuest(context);
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
  // mehmonda rol almashtirish menyuda yo'q (u — kirgan foydalanuvchining Profilida)
  await expect(menu.locator("[data-role-switch]")).toHaveCount(0);
  // bosh menyu rangsiz (ega, 2026-11-17: "ranglar umuman yoqmayapti"): boshqa belgi va nomlar bir xil rangda, "yangi" nuqtalari
  // yo'q; faqat Universal ustalar — ko'k (ega: "faqat ustalarni ko'k rang bilan ajratib qo'y")
  const others = menu.locator("[data-menu-item]:not([data-menu-item='masters'])");
  const tileColors = await others.locator(":scope > span:first-child").evaluateAll((els) => els.map((e) => getComputedStyle(e).color + "|" + getComputedStyle(e).backgroundColor));
  expect(new Set(tileColors).size).toBe(1);
  const labelColors = await others.locator("span.font-bold").evaluateAll((els) => els.map((e) => getComputedStyle(e).color));
  expect(new Set(labelColors).size).toBe(1);
  const blue = await page.evaluate(() => {
    const probe = document.createElement("span");
    probe.className = "text-primary-ink";
    document.body.append(probe);
    const c = getComputedStyle(probe).color;
    probe.remove();
    return c;
  });
  const masters = menu.locator("[data-menu-item='masters']");
  expect(await masters.locator(":scope > span:first-child").evaluate((e) => getComputedStyle(e).color)).toBe(blue);
  expect(await masters.locator("span.font-bold").evaluate((e) => getComputedStyle(e).color)).toBe(blue);
  expect(labelColors[0]).not.toBe(blue);
  await expect(menu.locator("[data-new-dot]")).toHaveCount(0);
  // pastki qismda huquqiy havolalar bor (mehmonda — to'liq footer)
  const footer = page.getByRole("contentinfo");
  await expect(footer.getByRole("link", { name: "Foydalanish shartlari" })).toBeVisible();
  // gorizontal toshish yo'q
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
});

test("rol almashtirish — Profilda bir bosishda: ish izlovchi → ish beruvchi va qaytib (asosiy ekran — chat — o'sha rolda)", async ({ page, context }) => {
  const role = async (id: string) => (await sql<{ active_role: string | null }>("select active_role from public.profiles where id = $1", [id]))[0]!.active_role;
  const beforeA = await role(USERS.workerA);
  const beforeE = await role(USERS.employer);
  try {
    await loginAs(context, USERS.workerA);
    await asMode(context, "worker");
    await page.goto("/cabinet");
    // 2026-11-21: rol almashtirish — "Boshqa sozlamalar" ichida
    await fold(page, "more").locator("[data-fold-toggle]").click();
    await page.locator("main [data-role-switch]").click();
    await page.waitForURL(/\/chat$/);
    await expect(page.getByPlaceholder("Kim kerak: kasb, tuman…")).toBeVisible();
    expect((await context.cookies()).find((c) => c.name === "ib_mode")?.value).toBe("employer");
    expect(await role(USERS.workerA)).toBe("employer");

    await loginAs(context, USERS.employer);
    await asMode(context, "employer");
    await page.goto("/cabinet");
    await fold(page, "more").locator("[data-fold-toggle]").click();
    await expect(page.locator("main [data-role-switch]")).toHaveText(/Ish izlovchiga o'tish/);
    await page.locator("main [data-role-switch]").click();
    await page.waitForURL(/\/chat$/);
    await expect(page.getByPlaceholder("Kasb, tuman, maosh…")).toBeVisible();
    expect((await context.cookies()).find((c) => c.name === "ib_mode")?.value).toBe("worker");
  } finally {
    await sql("update public.profiles set active_role = $2 where id = $1", [USERS.workerA, beforeA]);
    await sql("update public.profiles set active_role = $2 where id = $1", [USERS.employer, beforeE]);
  }
});

test("ish beruvchi paneli (/employer), telefon: haqiqiy raqamlar; kompyuterda yon menyu — chat birinchi", async ({ page, context, browser }) => {
  await loginAs(context, USERS.employer);
  await asMode(context, "employer");
  // 2026-11-20: "/" — chat; panel o'z manzilida (Profil bo'limi ichida)
  await page.goto("/employer");
  // qisqa ko'rsatkichlar (haqiqiy raqamlar) — telefonda ham bor
  await expect(page.getByRole("group", { name: "Qisqa ko'rsatkichlar" })).toBeVisible();

  const desk = await browser.newContext({ baseURL: stack.app, viewport: { width: 1280, height: 900 } });
  await loginAs(desk, USERS.employer);
  await asMode(desk, "employer");
  const p = await desk.newPage();
  await p.goto("/employer");
  // kompyuterda — chap yon menyu: birinchi — chat (2026-11-21: Chat · E'lonlarim · Xabarlar · Profil)
  await expect(p.locator("aside").getByRole("link").filter({ hasText: /^Chat$/ }).first()).toBeVisible();
  await expect(p.locator("aside").getByRole("link", { name: /^Yordamchi/ })).toHaveCount(0);
  await desk.close();
});

test("kompyuterda (mehmon bosh sahifasi) yangi ishlar ochiq (yig'ish tugmasi yo'q)", async ({ browser }) => {
  const desk = await browser.newContext({ baseURL: stack.app, viewport: { width: 1280, height: 900 } });
  await asGuest(desk);
  await asMode(desk, "worker");
  const p = await desk.newPage();
  await p.goto("/");
  await expect(p.locator('[data-home-row="new-jobs"]')).toBeHidden();
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

test("Profil — sodda (2026-11-21, master prompt): ism, telefon, til, chiqish; qolgani — yig'ma «Boshqa sozlamalar» ichida", async ({ page, context }) => {
  await loginAs(context, USERS.workerA);
  await asMode(context, "worker");
  await page.goto("/cabinet");
  await expect(page.getByRole("heading", { level: 1, name: "Profil" })).toBeVisible();
  // profil kartasi: ism, rol, telefon qatori (raqam yoki "qo'shilmagan"), ismni o'zgartirish
  const card = page.locator("[data-profile-card]");
  await expect(card).toContainText("Anvar Aliyev");
  await expect(card).toContainText("Ish izlovchi");
  await expect(card.locator("[data-profile-phone]")).toBeVisible();
  await expect(card.getByRole("link", { name: "Ismni o'zgartirish" })).toHaveAttribute("href", "/profile/edit");
  // asosiy qatorlar: til (joriy til nomi bilan); ish izlovchida to'lovlar qatori yo'q
  await expect(page.locator("[data-cabinet-row='language']")).toContainText("O'zbekcha");
  await expect(page.locator("[data-cabinet-row='billing']")).toHaveCount(0);
  // faqat bitta yig'ma bo'lim — "Boshqa sozlamalar", yopiq
  expect(await page.locator("main [data-fold]").evaluateAll((els) => els.map((e) => e.getAttribute("data-fold")))).toEqual(["more"]);
  const more = fold(page, "more");
  await expect(more.locator("[data-fold-toggle]")).toHaveAttribute("aria-expanded", "false");
  await expect(more).toContainText("Boshqa sozlamalar");
  const links = page.locator("[data-cabinet-links]");
  await expect(links).toBeHidden();
  // chiqish — hech narsani ochmasdan ko'rinadi
  await expect(page.locator("[data-cabinet-logout]")).toBeVisible();
  // "Boshqa sozlamalar" ichida hech narsa yo'qolmagan: rol, saqlanganlar, sozlamalar, yordam
  await more.locator("[data-fold-toggle]").click();
  await expect(more.locator("[data-role-switch]")).toContainText("Ish beruvchiga o'tish");
  await expect(links.getByRole("link", { name: "Saqlanganlar" })).toBeVisible();
  await expect(links.getByRole("link", { name: "Sozlamalar" })).toBeVisible();
  await expect(links.getByRole("link", { name: "Yordam", exact: true })).toHaveAttribute("href", "/help");
  const main = page.locator("main");
  await expect(main).not.toContainText("Mening dunyom");
  await expect(main.locator("[data-ai-entry], [data-masters-entry]")).toHaveCount(0);
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
