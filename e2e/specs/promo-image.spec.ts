import { expect, test } from "@playwright/test";
import { USERS, sql } from "../support";

/**
 * Vakansiya rasmi (ega, 2026-11-16: "e'lon guruhga rasm bilan borsin, har kasbga — kasbga mos kiyingan odam"):
 * /api/promo/vacancy/<slug> — kvadrat (kanal posti, Instagram), story va havola oldindan ko'rinishi (og) PNG bo'lib chiziladi;
 * vakansiya sahifasining og:image'i shu rasm. Qoralama — begonaga ko'rinmaydi.
 */

const OWNER = USERS.employer;

async function vacancy(status: "active" | "draft"): Promise<string> {
  const [row] = await sql<{ slug: string }>(
    `insert into public.vacancies (owner_profile_id, title, region_id, category_id, profession_node_id, description, status, salary_from, salary_type, published_at, expires_at)
     select $1, 'Oshpaz kerak', r.id, n.category_id, n.id, 'Milliy taomlar oshpazi kerak.', $2::public.vacancy_status, 5000000, 'monthly', now(), now() + interval '10 days'
     from public.regions r, lateral (select id, category_id from public.profession_nodes where name_uz = 'Oshpaz' and selectable order by depth limit 1) n
     where r.slug = 'tashkent_city'
     returning slug`,
    [OWNER, status],
  );
  return row!.slug;
}

/** PNG sarlavhasidan o'lcham (IHDR) */
function pngSize(buf: Buffer): { width: number; height: number } {
  expect(buf.subarray(1, 4).toString("ascii")).toBe("PNG");
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

test.beforeEach(async () => {
  await sql("delete from public.vacancies where owner_profile_id = $1", [OWNER]);
});
test.afterAll(async () => {
  await sql("delete from public.vacancies where owner_profile_id = $1", [OWNER]);
});

test("kvadrat, story va og — PNG, to'g'ri o'lchamda; sahifaning og:image — shu rasm", async ({ request, page }) => {
  const slug = await vacancy("active");
  for (const [f, w, h] of [
    ["square", 1080, 1080],
    ["story", 1080, 1920],
    ["og", 1200, 630],
  ] as const) {
    const res = await request.get(`/api/promo/vacancy/${slug}?f=${f}`);
    expect(res.status(), f).toBe(200);
    expect(res.headers()["content-type"], f).toContain("image/png");
    const body = await res.body();
    expect(pngSize(body), f).toEqual({ width: w, height: h });
    // odam chizmasi bilan rasm bo'sh fon emas
    expect(body.length, f).toBeGreaterThan(40_000);
  }
  await page.goto(`/jobs/${slug}`);
  await expect(page.locator('meta[property="og:image"]').first()).toHaveAttribute("content", new RegExp(`/api/promo/vacancy/${slug}\\?f=og`));
});

test("qoralama vakansiyaning rasmi begonaga ko'rinmaydi", async ({ request }) => {
  const slug = await vacancy("draft");
  expect((await request.get(`/api/promo/vacancy/${slug}?f=square`)).status()).toBe(404);
});
