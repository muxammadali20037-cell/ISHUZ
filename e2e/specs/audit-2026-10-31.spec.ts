import { expect, test } from "@playwright/test";
import { USERS, asGuest, asMode, loginAs, sql, stack } from "../support";

/**
 * 2026-10-31 to'liq audit (docs/AUDIT_2026-10-31.md) — tuzatilgan oqimlar qayta buzilmasin:
 *  - kompaniya sozlamalaridan tasdiqlash so'rovi yuboriladi (avval RLS bilan yiqilardi);
 *  - yopilgan vakansiya havolasi 404 emas — "yopilgan" sahifa, o'xshash faol ishlar, noindex;
 *  - /jobs: maksimal maosh va ma'lumoti filtrlari (0070);
 *  - /companies: faqat faol vakansiyasi borlar, nom bo'yicha qidiruv; /for-employers: halol narx matni;
 *  - ish beruvchida faqat Telegram bo'lsa ham "Telegram'da yozish" (aloqa statistikasi bilan);
 *  - mehmon "Shikoyat" bossa — kirishga (forma emas);
 *  - analitika: UI hodisalari qabul qilinadi, server hodisalarini brauzer soxtalashtira olmaydi.
 */
const TAG = "A31";
let companyId = "";
let companySlug = "";

test.beforeAll(async () => {
  await sql("delete from public.vacancies where owner_profile_id = $1", [USERS.employer]);
  await sql("delete from public.companies where created_by = $1 and name like $2", [USERS.employer, `${TAG} %`]);
  const [c] = await sql<{ id: string; slug: string }>(
    `insert into public.companies (name, created_by, telegram, region_id) select $2, $1, '@a31_hr', r.id from public.regions r where r.slug = 'tashkent_city' returning id, slug`,
    [USERS.employer, `${TAG} Savdo MChJ`],
  );
  companyId = c!.id;
  companySlug = c!.slug;
  await sql("insert into public.company_members (company_id, profile_id, role) values ($1, $2, 'owner') on conflict do nothing", [companyId, USERS.employer]);
  await sql(
    `insert into public.employer_profiles (profile_id, employer_type, display_name, company_id, onboarding_completed_at, verification_status)
     values ($1, 'company', $3, $2, now(), 'unverified')
     on conflict (profile_id) do update set employer_type = 'company', company_id = excluded.company_id, display_name = excluded.display_name, verification_status = 'unverified'`,
    [USERS.employer, companyId, `${TAG} Savdo MChJ`],
  );
  await sql("delete from public.verification_requests where profile_id = $1", [USERS.employer]);
  const vac = (title: string, status: string, salary: number, education: string | null) =>
    sql(
      `insert into public.vacancies (owner_profile_id, company_id, title, category_id, region_id, description, status, salary_from, salary_type, education_min, published_at, expires_at)
       select $1, $2, $3, c.id, r.id, 'Sinov e''loni: ' || $3 || ', ish vaqti 9 dan 18 gacha', $4::vacancy_status, $5, 'monthly', $6::education_level, now() - interval '1 day', now() + interval '7 days'
       from public.categories c, public.regions r where c.slug = 'sales' and r.slug = 'tashkent_city'`,
      [USERS.employer, companyId, `${TAG} ${title}`, status, salary, education],
    );
  await vac("Kassir", "active", 4_000_000, "secondary");
  await vac("Savdo menejeri", "active", 12_000_000, "higher");
  await vac("Sotuvchi yopilgan", "closed", 5_000_000, null);
});

test.afterAll(async () => {
  await sql("delete from public.vacancies where owner_profile_id = $1", [USERS.employer]);
  await sql("delete from public.verification_requests where profile_id = $1", [USERS.employer]);
  // keyingi spec'lar "O'zim uchun" ish beruvchini kutadi
  await sql("update public.employer_profiles set employer_type = 'person', company_id = null, display_name = 'Dilnoza opa', verification_status = 'unverified', identity_number = null where profile_id = $1", [USERS.employer]);
  await sql("delete from public.companies where id = $1", [companyId]);
});

test("kompaniya sozlamalari → Tasdiqlash: STIR bilan so'rov yuboriladi, holat 'kutilmoqda'", async ({ page, context }) => {
  await loginAs(context, USERS.employer);
  await asMode(context, "employer");
  await page.goto("/company/settings#verification");
  const tab = page.locator("#verification");
  await tab.getByRole("textbox").first().fill("123456789");
  await tab.getByRole("button", { name: "Tasdiqlashga yuborish" }).click();
  await expect(tab.getByText("So'rovingiz tekshirilmoqda", { exact: false })).toBeVisible();
  const [r] = await sql<{ n: string; status: string }>(
    "select count(*)::text as n, max(status::text) as status from public.verification_requests where profile_id = $1 and company_id = $2",
    [USERS.employer, companyId],
  );
  expect(r).toEqual({ n: "1", status: "pending" });
  const [e] = await sql<{ verification_status: string; identity_number: string }>("select verification_status, identity_number from public.employer_profiles where profile_id = $1", [USERS.employer]);
  expect(e).toEqual({ verification_status: "pending", identity_number: "123456789" });
});

