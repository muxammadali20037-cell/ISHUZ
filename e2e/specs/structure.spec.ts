import { expect, test } from "@playwright/test";
import { asGuest, loginAs, sql } from "../support";

/**
 * S3 · ilova tuzilmasi: vakansiya tablari (faqat ma'lumoti borlari), moslik tahlili (foiz faqat to'liq hisoblanganda),
 * xabarlar qidiruvi, profil sarlavhasi (haqiqiy to'liqlik), kirish sahifasida rol kartalari.
 */

const EMP = "7e2e0000-0000-4000-8000-000000000068";
const WRK = "7e2e0000-0000-4000-8000-000000000069";
const TITLE = "S3 Kassir (tablar sinovi)";

test.describe("tuzilma", () => {
  let slug = "";

  test.beforeAll(async () => {
    await sql(
      `insert into auth.users (id, phone, phone_confirmed_at, raw_user_meta_data) values
         ($1, '+998901110068', now(), '{"first_name":"Gulnora","last_name":"Shaxs"}'),
         ($2, '+998901110069', now(), '{"first_name":"Jasur","last_name":"Ishchi"}')
       on conflict (id) do nothing`,
      [EMP, WRK],
    );
    await sql(
      `insert into public.employer_profiles (profile_id, employer_type, display_name, onboarding_completed_at) values ($1, 'person', 'Gulnora opa', now())
       on conflict (profile_id) do update set display_name = excluded.display_name`,
      [EMP],
    );
    await sql("delete from public.vacancies where owner_profile_id = $1", [EMP]);
    const [v] = await sql<{ id: string; slug: string }>(
      `insert into public.vacancies (owner_profile_id, title, region_id, description, status, salary_from, salary_type, experience_min_months, published_at, expires_at)
       select $1, $2, r.id, 'Do''konga kassir kerak. Ish vaqti 9 dan 18 gacha, tushlik bepul.', 'active', 4000000, 'monthly', 12, now(), now() + interval '10 days'
       from public.regions r where r.slug = 'tashkent_city' returning id, slug`,
      [EMP, TITLE],
    );
    slug = v!.slug;
    await sql("delete from public.worker_profiles where profile_id = $1", [WRK]);
    const [w] = await sql<{ id: string }>(
      `insert into public.worker_profiles (profile_id, headline, category_id, region_id, experience_level, onboarding_completed_at, is_public)
       select $1, 'Kassir', c.id, r.id, '1_2y', now(), true from public.categories c, public.regions r where c.slug = 'sales' and r.slug = 'tashkent_city' returning id`,
      [WRK],
    );
    const [a] = await sql<{ id: string }>("insert into public.applications (vacancy_id, worker_id, status) values ($1, $2, 'sent') returning id", [v!.id, w!.id]);
    const [c] = await sql<{ id: string }>(
      `insert into public.conversations (application_id) values ($1) on conflict (application_id) do update set application_id = excluded.application_id returning id`,
      [a!.id],
    );
    await sql("insert into public.conversation_members (conversation_id, profile_id) values ($1, $2), ($1, $3) on conflict do nothing", [c!.id, EMP, WRK]);
    await sql("insert into public.messages (conversation_id, sender_id, body) values ($1, $2, 'Assalomu alaykum, ertaga suhbatga keling')", [c!.id, EMP]);
  });

  test.afterAll(async () => {
    await sql("delete from public.vacancies where owner_profile_id = $1", [EMP]);
    await sql("delete from public.worker_profiles where profile_id = $1", [WRK]);
  });

  test("vakansiya: Tavsif · Talablar tablari; ma'lumoti yo'q tab (imtiyozlar, kompaniya) ko'rsatilmaydi", async ({ page, context }) => {
    await asGuest(context);
    await page.goto(`/jobs/${slug}`);
    const tabs = page.getByRole("tablist", { name: "Vakansiya bo'limlari" });
    await expect(tabs.getByRole("tab")).toHaveText(["Tavsif", "Talablar"]);
    await expect(page.getByRole("heading", { level: 2, name: "Ish haqida" })).toBeVisible();
    await tabs.getByRole("tab", { name: "Talablar" }).click();
    await expect(page.getByRole("tabpanel").getByText("Tajriba", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Ish haqida" })).toBeHidden();
    // yashirin tab matni ham sahifa HTML'ida (qidiruv tizimlari uchun)
    expect(await page.locator("[role=tabpanel][data-state=inactive]").count()).toBe(1);
  });

  test("moslik tahlili: mehmon — kirishga; ishchi — foiz faqat to'liq hisoblanganda, aks holda nima yetishmasligi", async ({ page, context }) => {
    await asGuest(context);
    await page.goto(`/jobs/${slug}/moslik`);
    await page.waitForURL(/\/auth\?next=/);

    await loginAs(context, WRK);
    await page.goto(`/jobs/${slug}/moslik`);
    const main = page.getByRole("main");
    await expect(main.getByRole("heading", { level: 1, name: "Moslik tahlili" })).toBeVisible();
    const [m] = await sql<{ r: { score: number; complete: boolean; hard_fail: boolean; missing: string[] } }>(
      "select public.compute_match_v2((select id from public.worker_profiles where profile_id = $1), (select id from public.vacancies where slug = $2)) as r",
      [WRK, slug],
    );
    const r = m!.r;
    if (r.complete && !r.hard_fail) {
      await expect(main.locator("svg text", { hasText: `${r.score}%` })).toBeVisible();
    } else {
      // hisoblanmagan foiz ko'rsatilmaydi
      await expect(main.locator("svg text", { hasText: "%" })).toHaveCount(0);
      if (!r.hard_fail) await expect(main.getByRole("heading", { name: "Aniq foiz uchun ma'lumot yetarli emas" })).toBeVisible();
      if (r.missing.length) await expect(main.getByRole("heading", { level: 2, name: "Nima yetishmaydi" })).toBeVisible();
    }
  });

  test("xabarlar: qidiruv (topilmasa — tushuntirish), bitta turdagi suhbatlarda filtr ko'rsatilmaydi", async ({ page, context }) => {
    await loginAs(context, WRK);
    await page.goto("/messages");
    const main = page.getByRole("main");
    await expect(main.getByText(TITLE)).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Kim bilan" })).toHaveCount(0);
    const box = page.getByRole("searchbox", { name: "Suhbatlarni qidirish" });
    await box.fill("bunday-suhbat-yoq");
    await box.press("Enter");
    await page.waitForURL(/q=bunday-suhbat-yoq/);
    await expect(main.getByText("Bu qidiruv bo'yicha suhbat topilmadi")).toBeVisible();
    await page.getByRole("searchbox", { name: "Suhbatlarni qidirish" }).fill("Kassir");
    await page.getByRole("searchbox", { name: "Suhbatlarni qidirish" }).press("Enter");
    await page.waitForURL(/q=Kassir/);
    await expect(main.getByText(TITLE)).toBeVisible();
  });

  test("profil: ism, rol, haqiqiy to'liqlik foizi va faoliyat sonlari; menyu guruhlarga bo'lingan", async ({ page, context }) => {
    await loginAs(context, WRK);
    await page.goto("/cabinet");
    const [w] = await sql<{ completeness: number }>("select completeness from public.worker_profiles where profile_id = $1", [WRK]);
    const main = page.getByRole("main");
    await expect(main.getByRole("heading", { level: 2, name: "Jasur Ishchi" })).toBeVisible();
    await expect(main.getByText(`Profil to'liqligi: ${w!.completeness}%`)).toBeVisible();
    const activity = main.getByRole("list", { name: "Faoliyat" });
    await expect(activity.getByRole("link", { name: /^1\s*Arizalar$/ })).toHaveAttribute("href", "/applications");
    await expect(main.getByRole("heading", { level: 2, name: "Hisob" })).toBeVisible();
    await expect(main.getByRole("link", { name: "Saqlanganlar", exact: true })).toHaveAttribute("href", "/saved");
  });

  test("kirish sahifasi: 'Kim sifatida kirasiz?' — tanlov qurilmada saqlanadi", async ({ page, context }) => {
    await asGuest(context);
    await context.clearCookies({ name: "ib_mode" });
    await page.goto("/auth");
    const group = page.getByRole("radiogroup", { name: "Kim sifatida kirasiz?" });
    await expect(group.getByRole("radio")).toHaveCount(2);
    await group.getByRole("radio", { name: /Ish beruvchi/ }).click();
    await expect(group.getByRole("radio", { name: /Ish beruvchi/ })).toHaveAttribute("aria-checked", "true");
    await expect.poll(async () => (await context.cookies()).find((c) => c.name === "ib_mode")?.value).toBe("employer");
  });
});
