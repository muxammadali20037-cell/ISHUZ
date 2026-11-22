import { expect, test } from "@playwright/test";
import { USERS, asGuest, asMode, loginAs, sql, stack } from "../support";

/**
 * Moslik olib tashlandi (ega, 2026-11-22: "moslikni hamma joydan olib tashla, umuman kerak emas — ish beruvchilar uchun
 * ham, ish qidiruvchilar uchun ham"; bildirishnomalar: "ular ham o'chsin"):
 *  - kartalarda, vakansiya va ishchi sahifalarida "Mos"/foiz/daraja yo'q — bazada hisoblangan moslik bo'lsa ham;
 *  - eski havolalar (/cabinet/matches, /jobs/…/moslik, /ai-alerts) boshi berk emas — tegishli sahifaga olib boradi;
 *  - moslik bildirishnomalari (new_matching_*, ai_alert, ai_worker_alert) ro'yxatda va sonda ko'rinmaydi, Telegram'ga
 *    yuborilmaydi (o'qilgan va "skipped" deb belgilanadi); boshqa bildirishnomalar o'z holicha.
 */

const WORKER = "7e2e0000-0000-4000-8000-0000000001c0";
const TAG = "NM1";

async function node(name: string) {
  const [r] = await sql<{ id: string; category_id: string }>("select id, category_id from public.profession_nodes where name_uz = $1 and selectable order by depth limit 1", [name]);
  return r!;
}

async function seed() {
  await sql("delete from public.vacancies where owner_profile_id = $1", [USERS.employer]);
  // ish beruvchi profili tayyor (aks holda kabinet o'rniga profil savollari ochiladi)
  await sql(
    `insert into public.employer_profiles (profile_id, employer_type, display_name, onboarding_completed_at) values ($1, 'person', 'Dilnoza', now())
     on conflict (profile_id) do update set onboarding_completed_at = coalesce(public.employer_profiles.onboarding_completed_at, now())`,
    [USERS.employer],
  );
  await sql(`insert into auth.users (id, phone, phone_confirmed_at, raw_user_meta_data) values ($1, '+998907770190', now(), '{"first_name":"Laylo","last_name":"Karimova"}') on conflict (id) do nothing`, [WORKER]);
  await sql("delete from public.worker_profiles where profile_id = $1", [WORKER]);
  const oshpaz = await node("Oshpaz");
  await sql(
    `insert into public.worker_profiles (profile_id, headline, about, region_id, profession_node_id, category_id, experience_level, is_public, onboarding_completed_at)
     select $1, 'Oshpaz', 'Milliy taomlar, 4 yillik tajriba', r.id, $2, $3, '3_5y', true, now() from public.regions r where r.slug = 'tashkent_city'`,
    [WORKER, oshpaz.id, oshpaz.category_id],
  );
  const [v] = await sql<{ id: string; slug: string }>(
    `insert into public.vacancies (owner_profile_id, title, region_id, description, status, profession_node_id, salary_from, salary_type, published_at, expires_at)
     select $1, $2, r.id, 'Sinov e''loni: choyxonaga oshpaz, 9 dan 18 gacha', 'active', $3, 5000000, 'monthly', now(), now() + interval '10 days'
     from public.regions r where r.slug = 'tashkent_city' returning id, slug`,
    [USERS.employer, `Oshpaz — choyxona (${TAG})`, oshpaz.id],
  );
  const [w] = await sql<{ id: string }>("select id from public.worker_profiles where profile_id = $1", [WORKER]);
  // bazada hisoblangan moslik bor — baribir hech qayerda ko'rinmasligi kerak
  await sql(
    `insert into public.matches (worker_id, vacancy_id, score, reasons, complete) values ($1, $2, 92, '[]'::jsonb, true)
     on conflict (worker_id, vacancy_id) do update set score = excluded.score, reasons = excluded.reasons, complete = true, hard_fail = false`,
    [w!.id, v!.id],
  );
  return { vacancy: v!, workerId: w!.id };
}

test.afterEach(async () => {
  await sql("delete from public.vacancies where owner_profile_id = $1", [USERS.employer]);
  await sql("delete from public.worker_profiles where profile_id = $1", [WORKER]);
  await sql("delete from public.notifications where profile_id = $1 and payload->>'e2e' = $2", [USERS.workerB, TAG]);
});

const NO_MATCH = /\d+\s?% mos|Sizga mos|Juda mos|Yaxshi mos|Qisman mos|Moslik/;

