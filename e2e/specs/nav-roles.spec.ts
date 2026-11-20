import { expect, test } from "@playwright/test";
import { USERS, asMode, loginAs, sql } from "../support";

/**
 * Ega (2026-11-18): ish izlovchida o'rtadagi "Arizalar" o'rnida "Ish beruvchilar" ro'yxati (alohida belgi — bino);
 * arizalar — bosh sahifadagi "Arizalarim" qatorida. Ish beruvchida "Vakansiyalar" → "E'lonlarim", "Nomzodlar" → "Ishchilar"
 * (darhol barcha ishchi e'lonlari).
 */
test("ish izlovchi: «Ish beruvchilar» — qisqa ro'yxat; «Arizalarim» — bosh sahifada", async ({ page, context }) => {
  await loginAs(context, USERS.workerA);
  await asMode(context, "worker");
  await page.goto("/");
  const nav = page.locator("nav.bottom-nav");
  await expect(nav.getByRole("link")).toHaveText(["Bosh sahifa", "Ishlar", "Ish beruvchilar", "Xabarlar", "Profil"]);
  // nom to'liq sig'adi (kesilmaydi)
  const fits = await nav.getByRole("link", { name: "Ish beruvchilar" }).locator("span").last().evaluate((el) => el.scrollWidth <= el.clientWidth);
  expect(fits).toBe(true);

  const [apps] = await sql<{ n: string }>(
    "select count(*)::text as n from public.applications a join public.worker_profiles w on w.id = a.worker_id where w.profile_id = $1 and a.status <> 'withdrawn'",
    [USERS.workerA],
  );
  const row = page.locator("[data-home-row='my-applications']");
  // oqim (Suspense) almashguncha yashirin nusxa ham DOM'da bo'ladi — bitta qolishini kutamiz
  await expect(row).toHaveCount(1);
  await expect(row).toHaveAttribute("href", "/applications");
  await expect(row).toContainText("Arizalarim");
  const n = apps?.n ?? "0";
  if (Number(n) > 0) await expect(row.locator("[data-home-row-count]")).toHaveText(n);

  await nav.getByRole("link", { name: "Ish beruvchilar" }).click();
  await page.waitForURL(/\/companies$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ish beruvchilar");
  await expect(nav.getByRole("link", { name: "Ish beruvchilar" })).toHaveAttribute("aria-current", "page");
  // har bir qator — bitta qisqa satr: nomi, soha · hudud, ishlar soni (tavsif yo'q)
  const rows = page.locator("[data-employer-row]");
  if (await rows.count()) await expect(rows.first()).toContainText(/\d+ ta ish/);
});

test("ish beruvchi: «E'lonlarim» va «Ishchilar» — darhol barcha ishchi e'lonlari", async ({ page, context }) => {
  // ish beruvchi profili to'ldirilgan bo'lsin (aks holda bo'limlar o'rniga profil ekrani)
  await sql(
    `insert into public.employer_profiles (profile_id, employer_type, display_name, onboarding_completed_at)
     values ($1, 'person', 'Dilnoza opa', now()) on conflict (profile_id) do nothing`,
    [USERS.employer],
  );
  await loginAs(context, USERS.employer);
  await asMode(context, "employer");
  await page.goto("/");
  const nav = page.locator("nav.bottom-nav");
  await expect(nav.getByRole("link")).toHaveText(["Boshqaruv", "E'lonlarim", "E'lon", "Ishchilar", "Profil"]);

  await nav.getByRole("link", { name: "E'lonlarim" }).click();
  await page.waitForURL(/\/employer\/vacancies$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("E'lonlarim");

  await nav.getByRole("link", { name: "Ishchilar" }).click();
  await page.waitForURL(/\/search\?mode=workers&any=1&region=all$/);
  await expect(nav.getByRole("link", { name: "Ishchilar" })).toHaveAttribute("aria-current", "page");
  // kasb tanlash bosqichi emas — natijalar (ro'yxat) darhol
  await expect(page.getByRole("heading", { name: "Qanday mutaxassis kerak?" })).toHaveCount(0);
});
