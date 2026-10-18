import { expect, test } from "@playwright/test";
import { USERS, asGuest, asMode, loginAs, sql } from "../support";

/**
 * R-D/E · asosiy oqim qo'riqlari:
 *  - muddati o'tgan (soatlik vazifa hali yopmagan) vakansiya: qidiruvda yo'q, sahifada yopiq, ariza tugmasi o'chiq (0065);
 *  - yopilgan vakansiya bo'yicha taklifni qabul qilib bo'lmaydi — tushunarli xabar, ariza yaratilmaydi;
 *  - profil to'ldirilgach (yoki allaqachon to'ldirilgan bo'lsa) ?next= bo'yicha aynan o'sha vakansiyaga, ariza oynasi ochiq;
 *  - profilsiz foydalanuvchi "Arizalar"da onboardingga majburan emas — tushuntirish va "Ishlarni ko'rish";
 *  - telefonda matn yozilayotganda pastki menyu maydonni yopmaydi.
 */

async function setup() {
  await sql("delete from public.vacancies where owner_profile_id = $1", [USERS.employer]);
  await sql("delete from public.job_offers where employer_profile_id = $1", [USERS.employer]);
  await sql("delete from public.worker_profiles where profile_id = $1", [USERS.workerB]);
  await sql(
    `insert into public.employer_profiles (profile_id, employer_type, display_name, onboarding_completed_at)
     values ($1, 'person', 'Dilnoza opa', now()) on conflict (profile_id) do nothing`,
    [USERS.employer],
  );
  const [n] = await sql<{ id: string }>("select id from public.profession_nodes where name_uz = 'Buxgalter' and selectable limit 1");
  const [r] = await sql<{ id: string }>("select id from public.regions where slug = 'tashkent_city'");
  const vacancy = async (title: string, status: string, expires: string) => {
    const [v] = await sql<{ id: string; slug: string }>(
      `insert into public.vacancies (owner_profile_id, title, region_id, description, status, profession_node_id, salary_from, salary_type, published_at, expires_at)
       values ($1, $2, $3, 'Sinov e''loni: ' || $2 || ', haftasiga 5 kun', $4::vacancy_status, $5, 4000000, 'monthly', now() - interval '20 days', now() + $6::interval)
       returning id, slug`,
      [USERS.employer, title, r!.id, status, n!.id, expires],
    );
    return v!;
  };
  const expired = await vacancy("Buxgalter — muddati o'tgan (G)", "active", "-1 hour");
  const open = await vacancy("Buxgalter — ochiq (G)", "active", "10 days");
  const closed = await vacancy("Buxgalter — yopilgan (G)", "closed", "10 days");
  const [w] = await sql<{ id: string }>(
    `insert into public.worker_profiles (profile_id, headline, about, region_id, profession_node_id, experience_level, onboarding_completed_at)
     values ($1, 'Buxgalter', 'Buxgalteriya, 1C, soliq hisobotlari', $2, $3, '3_5y', now()) returning id`,
    [USERS.workerB, r!.id, n!.id],
  );
  return { expired, open, closed, workerId: w!.id };
}

test.afterEach(async () => {
  await sql("delete from public.job_offers where employer_profile_id = $1", [USERS.employer]);
  await sql("delete from public.vacancies where owner_profile_id = $1", [USERS.employer]);
  await sql("delete from public.worker_profiles where profile_id = $1", [USERS.workerB]);
});

