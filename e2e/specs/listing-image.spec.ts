import { expect, test } from "@playwright/test";
import { USERS, asGuest, asMode, loginAs, sql } from "../support";

/**
 * E'lon rasmi (AI, 0087; ega, 2026-11-20): egasi "Ha" desa yaratiladi va e'londa ixcham ko'rinadi. Stendda rasm modeli
 * kaliti yo'q — "Rasm yaratilsinmi?" savoli chiqmaydi (pul ketadigan so'rov hech qachon yuborilmaydi); tayyor rasm
 * (bazada "ready") e'lon sahifasida banner bo'lib chiqadi, tayyor bo'lmagani — chiqmaydi.
 */
const TITLE = "E2E rasm — farrosh";
const IMG = "/icons/icon-192.png";

async function cleanup() {
  await sql("delete from public.listing_images where owner_profile_id = $1", [USERS.employer]);
  await sql("delete from public.vacancies where owner_profile_id = $1 and title = $2", [USERS.employer, TITLE]);
}
test.beforeEach(cleanup);
test.afterEach(cleanup);

test("tayyor rasm — vakansiya sahifasida ixcham banner; tayyorlanayotgani ko'rinmaydi", async ({ page, context }) => {
  const [r] = await sql<{ id: string }>("select id from public.regions where slug = 'tashkent_city'");
  const [v] = await sql<{ id: string; slug: string }>(
    `insert into public.vacancies (owner_profile_id, title, region_id, description, status, salary_negotiable, published_at, expires_at)
     values ($1, $2, $3, 'Ofisga farrosh kerak, ish vaqti 8:00 dan 17:00 gacha', 'active', true, now(), now() + interval '10 days')
     returning id, slug`,
    [USERS.employer, TITLE, r!.id],
  );
  await sql(
    "insert into public.listing_images (entity, entity_id, owner_profile_id, status, image_url, attempts) values ('vacancy', $1, $2, 'pending', $3, 1)",
    [v!.id, USERS.employer, IMG],
  );
  await asGuest(context);
  await asMode(context, "worker");
  await page.goto(`/jobs/${v!.slug}`);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(TITLE);
  await expect(page.locator("[data-listing-photo]")).toHaveCount(0);

  await sql("update public.listing_images set status = 'ready' where entity_id = $1", [v!.id]);
  await page.reload();
  const photo = page.locator("[data-listing-photo]");
  await expect(photo).toBeVisible();
  await expect(photo).toHaveAttribute("src", IMG);
  await expect(photo).toHaveAttribute("alt", TITLE);
  // ixcham: keng banner (balandligi kengligidan ancha kichik)
  const box = (await photo.boundingBox())!;
  expect(box.height).toBeLessThan(box.width * 0.6);
});

test("kalit sozlanmagan — e'lon joylangach «Rasm yaratilsinmi?» chiqmaydi, API ham ishlamaydi", async ({ page, context }) => {
  await loginAs(context, USERS.employer);
  await asMode(context, "employer");
  const res = await page.request.post("/api/listing-image", { data: { entity: "vacancy", id: "11111111-1111-4111-8111-111111111111" } });
  expect([403, 404, 503]).toContain(res.status());
  const json = (await res.json()) as { ok: boolean; error: string };
  expect(json.ok).toBe(false);
  expect(json.error).toBe("not_configured");
  await page.goto("/post/vacancy?ai=1");
  await expect(page.locator("[data-listing-image]")).toHaveCount(0);
});
