import { expect, test, type Page } from "@playwright/test";
import { USERS, asGuest, asMode, loginAs, sql } from "../support";

/**
 * E2/S2 · "Saqlanganlar" (S2 dan — Profil ichida): profil to'ldirmagan ish izlovchi ham vakansiyani saqlaydi, ish beruvchi — ishchini;
 * sahifada qidiruv kartalari bilan bir xil ko'rinadi, olib tashlansa yo'qoladi; mehmonga — kirish taklifi.
 */

const FRESH = "7e2e0000-0000-4000-8000-0000000000e1";

async function freshUser() {
  await sql(
    `insert into auth.users (id, phone, phone_confirmed_at, raw_user_meta_data) values ($1, '+998907770001', now(), '{"first_name":"Sardor"}')
     on conflict (id) do nothing`,
    [FRESH],
  );
  await sql("delete from public.saved_items where profile_id = $1", [FRESH]);
}

async function vacancy(title: string) {
  const [r] = await sql<{ id: string }>("select id from public.regions where slug = 'tashkent_city'");
  const [n] = await sql<{ id: string }>("select id from public.profession_nodes where name_uz = 'Buxgalter' and selectable limit 1");
  const [v] = await sql<{ id: string }>(
    `insert into public.vacancies (owner_profile_id, title, region_id, description, status, profession_node_id, salary_from, salary_type, published_at, expires_at)
     values ($1, $2, $3, 'Sinov e''loni: kichik do''konga buxgalter kerak', 'active', $4, 4000000, 'monthly', now(), now() + interval '10 days') returning id`,
    [USERS.employer, title, r!.id, n!.id],
  );
  return { id: v!.id, node: n!.id };
}

/** S2: "Saqlanganlar" — Profil (kabinet) ichida: pastki menyudan Profil → "Saqlanganlar" */
async function openSaved(page: Page) {
  await page.getByRole("navigation").last().getByRole("link", { name: "Profil" }).click();
  await page.waitForURL("**/cabinet");
  await page.getByRole("main").getByRole("link", { name: "Saqlanganlar" }).click();
}

test.beforeEach(async () => {
  await sql("delete from public.vacancies where owner_profile_id = $1", [USERS.employer]);
});
test.afterEach(async () => {
  await sql("delete from public.vacancies where owner_profile_id = $1", [USERS.employer]);
  await sql("delete from public.saved_items where profile_id = $1", [FRESH]);
  await sql("delete from public.worker_profiles where profile_id = $1", [USERS.workerB]);
});

test("profilsiz ish izlovchi: kartadan saqlaydi → 'Saqlanganlar'da ko'radi → olib tashlaydi", async ({ page, context }) => {
  await freshUser();
  const v = await vacancy("Bosh buxgalter — savdo do'koni");
  await loginAs(context, FRESH);
  await asMode(context, "worker");
  await page.goto(`/search?mode=jobs&p=${v.node}&region=all`);
  const card = page.locator("main article").filter({ hasText: "Bosh buxgalter — savdo do'koni" });
  await card.getByRole("button", { name: "Saqlash: Bosh buxgalter — savdo do'koni" }).click();
  await expect(card.getByRole("button", { name: "Saqlangan: Bosh buxgalter — savdo do'koni" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Saqlanganlarga qo'shildi").first()).toBeVisible();
  const [row] = await sql<{ n: number }>("select count(*)::int as n from public.saved_items where profile_id = $1 and vacancy_id = $2", [FRESH, v.id]);
  expect(row!.n).toBe(1);
  // ishchi profili yaratilmadi (saqlash uchun profil shart emas)
  const [wp] = await sql<{ n: number }>("select count(*)::int as n from public.worker_profiles where profile_id = $1", [FRESH]);
  expect(wp!.n).toBe(0);

  await openSaved(page);
  await page.waitForURL("**/saved");
  await expect(page.getByRole("heading", { level: 1, name: "Saqlanganlar" })).toBeVisible();
  await expect(page.getByText("Saqlangan ish e'lonlari: 1 ta")).toBeVisible();
  const saved = page.locator("main article").filter({ hasText: "Bosh buxgalter — savdo do'koni" });
  await expect(saved).toHaveCount(1);
  await saved.getByRole("button", { name: /^Saqlangan:/ }).click();
  await expect(page.getByText("Hali saqlangan ish e'loni yo'q")).toBeVisible();
  const [after] = await sql<{ n: number }>("select count(*)::int as n from public.saved_items where profile_id = $1", [FRESH]);
  expect(after!.n).toBe(0);
});

test("ish beruvchi: ishchini saqlaydi — 'Saqlanganlar'da ishchilar ko'rinadi", async ({ page, context }) => {
  await freshUser();
  const [r] = await sql<{ id: string }>("select id from public.regions where slug = 'tashkent_city'");
  const [n] = await sql<{ id: string }>("select id from public.profession_nodes where name_uz = 'Buxgalter' and selectable limit 1");
  await sql("delete from public.worker_profiles where profile_id = $1", [USERS.workerB]);
  await sql(
    `insert into public.worker_profiles (profile_id, headline, about, region_id, profession_node_id, experience_level, onboarding_completed_at)
     values ($1, 'Buxgalter', 'Buxgalteriya, 1C, soliq hisobotlari', $2, $3, '3_5y', now())`,
    [USERS.workerB, r!.id, n!.id],
  );
  const [w] = await sql<{ first_name: string; node: string }>(
    "select p.first_name, w.profession_node_id as node from public.worker_profiles w join public.profiles p on p.id = w.profile_id where w.profile_id = $1",
    [USERS.workerB],
  );
  await loginAs(context, FRESH);
  await asMode(context, "employer");
  await page.goto(`/search?mode=workers&p=${w!.node}&region=all`);
  const card = page.locator("main article").filter({ hasText: w!.first_name }).first();
  await card.getByRole("button", { name: new RegExp(`^Saqlash: ${w!.first_name}`) }).click();
  await expect(card.getByRole("button", { name: new RegExp(`^Saqlangan: ${w!.first_name}`) })).toBeVisible();
  await page.goto("/saved");
  await expect(page.getByText("Saqlangan ishchilar: 1 ta")).toBeVisible();
  await expect(page.locator("main article").filter({ hasText: w!.first_name })).toHaveCount(1);
});

test("mehmon: 'Saqlanganlar' — tushuntirish va kirish; kartadagi saqlash — kirishga, keyin shu joyga", async ({ page, context }) => {
  const v = await vacancy("Buxgalter yordamchisi");
  await asGuest(context);
  await asMode(context, "worker");
  // mehmon: Profil — faqat kirish taklifi; "Saqlanganlar" sahifasi o'z tushuntirishi bilan
  await page.goto("/saved");
  await expect(page.getByRole("heading", { level: 1, name: "Saqlanganlar" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Kirish" }).last()).toHaveAttribute("href", "/auth?next=%2Fsaved");

  await page.goto(`/search?mode=jobs&p=${v.node}&region=all`);
  await page.locator("main article").filter({ hasText: "Buxgalter yordamchisi" }).getByRole("button", { name: /^Saqlash:/ }).click();
  await page.waitForURL(/\/auth\?next=/);
  expect(decodeURIComponent(new URL(page.url()).searchParams.get("next") ?? "")).toContain(`/search?mode=jobs&p=${v.node}`);
});
