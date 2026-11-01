import fs from "node:fs";
import path from "node:path";
import { test, type Browser } from "@playwright/test";
import { asMode, loginAs, sql, stack } from "../support";
import { DEMO, cleanDemo, seedDemo } from "./demo-seed";

/**
 * Redizayn 2026-11 (docs/REDESIGN_2026-11.md) — besh namunaga mos ekranlar, kompyuter (1440) va telefon (390). Faqat lokal stendda:
 *   npx playwright test -c e2e/screens/shots.config.ts e2e/screens/redesign-2026-11.shots.ts
 * Namunaviy arizalar: demo vakansiyalariga bir nechta demo ishchidan (turli holatlarda) — skrinshotdan keyin o'chiriladi.
 */
const OUT = path.join(__dirname, "../../docs/screenshots/redesign-2026-11");
const host = new URL(stack.app).hostname;
/** onboarding uchun yangi foydalanuvchi (hali profili yo'q) */
const NEWCOMER = "7e2e0000-0000-4000-8000-000000000096";
const EXTRA = [
  ["7e2e0000-0000-4000-8000-000000000092", "Malika", "Yusupova", "Kassir"],
  ["7e2e0000-0000-4000-8000-000000000093", "Jasur", "Toshmatov", "Haydovchi"],
  ["7e2e0000-0000-4000-8000-000000000094", "Nodira", "Aliyeva", "Buxgalter"],
  ["7e2e0000-0000-4000-8000-000000000095", "Bekzod", "Rahimov", "Sotuvchi"],
] as const;

test.afterAll(async () => {
  await cleanDemo();
  await sql("delete from public.saved_items where profile_id = $1", [DEMO.worker]);
  await sql("delete from public.worker_profiles where profile_id = any($1::uuid[])", [EXTRA.map((e) => e[0])]);
});

async function seedApplications() {
  for (const [id, first, last, headline] of EXTRA) {
    await sql(`insert into auth.users (id, phone, phone_confirmed_at, raw_user_meta_data) values ($1, $2, now(), $3) on conflict (id) do nothing`, [
      id,
      `+99890111${id.slice(-4)}`,
      JSON.stringify({ first_name: first, last_name: last }),
    ]);
    await sql(
      `insert into public.worker_profiles (profile_id, headline, category_id, region_id, experience_level, onboarding_completed_at, is_public)
       select $1, $2, c.id, r.id, '1_2y', now(), true from public.categories c, public.regions r where c.slug = 'sales' and r.slug = 'tashkent_city'
       on conflict (profile_id) do nothing`,
      [id, headline],
    );
  }
  const apps: [string, string, string, number][] = [
    ["Sotuv menejeri", DEMO.worker, "interview", 3],
    ["Kassir", DEMO.worker, "viewed", 20],
    ["Ofitsiant", DEMO.worker, "sent", 30],
    ["Haydovchi-ekspeditor", DEMO.worker, "rejected", 60],
    ["Kassir", EXTRA[0][0], "shortlisted", 5],
    ["Haydovchi-ekspeditor", EXTRA[1][0], "offered", 8],
    ["Frontend dasturchi (React)", EXTRA[2][0], "sent", 1],
    ["Sotuv menejeri", EXTRA[3][0], "hired", 90],
    ["Kassir", EXTRA[3][0], "sent", 2],
  ];
  for (const [title, profile, status, hours] of apps) {
    await sql(
      `insert into public.applications (vacancy_id, worker_id, status, created_at, updated_at)
       select v.id, w.id, $3::application_status, now() - make_interval(hours => $4), now() - make_interval(hours => $4)
       from public.vacancies v, public.worker_profiles w where v.title = $1 and v.owner_profile_id = $5 and w.profile_id = $2
       on conflict do nothing`,
      [title, profile, status, hours, DEMO.employer],
    );
  }
  await sql(
    `insert into public.saved_items (profile_id, vacancy_id) select $1, v.id from public.vacancies v
     where v.owner_profile_id = $2 and v.title in ('Frontend dasturchi (React)', 'Call-markaz operatori (talabalar uchun)', 'Bosh buxgalter (1C, soliq hisobotlari va moliyaviy tahlil bo''yicha tajribali mutaxassis)')
     on conflict do nothing`,
    [DEMO.worker, DEMO.employer],
  );
}

async function capture(browser: Browser, who: "guest" | "worker" | "employer" | "new", pages: [string, string][]) {
  for (const width of [1440, 390]) {
    const c = await browser.newContext({ baseURL: stack.app, viewport: { width, height: width < 768 ? 844 : 900 }, reducedMotion: "reduce", storageState: { cookies: [], origins: [] } });
    if (who === "worker" || who === "employer") {
      await loginAs(c, who === "employer" ? DEMO.employer : DEMO.worker);
      await asMode(c, who === "employer" ? "employer" : "worker");
    }
    if (who === "new") await loginAs(c, NEWCOMER);
    await c.addCookies([
      { name: "ishuz_locale", value: "uz", domain: host, path: "/" },
      { name: "ib_intro", value: "1", domain: host, path: "/" },
    ]);
    const p = await c.newPage();
    for (const [name, url] of pages) {
      await p.goto(url);
      await p.waitForLoadState("networkidle").catch(() => undefined);
      await p.waitForTimeout(300);
      fs.mkdirSync(OUT, { recursive: true });
      await p.screenshot({ path: path.join(OUT, `${name}-${width}.jpg`), type: "jpeg", quality: 74, fullPage: width < 768 ? false : name !== "home" });
    }
    await c.close();
  }
}

test("redizayn 2026-11: bosh sahifa, vakansiya, kabinet, arizalar, onboarding", async ({ browser }) => {
  test.setTimeout(300_000);
  const slug = await seedDemo();
  await seedApplications();
  await sql(`insert into auth.users (id, phone, phone_confirmed_at, raw_user_meta_data) values ($1, '+998901110096', now(), '{"first_name":"Botir"}') on conflict (id) do nothing`, [
    NEWCOMER,
  ]);
  await capture(browser, "guest", [
    ["home", "/"],
    ["job", `/jobs/${slug}`],
    ["role", "/start/rol"],
  ]);
  await capture(browser, "worker", [
    ["worker-home", "/"],
    ["worker-job", `/jobs/${slug}`],
  ]);
  await capture(browser, "employer", [["employer-applications", "/employer/applications"]]);
  await capture(browser, "new", [
    ["onboarding-employer", "/onboarding/employer"],
    ["onboarding-worker", "/onboarding/worker"],
  ]);
});
