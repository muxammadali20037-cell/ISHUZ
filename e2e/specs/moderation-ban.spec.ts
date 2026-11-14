import { expect, test } from "@playwright/test";
import { USERS, asMode, formReady, loginAs, snapshotUser, sql, stack } from "../support";

/**
 * Qat'iy taqiq (ega, 2026-11-13): erotika, diniy ekstremizm, qonunga xilof so'zlar, massaj va spa — e'lon joylanmaydi;
 * joylamoqchi bo'lgan foydalanuvchi o'sha zahoti bloklanadi; joylangan (eski) e'lonlar ham qayta tekshiriladi — e'lon
 * yashiriladi, muallif bloklanadi. Hech narsa o'chirilmaydi (admin qaytaradi). Har test oxirida holat aynan qaytariladi.
 */

const tick = (request: import("@playwright/test").APIRequestContext) =>
  request.post(`${stack.app}/api/cron/tick`, { headers: { "x-cron-secret": "e2e-cron" } });

async function banEvents(profileId: string) {
  const [r] = await sql<{ n: string }>(
    "select count(*)::text as n from public.security_events where event_type = 'moderation.auto_ban' and actor_id = $1",
    [profileId],
  );
  return Number(r!.n);
}

test("e'lon yozayotganda 'massaj' — e'lon yo'q, hisob darhol bloklanadi va /blocked ga o'tadi", async ({ page, context }) => {
  const restore = await snapshotUser(USERS.workerB);
  try {
    await loginAs(context, USERS.workerB);
    await asMode(context, "worker");
    await page.goto("/post/worker");
    await formReady(page);
    const chat = page.locator("[data-listing-chat]");
    await chat.locator("[data-chat-input]").fill("Men massajchiman, ish qidiryapman");
    await chat.getByRole("button", { name: "Boshlash" }).click();
    await expect(page.getByText("Hisobingiz bloklangan").first()).toBeVisible();
    await expect.poll(async () => (await sql<{ b: boolean }>("select is_blocked as b from public.profiles where id = $1", [USERS.workerB]))[0]!.b).toBe(true);
    const [p] = await sql<{ reason: string }>("select blocked_reason as reason from public.profiles where id = $1", [USERS.workerB]);
    expect(p!.reason).toBe("auto_moderation:sexual_services:rule_strict_massage");
    expect(await banEvents(USERS.workerB)).toBeGreaterThan(0);
    // ishchi e'loni ommadan yashirildi
    const [w] = await sql<{ pub: boolean }>("select bool_or(is_public) as pub from public.worker_profiles where profile_id = $1", [USERS.workerB]);
    expect(w!.pub ?? false).toBe(false);
    await page.goto("/cabinet");
    await page.waitForURL(/\/blocked$/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  } finally {
    await restore();
  }
});

test("joylangan vakansiya moderatsiyada (qoida) — rad etiladi, muallif bloklanadi, boshqa e'lonlari yashiriladi", async ({ request }) => {
  const restore = await snapshotUser(USERS.employer);
  try {
    await sql("delete from public.vacancies where owner_profile_id = $1 and title like 'E2E taqiq%'", [USERS.employer]);
    const [r] = await sql<{ id: string }>("select id from public.regions where slug = 'tashkent_city'");
    const [bad] = await sql<{ id: string }>(
      `insert into public.vacancies (owner_profile_id, title, region_id, description, status, salary_negotiable, expires_at)
       values ($1, 'E2E taqiq: Spa salonga administrator kerak', $2, 'Kechki smena, yaxshi maosh', 'pending_review', true, now() + interval '10 days')
       returning id`,
      [USERS.employer, r!.id],
    );
    expect((await tick(request)).ok()).toBe(true);
    await expect
      .poll(async () => (await sql<{ s: string }>("select status::text as s from public.vacancies where id = $1", [bad!.id]))[0]!.s)
      .toBe("rejected");
    const [p] = await sql<{ b: boolean; reason: string }>("select is_blocked as b, blocked_reason as reason from public.profiles where id = $1", [USERS.employer]);
    expect(p!.b).toBe(true);
    expect(p!.reason).toBe("auto_moderation:sexual_services:rule_strict_spa");
    // boshqa faol e'lonlari ham ommada qolmaydi
    const [open] = await sql<{ n: string }>(
      "select count(*)::text as n from public.vacancies where owner_profile_id = $1 and status in ('active', 'pending_review', 'paused')",
      [USERS.employer],
    );
    expect(open!.n).toBe("0");
    await sql("delete from public.vacancies where id = $1", [bad!.id]);
  } finally {
    await restore();
  }
});

test("eski (joylangan) e'lonlar yangi qoidalar bilan qayta tekshiriladi: ustalar e'lonida 'massaj' — yashiriladi, muallif bloklanadi", async ({ request }) => {
  const restore = await snapshotUser(USERS.workerB);
  try {
    await sql("delete from public.master_listings where slug = 'e2e-eski-massaj'");
    await sql(
      `insert into public.master_listings (owner_profile_id, category_id, slug, display_name, title, description, phone, phone_public, status, published_at)
       select $1, c.id, 'e2e-eski-massaj', 'Eski usta', 'Uyda xizmat (E2E)', 'Massaj qilaman, uyga boraman', '+998901112233', false, 'active', now()
       from public.master_categories c where c.slug = 'electric'`,
      [USERS.workerB],
    );
    // qoidalar o'zgargandan keyingi birinchi o'tish (kursor boshidan)
    await sql("delete from public.app_settings where key = 'moderation_rules_sweep'");
    expect((await tick(request)).ok()).toBe(true);
    await expect
      .poll(async () => (await sql<{ s: string }>("select status::text as s from public.master_listings where slug = 'e2e-eski-massaj'"))[0]!.s)
      .toBe("rejected");
    const [p] = await sql<{ b: boolean; reason: string }>("select is_blocked as b, blocked_reason as reason from public.profiles where id = $1", [USERS.workerB]);
    expect(p!.b).toBe(true);
    expect(p!.reason).toBe("auto_moderation:sexual_services:sweep_rule_strict_massage");
    // ikkinchi o'tish — hammasi tekshirilgan, qayta bloklamaydi (kursor tugagan)
    const before = await banEvents(USERS.workerB);
    await tick(request);
    expect(await banEvents(USERS.workerB)).toBe(before);
  } finally {
    await sql("delete from public.master_listings where slug = 'e2e-eski-massaj'");
    await restore();
  }
});

test("qayta tekshiruv e'lonning O'ZINI olib tashlaydi: admin muallif, qo'shimcha kasb 'Massajchi', namuna e'lon — toza e'lon qoladi", async ({ request }) => {
  test.setTimeout(120_000);
  const restoreEmployer = await snapshotUser(USERS.employer);
  const restoreWorker = await snapshotUser(USERS.workerB);
  const ids: { vacancies: string[]; worker?: string } = { vacancies: [] };
  try {
    const [r] = await sql<{ id: string }>("select id from public.regions where slug = 'tashkent_city'");
    const [massage] = await sql<{ id: string }>("select id from public.profession_nodes where name_uz = 'Massajchi' limit 1");
    const [seller] = await sql<{ id: string }>("select id from public.profession_nodes where selectable and is_active and name_uz = 'Sotuvchi' limit 1");
    const [cat] = await sql<{ id: string }>("select id from public.categories where is_active order by sort_order limit 1");
    // ish beruvchi — admin: bloklanmaydi, lekin taqiqlangan e'loni baribir ommadan olinadi
    await sql(
      `insert into public.admin_users (profile_id, role, permissions, is_active) values ($1, 'super_admin', '{}', true)
       on conflict (profile_id) do update set is_active = true`,
      [USERS.employer],
    );
    const [bad] = await sql<{ id: string }>(
      `insert into public.vacancies (owner_profile_id, title, region_id, description, status, salary_negotiable, published_at, expires_at)
       values ($1, 'E2E eski: Massaj xonasiga usta kerak', $2, 'Kunduzgi smena', 'active', true, now(), now() + interval '10 days') returning id`,
      [USERS.employer, r!.id],
    );
    const [clean] = await sql<{ id: string }>(
      `insert into public.vacancies (owner_profile_id, title, region_id, description, status, salary_negotiable, published_at, expires_at)
       values ($1, 'E2E toza: do''konga sotuvchi kerak', $2, 'Kassa bilan ishlash', 'active', true, now(), now() + interval '10 days') returning id`,
      [USERS.employer, r!.id],
    );
    ids.vacancies.push(bad!.id, clean!.id);
    // ishchi: asosiy kasbi toza (Sotuvchi), qo'shimcha kasbi — Massajchi (eski katalogdan, 0078 gacha tanlangan)
    const [w] = await sql<{ id: string }>(
      `insert into public.worker_profiles (profile_id, headline, about, region_id, profession_node_id, experience_level, onboarding_completed_at, is_public)
       values ($1, 'Sotuvchi', 'Do''konda ishlaganman', $2, $3, '1_2y', now(), true) returning id`,
      [USERS.workerB, r!.id, seller!.id],
    );
    ids.worker = w!.id;
    await sql("insert into public.worker_professions (worker_id, node_id) values ($1, $2)", [w!.id, massage!.id]);
    // namuna (demo) e'lon — egasiz
    await sql("delete from public.demo_vacancies where slug = 'namuna-e2e-massaj'");
    await sql("insert into public.demo_vacancies (slug, category_id, title_uz, title_ru) values ('namuna-e2e-massaj', $1, 'Massajchi', 'Массажист')", [cat!.id]);

    await sql("delete from public.app_settings where key = 'moderation_rules_sweep'");
    await expect
      .poll(
        async () => {
          await tick(request);
          const [s] = await sql<{ v: string; w: boolean; d: string }>(
            `select (select status::text from public.vacancies where id = $1) as v,
                    (select is_public from public.worker_profiles where id = $2) as w,
                    (select count(*)::text from public.demo_vacancies where slug = 'namuna-e2e-massaj') as d`,
            [bad!.id, w!.id],
          );
          return `${s!.v}|${s!.w}|${s!.d}`;
        },
        { timeout: 60_000, intervals: [500, 1_000, 2_000] },
      )
      .toBe("hidden|false|0");

    const [emp] = await sql<{ b: boolean }>("select is_blocked as b from public.profiles where id = $1", [USERS.employer]);
    expect(emp!.b).toBe(false); // admin — bloklanmaydi
    const [c] = await sql<{ s: string }>("select status::text as s from public.vacancies where id = $1", [clean!.id]);
    expect(c!.s).toBe("active"); // toza e'lon tegilmaydi
    const [wb] = await sql<{ b: boolean; reason: string }>("select is_blocked as b, blocked_reason as reason from public.profiles where id = $1", [USERS.workerB]);
    expect(wb!.b).toBe(true);
    expect(wb!.reason).toBe("auto_moderation:sexual_services:sweep_rule_strict_massage");
  } finally {
    await sql("delete from public.admin_users where profile_id = $1", [USERS.employer]);
    await sql("delete from public.demo_vacancies where slug = 'namuna-e2e-massaj'");
    if (ids.vacancies.length) await sql("delete from public.vacancies where id = any($1::uuid[])", [ids.vacancies]);
    if (ids.worker) await sql("delete from public.worker_profiles where id = $1", [ids.worker]);
    await restoreWorker();
    await restoreEmployer();
  }
});

test("toza e'lon (yolg'on topilma yo'q): 'Sport seksiyasiga murabbiy', 'React SPA' — bloklanmaydi", async ({ request }) => {
  const restore = await snapshotUser(USERS.employer);
  try {
    const [r] = await sql<{ id: string }>("select id from public.regions where slug = 'tashkent_city'");
    const [ok] = await sql<{ id: string }>(
      `insert into public.vacancies (owner_profile_id, title, region_id, description, status, salary_negotiable, expires_at)
       values ($1, 'E2E taqiq emas: Sport seksiyasiga murabbiy kerak', $2, 'React SPA bilan tanish bo''lsa yaxshi, narkolog ko''rigidan o''tgan', 'pending_review', true, now() + interval '10 days')
       returning id`,
      [USERS.employer, r!.id],
    );
    await tick(request);
    const [p] = await sql<{ b: boolean }>("select is_blocked as b from public.profiles where id = $1", [USERS.employer]);
    expect(p!.b).toBe(false);
    const [v] = await sql<{ s: string }>("select status::text as s from public.vacancies where id = $1", [ok!.id]);
    expect(v!.s).not.toBe("rejected");
    await sql("delete from public.vacancies where id = $1", [ok!.id]);
  } finally {
    await restore();
  }
});