test("ish beruvchi: vakansiya sahifasi, ishchilar ro'yxati va ishchi sahifasida moslik yo'q; eski «Mos ishchilar» havolasi — E'lonlarimga", async ({ page, context }) => {
  const { vacancy, workerId } = await seed();
  await loginAs(context, USERS.employer);
  await asMode(context, "employer");

  await page.goto(`/employer/vacancies/${vacancy.id}`);
  await expect(page.getByRole("main")).toContainText(`Oshpaz — choyxona (${TAG})`);
  await expect(page.locator("#matching")).toHaveCount(0);
  await expect(page.getByRole("main").getByText(NO_MATCH)).toHaveCount(0);

  await page.goto("/search?mode=workers&any=1&region=all");
  const card = page.locator("main article").filter({ hasText: "Laylo K." });
  await expect(card).toHaveCount(1);
  await expect(card.getByText(NO_MATCH)).toHaveCount(0);

  await page.goto(`/workers/${workerId}`);
  await expect(page.getByRole("main")).toContainText("Laylo");
  await expect(page.getByRole("main").getByText(NO_MATCH)).toHaveCount(0);
  await expect(page.locator("main svg text", { hasText: "%" })).toHaveCount(0);

  await page.goto(`/cabinet/matches?vacancy=${vacancy.id}`);
  await expect(page).toHaveURL(/\/cabinet\/elonlar(\?|$)/);
});

test("ish izlovchi va mehmon: vakansiya kartasi va sahifasida moslik yo'q; /jobs/…/moslik va /ai-alerts — boshi berk emas", async ({ page, context }) => {
  const { vacancy } = await seed();
  await asGuest(context);
  await asMode(context, "worker");
  await page.goto(`/jobs/${vacancy.slug}/moslik`);
  await expect(page).toHaveURL(new RegExp(`/jobs/${vacancy.slug}$`));

  await loginAs(context, USERS.workerB);
  await page.goto("/search?mode=jobs&any=1&region=all");
  const card = page.locator("main article").filter({ hasText: `Oshpaz — choyxona (${TAG})` });
  await expect(card).toHaveCount(1);
  await expect(card.getByText(NO_MATCH)).toHaveCount(0);

  await page.goto(`/jobs/${vacancy.slug}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`Oshpaz — choyxona (${TAG})`);
  await expect(page.getByRole("main").getByText(NO_MATCH)).toHaveCount(0);

  await page.goto("/ai-alerts?role=worker");
  await expect(page).toHaveURL(/\/cabinet(\?|$)/);
  await expect(page.getByRole("main")).not.toContainText("PRO kuzatuv");
});

test("moslik bildirishnomalari: ro'yxatda va sonda yo'q, Telegram'ga yuborilmaydi; boshqasi o'z holicha", async ({ page, context, request }) => {
  await sql("delete from public.notifications where profile_id = $1", [USERS.workerB]);
  await sql(
    `insert into public.notifications (profile_id, type, payload, link) values
       ($1, 'new_matching_vacancy', jsonb_build_object('e2e', $2::text, 'vacancy_title', 'NM Oshpaz (moslik)', 'count', 1), '/jobs'),
       ($1, 'system', jsonb_build_object('e2e', $2::text, 'kind', 'ai_alert', 'title', 'NM Kassir (ai)'), '/jobs'),
       ($1, 'system', jsonb_build_object('e2e', $2::text, 'kind', 'listing_expiring'), '/cabinet/elonlar')`,
    [USERS.workerB, TAG],
  );
  await loginAs(context, USERS.workerB);
  await asMode(context, "worker");
  await page.goto("/notifications");
  const main = page.getByRole("main");
  await expect(main.getByText("E'loningiz ertaga tugaydi")).toBeVisible();
  await expect(main.getByText(/NM Oshpaz|NM Kassir|mos yangi ish/)).toHaveCount(0);

  // fon ishi: moslik xabarlari Telegram'ga ketmaydi — o'qilgan va "skipped" (matching_off)
  const tick = await request.post(`${stack.app}/api/cron/tick`, { headers: { "x-cron-secret": "e2e-cron" } });
  expect(tick.ok()).toBe(true);
  const rows = await sql<{ kind: string; tg_error: string | null; read: boolean }>(
    `select coalesce(payload->>'kind', type::text) as kind, tg_error, read_at is not null as read
       from public.notifications where profile_id = $1 and payload->>'e2e' = $2 order by kind`,
    [USERS.workerB, TAG],
  );
  expect(rows).toEqual([
    { kind: "ai_alert", tg_error: "matching_off", read: true },
    expect.objectContaining({ kind: "listing_expiring", read: false }),
    { kind: "new_matching_vacancy", tg_error: "matching_off", read: true },
  ]);
  expect(rows[1]!.tg_error).not.toBe("matching_off");
});
