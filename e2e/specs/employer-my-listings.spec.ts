import { expect, test } from "@playwright/test";
import { USERS, asMode, loginAs, sql } from "../support";

/**
 * Ish beruvchi rejimidagi "E'lonlarim". Ega, 2026-11-20 (kechqurun): "bitta odam ham ish beruvchi, ham ishchi bo'lsa —
 * adashmasin, bir-biriga ko'rinmasin, ma'lumotlari alohida". Ish beruvchi rejimida faqat vakansiyalar; o'zi haqidagi
 * ishchi e'lonlari — faqat soni va bir bosishda ish izlovchi rejimiga o'tish qatori (e'lon "yo'qoldi" deb o'ylamasin).
 */
const HEADLINE = "E2E boshqa e'lon — oshpaz";

async function cleanup() {
  await sql("delete from public.vacancies where owner_profile_id = $1", [USERS.employer]);
  await sql("delete from public.worker_profiles where profile_id = $1", [USERS.employer]);
}

test.afterEach(cleanup);

test("ish beruvchi E'lonlarim: faqat vakansiyalar; o'zi haqidagi e'lon — ko'rinmaydi, soni va o'tish qatori bor", async ({ page, context }) => {
  await cleanup();
  await sql(
    `insert into public.employer_profiles (profile_id, employer_type, display_name, onboarding_completed_at)
     values ($1, 'person', 'Dilnoza opa', now()) on conflict (profile_id) do nothing`,
    [USERS.employer],
  );
  const [r] = await sql<{ id: string }>("select id from public.regions where slug = 'tashkent_city'");
  await sql(
    `insert into public.vacancies (owner_profile_id, title, region_id, description, status, salary_negotiable, published_at)
     values ($1, 'E2E kassir', $2, 'Do''konga kassir kerak, haftasiga 6 kun', 'active', true, now())`,
    [USERS.employer, r!.id],
  );
  await loginAs(context, USERS.employer);
  await asMode(context, "employer");

  // ishchi e'loni yo'q — o'tish qatori ham yo'q
  await page.goto("/employer/vacancies");
  await expect(page.getByText("E2E kassir")).toBeVisible();
  await expect(page.locator("[data-other-listings]")).toHaveCount(0);

  await sql(
    `insert into public.worker_profiles (profile_id, headline, region_id, is_public, onboarding_completed_at)
     values ($1, $2, $3, true, now())`,
    [USERS.employer, HEADLINE, r!.id],
  );
  for (const url of ["/employer/vacancies", "/cabinet/elonlar"]) {
    await page.goto(url);
    await expect(page.getByText("E2E kassir").first()).toBeVisible();
    await expect(page.locator('[data-my-listing="worker"]')).toHaveCount(0);
    await expect(page.getByText(HEADLINE)).toHaveCount(0);
    const sw = page.locator("[data-role-switch='worker']");
    await expect(sw).toContainText("Ish izlovchi sifatida 1 ta e'loningiz bor");
  }
  // bir bosishda — ish izlovchi rejimi, o'sha sahifa: endi faqat o'zi haqidagi e'lon
  await page.locator("[data-role-switch='worker']").click();
  await expect(page.locator('[data-my-listing="worker"]')).toContainText(HEADLINE);
  await expect(page.locator('[data-my-listing="vacancy"]')).toHaveCount(0);
  await expect(page.locator("[data-role-switch='employer']")).toContainText("Ish beruvchi sifatida 1 ta vakansiyangiz bor");
  expect((await context.cookies()).find((c) => c.name === "ib_mode")?.value).toBe("worker");
});

test("E'lonlarim: raqami ko'rinmaydigan eski e'lonlar egasiga eslatiladi; raqam ochiq bo'lgach — eslatma yo'q", async ({ page, context }) => {
  await cleanup();
  const [r] = await sql<{ id: string }>("select id from public.regions where slug = 'tashkent_city'");
  const [v] = await sql<{ id: string }>(
    `insert into public.vacancies (owner_profile_id, title, region_id, description, status, salary_negotiable, published_at)
     values ($1, 'E2E qorovul', $2, 'Kechki smenaga qorovul kerak, tajriba shart emas', 'active', true, now()) returning id`,
    [USERS.employer, r!.id],
  );
  // eski e'lon: raqam "ko'rsatilmasin" tanlangan; ishchi e'lonida raqam yozilmagan, hisob raqami faqat arizachilarga
  await sql("insert into public.vacancy_contacts (vacancy_id, phone, show_phone) values ($1, '+998901110003', false)", [v!.id]);
  const [w] = await sql<{ id: string }>(
    "insert into public.worker_profiles (profile_id, headline, region_id, is_public, onboarding_completed_at) values ($1, $2, $3, true, now()) returning id",
    [USERS.employer, HEADLINE, r!.id],
  );
  await sql("update public.profile_contacts set phone_visibility = 'applicants' where profile_id = $1", [USERS.employer]);
  await loginAs(context, USERS.employer);
  await asMode(context, "employer");
  await page.goto("/cabinet/elonlar");
  const vacancyCard = page.locator('[data-my-listing="vacancy"]').filter({ hasText: "E2E qorovul" });
  const workerCard = page.locator('[data-my-listing="worker"]').filter({ hasText: HEADLINE });
  await expect(vacancyCard.locator("[data-phone-hidden]")).toContainText("raqamingiz bu e'londa ko'rinmayapti");
  // o'zi haqidagi e'lon — ish izlovchi rejimida (rollar aralashmaydi)
  await asMode(context, "worker");
  await page.reload();
  await expect(workerCard.locator("[data-phone-hidden]")).toBeVisible();
  await asMode(context, "employer");
  await page.reload();
  // "O'zgartirish" — tuzatish yo'li shu kartaning o'zida
  await expect(vacancyCard.getByRole("link", { name: /O'zgartirish/ })).toHaveAttribute("href", `/post/vacancy?edit=${v!.id}`);

  await sql("update public.vacancy_contacts set show_phone = true where vacancy_id = $1", [v!.id]);
  await sql("insert into public.worker_listing_phones (worker_id, phone) values ($1, '+998932728766')", [w!.id]);
  await page.reload();
  await expect(vacancyCard).toBeVisible();
  await expect(page.locator("[data-phone-hidden]")).toHaveCount(0);
  await asMode(context, "worker");
  await page.reload();
  await expect(workerCard).toBeVisible();
  await expect(page.locator("[data-phone-hidden]")).toHaveCount(0);
});
