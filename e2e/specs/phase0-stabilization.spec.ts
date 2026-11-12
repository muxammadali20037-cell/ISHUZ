import { expect, test } from "@playwright/test";
import { USERS, asGuest, sql } from "../support";

/**
 * 0-bosqich (barqarorlashtirish, 2026-11):
 *  - /api/health: uptime monitor uchun ochiq holat; chuqur tekshiruv (migratsiyalar) faqat CRON_SECRET bilan;
 *  - faol vakansiyasiz (bo'sh / sinov) kompaniya sahifasi qidiruv tizimiga kiritilmaydi.
 */

test("/api/health: holat ochiq, ichki ma'lumot yo'q; chuqur tekshiruv sir bilan va migratsiyalar to'liq", async ({ request }) => {
  const open = await request.get("/api/health");
  expect(open.status()).toBe(200);
  expect(open.headers()["cache-control"]).toContain("no-store");
  const body = await open.json();
  expect(body.status).toBe("ok");
  expect(body.db.ok).toBe(true);
  expect(body).not.toHaveProperty("schema");

  expect((await request.get("/api/health?deep=1")).status()).toBe(401);
  expect((await request.get("/api/health?deep=1", { headers: { authorization: "Bearer noto'g'ri" } })).status()).toBe(401);

  const deep = await request.get("/api/health?deep=1", { headers: { authorization: "Bearer e2e-cron" } });
  const d = await deep.json();
  expect(d.schema).toEqual({ ok: true, missing: [], errors: [] });
  expect(deep.status()).toBe(200);
});

test("faol vakansiyasiz kompaniya sahifasi noindex, vakansiyasi borida indekslanadi", async ({ page, context }) => {
  await asGuest(context);
  await sql("delete from public.companies where name in ('P0 Bo''sh MChJ', 'P0 Faol MChJ')");
  const [empty] = await sql<{ id: string; slug: string }>("insert into public.companies (name, created_by) values ('P0 Bo''sh MChJ', $1) returning id, slug", [USERS.employer]);
  const [full] = await sql<{ id: string; slug: string }>("insert into public.companies (name, created_by) values ('P0 Faol MChJ', $1) returning id, slug", [USERS.employer]);
  try {
    await sql(
      `insert into public.vacancies (owner_profile_id, company_id, title, region_id, description, status, salary_negotiable, published_at, expires_at)
       select $1, $2, 'P0 Kassir', r.id, 'Do''konga kassir kerak, smenali ish', 'active', true, now(), now() + interval '10 days'
       from public.regions r where r.slug = 'tashkent_city'`,
      [USERS.employer, full!.id],
    );
    await page.goto(`/company/${empty!.slug}`);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await page.goto(`/company/${full!.slug}`);
    await expect(page.locator('meta[name="robots"][content*="noindex"]')).toHaveCount(0);
  } finally {
    await sql("delete from public.vacancies where title = 'P0 Kassir'");
    await sql("delete from public.companies where id = any($1)", [[empty!.id, full!.id]]);
  }
});
