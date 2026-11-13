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
