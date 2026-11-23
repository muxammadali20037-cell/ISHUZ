import { expect, test } from "@playwright/test";
import { USERS, asMode, loginAs, sql } from "../support";

/**
 * Pastki menyu va rollar (ega, 2026-11-21, master prompt): ikkala rolda bir xil bo'limlar — Qidiruv · E'lonlarim · Profil;
 * 2026-11-23 (ega): boshida "Bosh sahifa" ("/").
 * "E'lonlarim" — faqat joriy rolning e'lonlari, tepada Faol · Yopilgan · Muddati tugagan yorliqlari; ish beruvchida
 * "Arizalar", ish izlovchida "Sizga mos" — shu bo'lim ichida.
 */
const TABS = ["Bosh sahifa", "Qidiruv", "E'lonlarim", "Profil"];

test("ish izlovchi: 4 ta bo'lim, nomlar sig'adi; «E'lonlarim» — o'z e'lonlari; «Profil» belgilanadi", async ({ page, context }) => {
  await loginAs(context, USERS.workerA);
  await asMode(context, "worker");
  await page.goto("/jobs");
  const nav = page.locator("nav.bottom-nav");
  await expect(nav.getByRole("link")).toHaveText(TABS);
  // nomlar to'liq sig'adi (kesilmaydi)
  for (const name of TABS) {
    const fits = await nav.getByRole("link", { name }).locator("span").last().evaluate((el) => el.scrollWidth <= el.clientWidth);
    expect(fits, name).toBe(true);
  }

  await nav.getByRole("link", { name: "E'lonlarim" }).click();
  await page.waitForURL(/\/cabinet\/elonlar$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("E'lonlarim");
  // yorliqlar: Faol · Yopilgan · Muddati tugagan; "Faol" ochiq
  await expect(page.locator("[data-bucket-tab]")).toHaveCount(3);
  await expect(page.locator("[data-bucket-tab]")).toHaveText([/^Faol/, /^Yopilgan/, /^Tugagan/]);
  // yorliq nomlari kesilmaydi (390 va 320 px)
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 800 });
    const cut = await page.locator("[data-bucket-tab] span.truncate").evaluateAll((els) => els.filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent));
    expect(cut, `${width}px`).toEqual([]);
  }
  await expect(page.locator("[data-bucket-tab='active']")).toHaveAttribute("aria-current", "page");
  await page.locator("[data-bucket-tab='closed']").click();
  await page.waitForURL(/\/cabinet\/elonlar\?holat=yopilgan$/);
  await expect(page.locator("[data-bucket-tab='closed']")).toHaveAttribute("aria-current", "page");
  await expect(nav.getByRole("link", { name: "E'lonlarim" })).toHaveAttribute("aria-current", "page");
  await expect(nav.getByRole("link", { name: "Profil" })).not.toHaveAttribute("aria-current", "page");

  await nav.getByRole("link", { name: "Profil" }).click();
  await page.waitForURL(/\/cabinet$/);
  await expect(nav.getByRole("link", { name: "Profil" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { level: 1, name: "Profil" })).toBeVisible();
});

test("ish beruvchi: «E'lonlarim» — vakansiyalari; ishchilar ro'yxati — Qidiruv bo'limida", async ({ page, context }) => {
  // ish beruvchi profili to'ldirilgan bo'lsin (aks holda bo'limlar o'rniga profil ekrani)
  await sql(
    `insert into public.employer_profiles (profile_id, employer_type, display_name, onboarding_completed_at)
     values ($1, 'person', 'Dilnoza opa', now()) on conflict (profile_id) do nothing`,
    [USERS.employer],
  );
  await loginAs(context, USERS.employer);
  await asMode(context, "employer");
  await page.goto("/chat");
  const nav = page.locator("nav.bottom-nav");
  await expect(nav.getByRole("link")).toHaveText(TABS);
  for (const name of TABS) {
    const fits = await nav.getByRole("link", { name }).locator("span").last().evaluate((el) => el.scrollWidth <= el.clientWidth);
    expect(fits, name).toBe(true);
  }

  await nav.getByRole("link", { name: "E'lonlarim" }).click();
  await page.waitForURL(/\/cabinet\/elonlar$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("E'lonlarim");

  await page.goto("/search?mode=workers&any=1&region=all");
  await expect(nav.getByRole("link", { name: "Qidiruv" })).toHaveAttribute("aria-current", "page");
  // kasb tanlash bosqichi emas — natijalar (ro'yxat) darhol
  await expect(page.getByRole("heading", { name: "Qanday mutaxassis kerak?" })).toHaveCount(0);
  // eski ish beruvchi manzillari va arizalar ham "E'lonlarim" bo'limida
  for (const path of ["/employer/vacancies", "/employer/applications"]) {
    await page.goto(path);
    await expect(nav.getByRole("link", { name: "E'lonlarim" }), path).toHaveAttribute("aria-current", "page");
  }
});