test("yopilgan vakansiya: 404 emas — holat, kompaniya, o'xshash faol ishlar; ariza tugmasi yo'q; noindex", async ({ page, context }) => {
  await asGuest(context);
  const [v] = await sql<{ slug: string }>("select slug from public.vacancies where title = $1", [`${TAG} Sotuvchi yopilgan`]);
  const res = await page.goto(`/jobs/${v!.slug}`);
  expect(res?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`${TAG} Sotuvchi yopilgan`);
  await expect(page.getByText("Yopilgan", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Ariza yuborish" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "O'xshash faol ishlar" }).getByRole("link", { name: new RegExp(`${TAG} Kassir`) })).toBeVisible();
  await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute("content", /noindex/);
  // umuman yo'q (yoki hech qachon ommaviy bo'lmagan) slug — "topilmadi" sahifasi (yopilgan ko'rinishi emas)
  await page.goto("/jobs/bunday-vakansiya-yoq-a31-000000");
  await expect(page.getByText("Yopilgan", { exact: true })).toHaveCount(0);
  await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute("content", /noindex/);
});

test("/jobs: maksimal maosh va ma'lumoti filtrlari — natija va olib tashlanadigan chiplar", async ({ page, context }) => {
  await asGuest(context);
  await page.goto(`/jobs?q=${TAG}&salary_max=5000000`);
  const results = page.locator("main article");
  await expect(results.filter({ hasText: `${TAG} Kassir` })).toHaveCount(1);
  await expect(results.filter({ hasText: `${TAG} Savdo menejeri` })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Olib tashlash: .*gacha$/ })).toBeVisible();

  await page.goto(`/jobs?q=${TAG}&education=secondary`);
  await expect(results.filter({ hasText: `${TAG} Kassir` })).toHaveCount(1);
  await expect(results.filter({ hasText: `${TAG} Savdo menejeri` })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Olib tashlash: Ma'lumot: O'rta" })).toBeVisible();
});

test("/companies va /for-employers: haqiqiy kompaniyalar, qidiruv; narx haqida halol matn", async ({ page, context }) => {
  await asGuest(context);
  await page.goto(`/companies?q=${encodeURIComponent(TAG)}`);
  const card = page.getByRole("link", { name: new RegExp(`${TAG} Savdo MChJ`) });
  await expect(card).toBeVisible();
  await expect(card).toContainText("2 ta faol vakansiya");
  await expect(card).toHaveAttribute("href", `/company/${companySlug}`);
  await page.goto("/companies?q=bunday-kompaniya-yoq");
  await expect(page.getByText("Bunday kompaniya topilmadi")).toBeVisible();

  await page.goto("/for-employers");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Kerakli xodimni tez va ishonchli toping");
  // e2e stendida pullik e'lonlar o'chiq — "bepul"; yoqilgan bo'lsa — "narx joylashdan oldin ko'rsatiladi"
  await expect(page.getByText(/Vakansiya joylash — bepul\.|Vakansiya joylash pullik/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Vakansiya joylash" }).first()).toHaveAttribute("href", "/post/vacancy");
});

test("vakansiya: telefon yo'q, kompaniya Telegram'i bor — 'Telegram'da yozish'; mehmon shikoyati — kirishga", async ({ page, context }) => {
  await asGuest(context);
  const [v] = await sql<{ slug: string }>("select slug from public.vacancies where title = $1", [`${TAG} Kassir`]);
  await page.goto(`/jobs/${v!.slug}`);
  const tg = page.getByRole("link", { name: "Telegram'da yozish" });
  await expect(tg).toHaveAttribute("href", "https://t.me/a31_hr");
  await expect(tg).toHaveAttribute("data-contact", "telegram");
  const report = page.getByRole("link", { name: "Shikoyat qilish" });
  await expect(report).toHaveAttribute("href", new RegExp(`^/auth\\?next=${encodeURIComponent(`/jobs/${v!.slug}`).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
});

test("analitika: UI hodisasi (save_toggle) qabul qilinadi; server hodisasi (application_submit) — yo'q", async ({ request }) => {
  const ok = await request.post(`${stack.app}/api/e`, { data: { name: "save_toggle", props: { to: "vacancy" } }, headers: { origin: stack.app } });
  expect(ok.status()).toBe(204);
  const forged = await request.post(`${stack.app}/api/e`, { data: { name: "application_submit" }, headers: { origin: stack.app } });
  expect(forged.status()).toBe(400);
});
