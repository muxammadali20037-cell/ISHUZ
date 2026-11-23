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

// 2026-11-21 (ega: "kirgan zahoti chat"): mehmon bosh sahifasi ham chat — "Bo'limlar" menyusi va "Yangi ishlar" ro'yxati
// olib tashlandi (ularning testlari ham); chat — guided-chat.spec.ts
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
    // bosh ekrandagi qidiruv qatori — ish beruvchida ishchilar (2026-11-23)
    await expect(page.getByRole("searchbox", { name: "Qanday ishchi kerak" })).toBeVisible();
    expect((await context.cookies()).find((c) => c.name === "ib_mode")?.value).toBe("employer");
    expect(await role(USERS.workerA)).toBe("employer");

    await loginAs(context, USERS.employer);
    await asMode(context, "employer");
    await page.goto("/cabinet");
    await fold(page, "more").locator("[data-fold-toggle]").click();
    await expect(page.locator("main [data-role-switch]")).toHaveText(/Ish izlovchiga o'tish/);
    await page.locator("main [data-role-switch]").click();
    await page.waitForURL(/\/chat$/);
    await expect(page.getByRole("searchbox", { name: "Kasb yoki lavozim" })).toBeVisible();
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
  // kompyuterda — chap yon menyu: birinchi — chat (2026-11-21: Qidiruv · E'lonlarim · Xabarlar · Profil)
  await expect(p.locator("aside").getByRole("link").filter({ hasText: /^Qidiruv$/ }).first()).toBeVisible();
  await expect(p.locator("aside").getByRole("link", { name: /^Yordamchi/ })).toHaveCount(0);
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
  await expect(quick.locator("[data-quick]")).toHaveText([/Ish qidirish/, /CV yaratish/]);
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
