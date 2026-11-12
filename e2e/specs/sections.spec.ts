import { expect, test, type Page } from "@playwright/test";
import { asGuest, asMode, sql } from "../support";

/**
 * S2 / 2026-10 · bo'limlar: bosilsa — o'sha bo'lim natijalari, faol filtr chip sifatida ko'rinadi va olib tashlanadi.
 * Ish qidiruvchi (2.0, 2026-11): bosh sahifada bo'limlar ro'yxati yo'q — bo'limlar natijalar sahifasidagi filtr oynasida.
 * Ish beruvchi (2.0) — bosh sahifada "Kunlik ishchilar" tez yo'li. /ai — aqlli qidiruv va "Sizga mos".
 */

const EMP = "7e2e0000-0000-4000-8000-000000000066";
const WRK = "7e2e0000-0000-4000-8000-000000000067";

const sections = (page: Page) => page.getByRole("region", { name: "Bo'limlar", exact: true });
const tile = (page: Page, name: string) => sections(page).getByRole("link", { name: new RegExp(`^${name}`) });

test.describe("bo'limlar", () => {
  test.beforeAll(async () => {
    await sql(
      `insert into auth.users (id, phone, phone_confirmed_at, raw_user_meta_data) values
         ($1, '+998901110066', now(), '{"first_name":"Sardor","last_name":"YaTT"}'),
         ($2, '+998901110067', now(), '{"first_name":"Kamol","last_name":"Kunlikov"}')
       on conflict (id) do nothing`,
      [EMP, WRK],
    );
    await sql(
      `insert into public.employer_profiles (profile_id, employer_type, display_name) values ($1, 'individual_entrepreneur', 'Sardor YaTT')
       on conflict (profile_id) do update set employer_type = excluded.employer_type`,
      [EMP],
    );
    await sql("delete from public.vacancies where owner_profile_id = $1", [EMP]);
    await sql(
      `insert into public.vacancies (owner_profile_id, title, region_id, description, status, salary_from, salary_type, experience_min_months, positions_count, published_at, expires_at)
       select $1, t.title, r.id, 'Sinov e''loni: ' || t.title || ', ish vaqti 9 dan 18 gacha', 'active', 250000, t.pay::public.salary_type, 0, t.pos, now(), now() + interval '10 days'
       from public.regions r, (values ('YaTT omborchi kunlik', 'daily', 1), ('YaTT qadoqlovchilar', 'monthly', 8)) as t(title, pay, pos)
       where r.slug = 'tashkent_city'`,
      [EMP],
    );
    await sql("delete from public.worker_profiles where profile_id = $1", [WRK]);
    await sql(
      `insert into public.worker_profiles (profile_id, headline, category_id, region_id, experience_level, onboarding_completed_at, is_public)
       select $1, 'Yuk tashuvchi (kunlik)', c.id, r.id, 'none', now(), true from public.categories c, public.regions r where c.slug = 'sales' and r.slug = 'tashkent_city'`,
      [WRK],
    );
    await sql(
      `insert into public.worker_preferences (worker_id, salary_type, availability) select id, 'daily', 'today' from public.worker_profiles where profile_id = $1
       on conflict (worker_id) do update set salary_type = 'daily', availability = 'today'`,
      [WRK],
    );
  });
  test.afterAll(async () => {
    await sql("delete from public.vacancies where owner_profile_id = $1", [EMP]);
    await sql("delete from public.worker_profiles where profile_id = $1", [WRK]);
  });

  test("ish qidiruvchi (2.0): bosh sahifada bo'limlar ro'yxati yo'q — bo'limlar natijalar sahifasidagi filtrda", async ({ page, context }) => {
    await asGuest(context);
    await asMode(context, "worker");
    await page.goto("/");
    // bosh sahifa — bitta qidiruv va yangi ishlar; bo'limlar plitkasi/ro'yxati yo'q (bir ekranda bitta vazifa)
    await expect(page.locator("#home-feed")).toBeVisible();
    await expect(sections(page)).toHaveCount(0);
    await expect(page.locator("#home-sections")).toHaveCount(0);
    // "Filtrlar bilan qidirish" → natijalar; filtr oynasida ish beruvchi turi (YaTT va boshqalar), ommaviy va TOP bo'limlari
    await page.getByRole("main").getByRole("link", { name: "Filtrlar bilan qidirish" }).click();
    await page.waitForURL(/\/search\?mode=jobs&region=all&any=1$/);
    await page.getByRole("button", { name: /^Filtr/ }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Yakka tartibdagi tadbirkorlar")).toBeVisible();
    await expect(dialog.getByRole("checkbox", { name: /^Ommaviy/ })).toBeVisible();
    await expect(dialog.getByRole("checkbox", { name: "TOP e'lonlar" })).toBeVisible();
    // tanlansa — o'sha bo'lim natijalari
    await dialog.getByRole("checkbox", { name: /^Ommaviy/ }).check();
    await dialog.getByRole("button", { name: /^Natijalarni ko'rish \(\d+\)$/ }).click();
    await page.waitForURL(/mass=1/);
    const cards = page.locator("main article");
    await expect(cards.filter({ hasText: "YaTT qadoqlovchilar" })).toHaveCount(1);
    await expect(cards.filter({ hasText: "YaTT omborchi kunlik" })).toHaveCount(0);
  });

  test("bo'lim natijalari: YaTT e'lonlari, chip bilan; chip olib tashlansa — barcha kasblar; ommaviy — 5+ o'rin", async ({ page, context }) => {
    await asGuest(context);
    await asMode(context, "worker");
    await page.goto("/search?mode=jobs&region=all&etype=ie&any=1");
    const cards = page.locator("main article");
    await expect(cards.filter({ hasText: "YaTT omborchi kunlik" })).toHaveCount(1);
    await expect(cards.filter({ hasText: "YaTT qadoqlovchilar" })).toHaveCount(1);
    const chips = page.getByRole("group", { name: "Faol filtrlar" });
    await chips.getByRole("link", { name: /YaTT/ }).click();
    await page.waitForURL((u) => !new URL(u).searchParams.has("etype") && new URL(u).searchParams.get("any") === "1");

    // ommaviy: 5+ o'rin
    await page.goto("/search?mode=jobs&region=all&mass=1&any=1");
    await expect(cards.filter({ hasText: "YaTT qadoqlovchilar" })).toHaveCount(1);
    await expect(cards.filter({ hasText: "YaTT omborchi kunlik" })).toHaveCount(0);
  });

  test("ish beruvchi (2.0): bosh sahifadagi 'Kunlik ishchilar' tez yo'li — natijasi (kunlik to'lovga yoki bugun tayyor)", async ({ page, context }) => {
    await asGuest(context);
    await asMode(context, "employer");
    await page.goto("/");
    await expect(sections(page)).toHaveCount(0);
    await page.getByRole("navigation", { name: "Tez qidiruv" }).getByRole("link", { name: "Kunlik ishchilar", exact: true }).click();
    await page.waitForURL(/mode=workers.*pay=daily/);
    await expect(page.locator("main article").filter({ hasText: "Yuk tashuvchi (kunlik)" })).toHaveCount(1);
    await expect(page.getByRole("group", { name: "Faol filtrlar" }).getByRole("link", { name: /Kunlik ishchilar/ })).toBeVisible();
  });

  test("AI bo'limi: oddiy so'z bilan suhbat — natija shu sahifada; 'Sizga mos' mehmonda — kirishga", async ({ page, context }) => {
    await asGuest(context);
    await asMode(context, "worker");
    await page.goto("/ai");
    await expect(page.getByRole("heading", { level: 1, name: "AI yordamchi" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Sizga mos e'lonlar/ })).toHaveAttribute("href", "/auth?next=%2Fcabinet%2Fmatches");
    await expect(page.getByRole("link", { name: /AI PRO kuzatuv/ })).toHaveAttribute("href", "/ai-alerts");
    await page.getByLabel("Nima qidiryapsiz?").fill("omborchi");
    await page.getByRole("button", { name: "Topish" }).click();
    // so'z kasbga aylandi ("Omborchi"), hudud aytilmagan — butun O'zbekiston bo'yicha; natija shu sahifada
    await expect(page.getByText(/^Tushundim:/)).toContainText("Omborchi");
    await expect(page.locator("main article").filter({ hasText: "YaTT omborchi kunlik" })).toHaveCount(1);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
});
