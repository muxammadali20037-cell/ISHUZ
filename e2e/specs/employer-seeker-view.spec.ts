import { expect, test } from "@playwright/test";
import { USERS, asMode, loginAs, sql } from "../support";

/**
 * Ish beruvchi o'z e'lonini ish izlovchi ko'zi bilan ko'radi (ega, 2026-11-13: "e'lon joylagandan keyin ish izlovchilar
 * kabinetda qanday ko'rishini bilmoqchi"): boshqaruv sahifasidagi blok (ko'rinish holati, qidiruvdagi haqiqiy o'rni,
 * ro'yxat kartasi) va /jobs/[slug]?korinish=izlovchi — tugmalari o'chiq ish izlovchi ko'rinishi.
 */

async function setup(status: "active" | "pending_review" = "active") {
  await sql("delete from public.vacancies where owner_profile_id = $1", [USERS.employer]);
  await sql(
    `insert into public.employer_profiles (profile_id, employer_type, display_name, onboarding_completed_at)
     values ($1, 'person', 'Dilnoza opa', now()) on conflict (profile_id) do nothing`,
    [USERS.employer],
  );
  await sql("update public.profiles set active_role = coalesce(active_role, 'employer') where id = $1", [USERS.employer]);
  const [n] = await sql<{ id: string }>("select id from public.profession_nodes where name_uz = 'Buxgalter' and selectable limit 1");
  const [r] = await sql<{ id: string }>("select id from public.regions where slug = 'tashkent_city'");
  // shu kasb va hududda yangiroq boshqa e'lon — bizniki qidiruvda 2-o'rinda chiqishi kerak
  await sql(
    `insert into public.vacancies (owner_profile_id, title, region_id, description, status, profession_node_id, salary_negotiable, published_at, expires_at)
     values ($1, 'Bosh buxgalter', $2, 'Savdo kompaniyasiga bosh buxgalter kerak', 'active', $3, true, now(), now() + interval '10 days')`,
    [USERS.employer, r!.id, n!.id],
  );
  const [v] = await sql<{ id: string; slug: string }>(
    `insert into public.vacancies (owner_profile_id, title, region_id, description, status, profession_node_id, salary_from, salary_type, published_at, expires_at)
     values ($1, 'Buxgalter yordamchisi', $2, 'Kichik do''konga buxgalter yordamchisi kerak, haftasiga 5 kun', $4::public.vacancy_status, $3, 4500000, 'monthly',
             case when $4::text = 'active' then now() - interval '2 hours' end, now() + interval '10 days')
     returning id, slug`,
    [USERS.employer, r!.id, n!.id, status],
  );
  return v!;
}

test.afterAll(async () => {
  await sql("delete from public.vacancies where owner_profile_id = $1", [USERS.employer]);
});

test("e'lon joylangach: 'Ish izlovchilar qanday ko'radi' — holat, qidiruvdagi o'rni, karta va ish izlovchi ko'rinishi", async ({ page, context }) => {
  const v = await setup();
  await loginAs(context, USERS.employer);
  await asMode(context, "employer");
  await page.goto(`/employer/vacancies/${v.id}?published=1`);

  await page.locator("[data-published-banner]").getByRole("link", { name: "Ish izlovchilar qanday ko'radi" }).click();
  await expect(page).toHaveURL(/#korinish$/);
  const panel = page.locator("[data-seeker-view=visible]");
  await expect(panel).toBeVisible();
  await expect(panel.locator("[data-seeker-status]")).toContainText("ish izlovchilarga ko'rinmoqda");
  // haqiqiy qidiruv tartibi: yangiroq "Bosh buxgalter" birinchi, bizniki — ikkinchi
  await expect(panel.locator("[data-seeker-rank]")).toHaveText(
    "Ish izlovchi «Buxgalter» kasbini Toshkent shahri bo'yicha qidirsa, e'loningiz 2-o'rinda chiqadi (jami 2 ta e'lon).",
  );
  // ro'yxat kartasi — ish izlovchi ko'radigani (lavozim, ish beruvchi nomi)
  const card = panel.locator("[data-seeker-card]");
  await expect(card).toContainText("Buxgalter yordamchisi");
  await expect(card).toContainText("Dilnoza opa");

  // to'liq sahifa ish izlovchi ko'zi bilan: banner, ariza tugmasi bor (boshqaruv emas), lekin hammasi o'chiq; ko'rishlar oshmaydi
  const [before] = await sql<{ views_count: number }>("select views_count from public.vacancies where id = $1", [v.id]);
  await panel.locator("[data-seeker-preview-link]").click();
  await page.waitForURL(new RegExp(`/jobs/${v.slug}\\?korinish=izlovchi$`));
  await expect(page.locator("[data-seeker-preview-banner=visible]")).toContainText("Ish izlovchilar e'loningizni shunday ko'radi");
  const preview = page.locator("[data-seeker-preview]");
  await expect(preview).toHaveAttribute("inert", "");
  await expect(preview.locator("h1")).toHaveText("Buxgalter yordamchisi");
  await expect(preview.getByText("Ariza yuborish").filter({ visible: true }).first()).toBeVisible();
  await expect(preview.locator(`a[href="/employer/vacancies/${v.id}"]`)).toHaveCount(0);
  const [after] = await sql<{ views_count: number }>("select views_count from public.vacancies where id = $1", [v.id]);
  expect(after!.views_count).toBe(before!.views_count);

  await page.locator("[data-seeker-preview-banner]").getByRole("link", { name: "Boshqaruvga qaytish" }).click();
  await page.waitForURL(new RegExp(`/employer/vacancies/${v.id}#korinish$`));
});

test("tekshiruvdagi e'lon: ish izlovchilar hali ko'rmasligi aytiladi, karta — joylangach qanday chiqishi", async ({ page, context }) => {
  const v = await setup("pending_review");
  await loginAs(context, USERS.employer);
  await asMode(context, "employer");
  await page.goto(`/employer/vacancies/${v.id}`);
  const panel = page.locator("[data-seeker-view=pending_review]");
  await expect(panel.locator("[data-seeker-status]")).toHaveText("E'lon tekshiruvda. Tasdiqlangach ish izlovchilarga ko'rinadi.");
  await expect(panel.locator("[data-seeker-rank]")).toHaveCount(0);
  await expect(panel).toContainText("Joylangach ro'yxatda shunday chiqadi:");
  await expect(panel.locator("[data-seeker-card]")).toContainText("Buxgalter yordamchisi");
  await panel.locator("[data-seeker-preview-link]").click();
  await expect(page.locator("[data-seeker-preview-banner=pending_review]")).toContainText("Tasdiqlangach ish izlovchilarga ko'rinadi");
});

test("boshqa foydalanuvchiga ?korinish=izlovchi ta'sir qilmaydi", async ({ page, context }) => {
  const v = await setup();
  await loginAs(context, USERS.workerA);
  await asMode(context, "worker");
  await page.goto(`/jobs/${v.slug}?korinish=izlovchi`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Buxgalter yordamchisi");
  await expect(page.locator("[data-seeker-preview-banner]")).toHaveCount(0);
  await expect(page.locator("[data-seeker-preview]")).toHaveCount(0);
});
