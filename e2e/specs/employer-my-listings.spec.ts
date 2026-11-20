import { expect, test } from "@playwright/test";
import { USERS, asMode, loginAs, sql } from "../support";

/**
 * Ish beruvchi rejimidagi "E'lonlarim" (/employer/vacancies) — vakansiyalardan tashqari egasining boshqa e'lonlari ham
 * (o'zi haqidagi ishchi e'loni, holati bilan). Ega, 2026-11-20: "e'lon egasi e'lonlarimdan o'z e'lonlarini, barcha
 * e'lonlarini ko'rolmayapti" — ish izlovchi rejimida joylagan e'lon rejim almashganda yo'qolib qolmasin.
 */
const HEADLINE = "E2E boshqa e'lon — oshpaz";

async function cleanup() {
  await sql("delete from public.vacancies where owner_profile_id = $1", [USERS.employer]);
  await sql("delete from public.worker_profiles where profile_id = $1", [USERS.employer]);
}

test.afterEach(cleanup);

test("ish beruvchi E'lonlarim: vakansiya ro'yxati ostida o'zi haqidagi e'lon ham ko'rinadi (holati va o'zgartirish bilan)", async ({ page, context }) => {
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

  // ishchi e'loni yo'q — qo'shimcha bo'lim ham yo'q
  await page.goto("/employer/vacancies");
  await expect(page.getByText("E2E kassir")).toBeVisible();
  await expect(page.locator("[data-other-listings]")).toHaveCount(0);

  await sql(
    `insert into public.worker_profiles (profile_id, headline, region_id, is_public, onboarding_completed_at)
     values ($1, $2, $3, true, now())`,
    [USERS.employer, HEADLINE, r!.id],
  );
  await page.reload();
  await expect(page.getByText("E2E kassir")).toBeVisible();
  const other = page.locator("[data-other-listings]");
  await expect(other.getByRole("heading", { name: "Boshqa e'lonlaringiz" })).toBeVisible();
  const card = other.locator('[data-my-listing="worker"]');
  await expect(card).toContainText(HEADLINE);
  await expect(card).toContainText("Qidiruvda ko'rinadi");
  await expect(card.getByRole("link", { name: /O'zgartirish/ })).toHaveAttribute("href", "/post/worker");
  // vakansiyalar shu yerda ikki marta chiqmaydi — ular yuqoridagi ro'yxatda
  await expect(other.locator('[data-my-listing="vacancy"]')).toHaveCount(0);
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
  await expect(workerCard.locator("[data-phone-hidden]")).toBeVisible();
  // "O'zgartirish" — tuzatish yo'li shu kartaning o'zida
  await expect(vacancyCard.getByRole("link", { name: /O'zgartirish/ })).toHaveAttribute("href", `/post/vacancy?edit=${v!.id}`);

  await sql("update public.vacancy_contacts set show_phone = true where vacancy_id = $1", [v!.id]);
  await sql("insert into public.worker_listing_phones (worker_id, phone) values ($1, '+998932728766')", [w!.id]);
  await page.reload();
  await expect(vacancyCard).toBeVisible();
  await expect(page.locator("[data-phone-hidden]")).toHaveCount(0);
});
