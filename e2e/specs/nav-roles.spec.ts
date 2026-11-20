import { expect, test } from "@playwright/test";
import { USERS, asMode, loginAs, sql } from "../support";

/**
 * Pastki menyu va rollar.
 * 2026-11-20 (ega: "ilova chalkash — pastda faqat Ishchilar, Ishlar, E'lonlarim, Izlash va e'lon berish, Profil"): ikkala
 * rolda bir xil 5 ta bo'lim. "E'lonlarim" — o'zi joylagan barcha e'lonlar (o'zi haqida, vakansiyalar, usta e'lonlari);
 * vakansiya kartasidan — arizalari. "Ishchilar" — darhol barcha ishchi e'lonlari.
 */
const TABS = ["Ishchilar", "Ishlar", "Izlash/E'lon", "E'lonlarim", "Profil"];

test("ish izlovchi: 5 ta bo'lim, nomlar sig'adi; «E'lonlarim» — o'z e'lonlari; «Profil» belgilanadi", async ({ page, context }) => {
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
  await expect(nav.getByRole("link", { name: "E'lonlarim" })).toHaveAttribute("aria-current", "page");
  await expect(nav.getByRole("link", { name: "Profil" })).not.toHaveAttribute("aria-current", "page");

  await nav.getByRole("link", { name: "Profil" }).click();
  await page.waitForURL(/\/cabinet$/);
  await expect(nav.getByRole("link", { name: "Profil" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { level: 1, name: "Profil" })).toBeVisible();
});

test("ish beruvchi: «E'lonlarim» — vakansiyalari (arizalari bilan); «Ishchilar» — darhol barcha ishchi e'lonlari", async ({ page, context }) => {
  // ish beruvchi profili to'ldirilgan bo'lsin (aks holda bo'limlar o'rniga profil ekrani)
  await sql(
    `insert into public.employer_profiles (profile_id, employer_type, display_name, onboarding_completed_at)
     values ($1, 'person', 'Dilnoza opa', now()) on conflict (profile_id) do nothing`,
    [USERS.employer],
  );
  await loginAs(context, USERS.employer);
  await asMode(context, "employer");
  await page.goto("/jobs");
  const nav = page.locator("nav.bottom-nav");
  await expect(nav.getByRole("link")).toHaveText(TABS);

  await nav.getByRole("link", { name: "E'lonlarim" }).click();
  await page.waitForURL(/\/cabinet\/elonlar$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("E'lonlarim");

  await nav.getByRole("link", { name: "Ishchilar" }).click();
  await page.waitForURL(/\/search\?mode=workers&any=1&region=all$/);
  await expect(nav.getByRole("link", { name: "Ishchilar" })).toHaveAttribute("aria-current", "page");
  // kasb tanlash bosqichi emas — natijalar (ro'yxat) darhol
  await expect(page.getByRole("heading", { name: "Qanday mutaxassis kerak?" })).toHaveCount(0);
  // eski ish beruvchi manzillari ham "E'lonlarim" bo'limida
  await page.goto("/employer/vacancies");
  await expect(nav.getByRole("link", { name: "E'lonlarim" })).toHaveAttribute("aria-current", "page");
});