test("muddati o'tgan vakansiya: qidiruvda ko'rinmaydi, sahifada yopiq, ariza tugmasi o'chiq", async ({ page, context }) => {
  const { expired } = await setup();
  await loginAs(context, USERS.workerB);
  await asMode(context, "worker");
  const [n] = await sql<{ id: string }>("select id from public.profession_nodes where name_uz = 'Buxgalter' and selectable limit 1");
  await page.goto(`/search?mode=jobs&p=${n!.id}&region=all`);
  await expect(page.locator("main article").filter({ hasText: "Buxgalter — ochiq (G)" })).toHaveCount(1);
  await expect(page.locator("main article").filter({ hasText: "muddati o'tgan (G)" })).toHaveCount(0);

  await page.goto(`/jobs/${expired.slug}`);
  await expect(page.getByText("Muddati tugagan").first()).toBeVisible();
  await expect(page.getByText("Bu vakansiya hozir faol emas — ariza yuborib bo'lmaydi.").first()).toBeVisible();
  for (const b of await page.getByRole("button", { name: "Ariza yuborish" }).all()) await expect(b).toBeDisabled();
  // to'g'ridan-to'g'ri havola (?apply=1) ham ariza oynasini ochmaydi
  await page.goto(`/jobs/${expired.slug}?apply=1`);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("yopilgan vakansiya bo'yicha taklif: qabul qilinmaydi, sababi aytiladi, ariza yaratilmaydi", async ({ page, context }) => {
  const { closed, workerId } = await setup();
  const [o] = await sql<{ id: string }>(
    `insert into public.job_offers (vacancy_id, employer_profile_id, worker_id, message, status) values ($1, $2, $3, 'Sizni taklif qilamiz', 'sent') returning id`,
    [closed.id, USERS.employer, workerId],
  );
  await loginAs(context, USERS.workerB);
  await asMode(context, "worker");
  await page.goto(`/offers/${o!.id}`);
  await page.getByRole("button", { name: "Qabul qilish" }).first().click();
  await page.getByRole("dialog").getByRole("button", { name: "Qabul qilish" }).click();
  await expect(page.getByText("Vakansiya yopilgan yoki muddati tugagan — taklifni qabul qilib bo'lmaydi.", { exact: false })).toBeVisible();
  const [row] = await sql<{ status: string }>("select status::text from public.job_offers where id = $1", [o!.id]);
  expect(["sent", "viewed"]).toContain(row!.status);
  const apps = await sql("select 1 from public.applications where vacancy_id = $1", [closed.id]);
  expect(apps).toHaveLength(0);
});

test("profil to'ldirilgan bo'lsa ?next= — aynan o'sha vakansiyaga, ariza oynasi ochiq; begona manzil e'tiborsiz", async ({ page, context }) => {
  const { open } = await setup();
  await loginAs(context, USERS.workerB);
  await asMode(context, "worker");
  await page.goto(`/onboarding/worker?next=${encodeURIComponent(`/jobs/${open.slug}?apply=1`)}`);
  await page.waitForURL(new RegExp(`/jobs/${open.slug}\\?apply=1$`));
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.goto(`/onboarding/worker?next=${encodeURIComponent("https://evil.uz/x")}`);
  await page.waitForURL((u) => new URL(u).pathname === "/");
});

test("profilsiz foydalanuvchi: 'Arizalar' — onboardingga majburan emas, tushuntirish va 'Ishlarni ko'rish'", async ({ page, context }) => {
  await sql("delete from public.worker_profiles where profile_id = $1", [USERS.employer]);
  await loginAs(context, USERS.employer);
  await page.goto("/applications");
  expect(new URL(page.url()).pathname).toBe("/applications");
  await expect(page.getByRole("heading", { level: 1, name: "Arizalarim" })).toBeVisible();
  await expect(page.getByText("Hozircha arizalaringiz yo'q")).toBeVisible();
  await expect(page.getByRole("main").getByRole("link", { name: "Ishlarni ko'rish" })).toHaveAttribute("href", "/");
});

test.describe("telefon klaviaturasi", () => {
  test.use({ hasTouch: true, isMobile: true });

  test("matn yozilayotganda pastki menyu va lupa yashiriladi, chiqqach qaytadi; sahifa klaviatura bilan qisqaradi", async ({ page, context }) => {
    // birinchi ochilish (til, tanishtiruv) — entry-flow.spec.ts; bu yerda oddiy mehmon
    await asGuest(context);
    await page.goto("/");
    const meta = await page.locator("meta[name='viewport']").getAttribute("content");
    expect(meta).toContain("interactive-widget=resizes-content");
    const nav = page.locator("nav.bottom-nav");
    await expect(nav).toBeVisible();
    await page.getByRole("searchbox", { name: "Kasb yoki lavozim" }).focus();
    await expect(nav).toBeHidden();
    await expect(page.locator(".ai-fab")).toBeHidden();
    await page.getByRole("searchbox", { name: "Kasb yoki lavozim" }).blur();
    await expect(nav).toBeVisible();
  });
});
