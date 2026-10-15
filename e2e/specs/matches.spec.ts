import { expect, test } from "@playwright/test";
import { USERS, asMode, loginAs, sql } from "../support";

/**
 * R-C · haqiqiy moslik (kasb + hudud), soxta foiz yo'q:
 *  - ish qidiruvchi bosh sahifasi: profilida kasb bor — "Sizga mos ishlar", sababi yozilgan, faqat shu kasb;
 *  - ish beruvchi: /cabinet/matches da hisoblangan mos nomzod kasbi bilan ko'rinadi.
 * Regressiya: `worker_profiles → profession_nodes` bog'lanishi worker_professions (ko'p-ko'p) tufayli PostgREST'da ikki
 * ma'noli edi (PGRST201) — so'rov jim yiqilib, mos nomzodlar ro'yxati doim bo'sh, "Sizga mos ishlar" esa hech chiqmas edi.
 */

const WORKER = "7e2e0000-0000-4000-8000-0000000001c0";

async function node(name: string) {
  const [r] = await sql<{ id: string; category_id: string }>("select id, category_id from public.profession_nodes where name_uz = $1 and selectable order by depth limit 1", [name]);
  return r!;
}

test.beforeEach(async () => {
  await sql("delete from public.vacancies where owner_profile_id = $1", [USERS.employer]);
  await sql(`insert into auth.users (id, phone, phone_confirmed_at, raw_user_meta_data) values ($1, '+998907770190', now(), '{"first_name":"Laylo","last_name":"Karimova"}') on conflict (id) do nothing`, [WORKER]);
  await sql("delete from public.worker_profiles where profile_id = $1", [WORKER]);
  const oshpaz = await node("Oshpaz");
  await sql(
    `insert into public.worker_profiles (profile_id, headline, about, region_id, profession_node_id, category_id, experience_level, is_public, onboarding_completed_at)
     select $1, 'Oshpaz', 'Milliy taomlar, 4 yillik tajriba', r.id, $2, $3, '3_5y', true, now() from public.regions r where r.slug = 'tashkent_city'`,
    [WORKER, oshpaz.id, oshpaz.category_id],
  );
  for (const [title, prof] of [["Oshpaz — choyxona (M1)", "Oshpaz"], ["Kassir — supermarket (M1)", "Kassir"]] as const) {
    const n = await node(prof);
    await sql(
      `insert into public.vacancies (owner_profile_id, title, region_id, description, status, profession_node_id, salary_from, salary_type, published_at, expires_at)
       select $1, $2, r.id, 'Sinov e''loni: ' || $2 || ', 9 dan 18 gacha', 'active', $3, 5000000, 'monthly', now(), now() + interval '10 days'
       from public.regions r where r.slug = 'tashkent_city'`,
      [USERS.employer, title, n.id],
    );
  }
});
test.afterEach(async () => {
  await sql("delete from public.vacancies where owner_profile_id = $1", [USERS.employer]);
  await sql("delete from public.worker_profiles where profile_id = $1", [WORKER]);
});

test("ish qidiruvchi: profilida kasb — bosh sahifada 'Sizga mos ishlar' (kasb va hudud yozilgan), boshqa kasb yo'q", async ({ page, context }) => {
  await loginAs(context, WORKER);
  await asMode(context, "worker");
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 2, name: "Sizga mos ishlar" })).toBeVisible();
  await expect(page.getByText("Kasbingiz bo'yicha: Oshpaz · Toshkent shahri")).toBeVisible();
  const feed = page.locator("section[aria-labelledby='home-feed'] article");
  await expect(feed.filter({ hasText: "Oshpaz — choyxona (M1)" })).toHaveCount(1);
  await expect(feed.filter({ hasText: "Kassir — supermarket (M1)" })).toHaveCount(0);
  // foiz ko'rsatilmaydi (faqat sabab matni)
  await expect(page.locator("section[aria-labelledby='home-feed']")).not.toContainText("%");
});

test("ish beruvchi: /cabinet/matches — hisoblangan mos nomzod kasbi bilan ko'rinadi", async ({ page, context }) => {
  const [v] = await sql<{ id: string }>("select id from public.vacancies where owner_profile_id = $1 and title = 'Oshpaz — choyxona (M1)'", [USERS.employer]);
  const [w] = await sql<{ id: string }>("select id from public.worker_profiles where profile_id = $1", [WORKER]);
  await sql(
    `insert into public.matches (worker_id, vacancy_id, score, reasons, complete) values ($1, $2, 92, '[]'::jsonb, true)
     on conflict (worker_id, vacancy_id) do update set score = excluded.score, reasons = excluded.reasons, complete = true, hard_fail = false`,
    [w!.id, v!.id],
  );
  await loginAs(context, USERS.employer);
  await asMode(context, "employer");
  await page.goto(`/cabinet/matches?vacancy=${v!.id}`);
  const card = page.locator("section[aria-labelledby='candidate-matches'] article").filter({ hasText: "Laylo K." });
  await expect(card).toHaveCount(1);
  await expect(card).toContainText("Oshpaz");
  await expect(card).toContainText("92%");
});
