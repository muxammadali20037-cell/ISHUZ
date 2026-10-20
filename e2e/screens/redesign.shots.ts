import fs from "node:fs";
import path from "node:path";
import { expect, test, type BrowserContext } from "@playwright/test";
import { asGuest, asMode, loginAs, sql, stack } from "../support";

/**
 * Redizayn oldin/keyin: 5 ta ekran × 390 va 1440 px, bir xil (faqat lokal stenddagi) namunaviy ma'lumot bilan.
 * Ma'lumot har ishga tushishda qayta yoziladi (aniq id'lar) — "oldin" va "keyin" bir xil holatda olinadi.
 */
const TAG = process.env.SHOTS_TAG ?? "before";
const OUT = path.join(__dirname, "../../docs/screenshots/redesign-2026-10");
const EMP = "7e2e0000-0000-4000-8000-000000000090";
const WRK = "7e2e0000-0000-4000-8000-000000000091";
const COMPANY = "7e2e0000-0000-4000-8000-0000000000c1";

async function seed() {
  await sql("delete from public.vacancies where owner_profile_id = $1", [EMP]);
  await sql(
    `insert into auth.users (id, phone, phone_confirmed_at, raw_user_meta_data) values
       ($1, '+998901110090', now(), '{"first_name":"Dilnoza","last_name":"Rahimova"}'),
       ($2, '+998901110091', now(), '{"first_name":"Aziz","last_name":"Karimov"}')
     on conflict (id) do nothing`,
    [EMP, WRK],
  );
  await sql(
    `insert into public.companies (id, name, slug, verification_status, verified_at, region_id, created_by)
     select $1, 'Orient Savdo', 'orient-savdo-demo', 'verified', now(), r.id, $2 from public.regions r where r.slug = 'tashkent_city'
     on conflict (id) do update set name = excluded.name, verification_status = 'verified'`,
    [COMPANY, EMP],
  );
  await sql(`insert into public.company_members (company_id, profile_id, role) values ($1, $2, 'owner') on conflict do nothing`, [COMPANY, EMP]);
  await sql(
    `insert into public.employer_profiles (profile_id, employer_type, display_name, onboarding_completed_at, company_id)
     values ($1, 'company', 'Orient Savdo', now(), $2)
     on conflict (profile_id) do update set onboarding_completed_at = now(), company_id = excluded.company_id`,
    [EMP, COMPANY],
  ).catch(async () => {
    // company_id ustuni bo'lmasa — eskicha
    await sql(
      `insert into public.employer_profiles (profile_id, employer_type, display_name, onboarding_completed_at) values ($1, 'company', 'Orient Savdo', now())
       on conflict (profile_id) do update set onboarding_completed_at = now()`,
      [EMP],
    );
  });
  await sql("update public.profiles set active_role = 'employer' where id = $1", [EMP]);
  await sql("delete from public.worker_profiles where profile_id = $1", [WRK]);
  await sql(
    `insert into public.worker_profiles (profile_id, headline, category_id, region_id, district_id, experience_level, onboarding_completed_at, is_public)
     select $1, 'Sotuvchi', c.id, r.id, d.id, '1_2y', now(), true
     from public.categories c, public.regions r join public.districts d on d.region_id = r.id
     where c.slug = 'sales' and r.slug = 'tashkent_city' and d.name_uz = 'Chilonzor tumani'`,
    [WRK],
  );
  await sql("update public.profiles set active_role = 'worker' where id = $1", [WRK]);
  const desc =
    "Nima qilasiz:\n— mijozlar bilan ishlash va savdo rejasini bajarish;\n— buyurtmalarni rasmiylashtirish.\n\nTalablar:\n— muloqotga ochiqlik;\n— kamida 1 yil savdo tajribasi.\n\nSharoitlar:\n— rasmiy ishga joylashish;\n— tushlik bepul;\n— oyiga ikki marta oylik.";
  const rows: [string, string, string, number | null, number | null, string, boolean, string, string, number, string, boolean, number][] = [
    // title, category, district, from, to, salary_type, negotiable, schedule, employment, exp months, age, remote, positions
    ["Sotuv menejeri", "sales", "Chilonzor tumani", 5_000_000, 8_000_000, "monthly", false, "5_2", "full_time", 12, "40 minutes", false, 1],
    ["Kassir", "sales", "Yunusobod tumani", 4_500_000, null, "monthly", false, "shift", "full_time", 0, "2 hours", false, 2],
    ["Yuk tashuvchi (bir kunlik ish)", "logistics", "Sirg'ali tumani", 250_000, 300_000, "daily", false, "flexible", "temporary", 0, "5 hours", false, 6],
    ["Ofitsiant", "restaurant", "Mirobod tumani", null, null, "negotiable", true, "6_1", "full_time", 0, "1 day", false, 1],
    ["Bosh buxgalter (1C, soliq hisobotlari va moliyaviy tahlil bo'yicha tajribali mutaxassis)", "finance", "Yakkasaroy tumani", 12_000_000, 15_000_000, "monthly", false, "5_2", "full_time", 36, "1 day 3 hours", false, 1],
    ["Frontend dasturchi (React)", "it", "Mirzo Ulug'bek tumani", 15_000_000, 20_000_000, "monthly", false, "flexible", "remote", 24, "2 days", true, 1],
    ["Haydovchi-ekspeditor", "driver", "Yangihayot tumani", 6_000_000, null, "monthly", false, "6_1", "full_time", 12, "3 days", false, 2],
    ["Call-markaz operatori (talabalar uchun)", "call_center", "Shayxontohur tumani", 3_500_000, null, "monthly", false, "shift", "part_time", 0, "4 days", false, 5],
  ];
  for (const [title, cat, district, from, to, stype, neg, schedule, employment, exp, age, remote, positions] of rows) {
    await sql(
      `insert into public.vacancies (owner_profile_id, company_id, title, category_id, region_id, district_id, description, status,
         salary_from, salary_to, salary_type, salary_negotiable, schedule, employment_type, experience_min_months, is_remote,
         positions_count, student_friendly, published_at, expires_at)
       select $1, $2, $3, c.id, r.id, d.id, $4, 'active', $5, $6, $7::public.salary_type, $8, $9::public.work_schedule, $10::public.employment_type, $11, $12,
              $13, $3 like '%talabalar%', now() - $14::interval, now() + interval '7 days'
       from public.categories c, public.regions r left join public.districts d on d.region_id = r.id and d.name_uz = $15
       where c.slug = $16 and r.slug = 'tashkent_city'`,
      [EMP, COMPANY, title, desc, from, to, stype, neg, schedule, employment, exp, remote, positions, age, district, cat],
    );
  }
  const [v] = await sql<{ slug: string }>("select slug from public.vacancies where owner_profile_id = $1 and title = 'Sotuv menejeri'", [EMP]);
  return v!.slug;
}

/** Namunaviy e'lonlar boshqa E2E testlar natijasiga aralashmasin (stend umumiy) — skrinshotdan keyin o'chiriladi */
test.afterAll(async () => {
  await sql("delete from public.vacancies where owner_profile_id = $1", [EMP]);
});

async function as(ctx: BrowserContext, who: "worker" | "employer") {
  await loginAs(ctx, who === "worker" ? WRK : EMP);
  await asMode(ctx, who);
}

const shot = async (page: import("@playwright/test").Page, name: string, width: number) => {
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.waitForTimeout(500);
  fs.mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: path.join(OUT, `${TAG}-${name}-${width}.jpg`), type: "jpeg", quality: 72 });
  await page.screenshot({ path: path.join(OUT, `${TAG}-${name}-${width}-full.jpg`), type: "jpeg", quality: 60, fullPage: true });
};

test("redizayn: 5 ekran × 390/1440", async ({ browser }) => {
  const slug = await seed();
  for (const width of [390, 1440]) {
    const viewport = { width, height: width < 768 ? 844 : 900 };
    const w = await browser.newContext({ baseURL: stack.app, viewport, reducedMotion: "reduce" });
    await asGuest(w);
    await as(w, "worker");
    const p = await w.newPage();
    await p.goto("/");
    await expect(p.getByRole("heading", { level: 1 })).toBeVisible();
    await shot(p, "1-seeker-home", width);
    await p.goto("/search?mode=jobs&any=1&region=tashkent_city&district=all");
    await shot(p, "2-search", width);
    await p.goto(`/jobs/${slug}`);
    await expect(p.getByRole("heading", { level: 1 })).toBeVisible();
    await shot(p, "3-vacancy", width);
    await w.close();

    const e = await browser.newContext({ baseURL: stack.app, viewport, reducedMotion: "reduce" });
    await asGuest(e);
    await as(e, "employer");
    const q = await e.newPage();
    await q.goto("/");
    await expect(q.getByRole("heading", { level: 1 })).toBeVisible();
    await shot(q, "4-employer-home", width);
    await q.goto("/post/vacancy");
    await shot(q, "5-post-vacancy", width);
    await e.close();
  }
});

/** Qo'shimcha holatlar (faqat "keyin"): ru tili, 360 px, mehmon (ish qidiruvchi rejimi), qidiruv 768 px */
test("redizayn: qo'shimcha holatlar (ru, 360, mehmon, planshet)", async ({ browser }) => {
  test.skip(TAG === "before", "faqat yangi dizayn uchun");
  await seed();
  const take = async (name: string, viewport: { width: number; height: number }, setup: (ctx: BrowserContext) => Promise<void>, url = "/") => {
    const ctx = await browser.newContext({ baseURL: stack.app, viewport, reducedMotion: "reduce" });
    await asGuest(ctx);
    await setup(ctx);
    const p = await ctx.newPage();
    await p.goto(url);
    await expect(p.getByRole("heading", { level: 1 }).first()).toBeVisible();
    await shot(p, name, viewport.width);
    await ctx.close();
  };
  const ru = async (ctx: BrowserContext) => {
    await as(ctx, "worker");
    await ctx.addCookies([{ name: "ishuz_locale", value: "ru", url: stack.app }]);
  };
  await take("1-seeker-home-ru", { width: 390, height: 844 }, ru);
  await take("1-seeker-home", { width: 360, height: 780 }, (ctx) => as(ctx, "worker"));
  await take("6-guest-seeker-home", { width: 390, height: 844 }, (ctx) => asMode(ctx, "worker"));
  await take("2-search-ru", { width: 390, height: 844 }, ru, "/search?mode=jobs&any=1&region=tashkent_city&district=all");
  await take("2-search", { width: 768, height: 1024 }, (ctx) => as(ctx, "worker"), "/search?mode=jobs&any=1&region=tashkent_city&district=all");
});
