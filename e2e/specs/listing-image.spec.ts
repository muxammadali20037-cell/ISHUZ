import { expect, test } from "@playwright/test";
import { USERS, asGuest, asMode, loginAs, sql } from "../support";

/**
 * E'lon rasmi (AI, 0087; ega, 2026-11-20): egasi "Ha" desa yaratiladi va e'londa ixcham ko'rinadi. Stendda OpenAI — soxta
 * (shlyuzda, kichik JPEG; pul ketadigan so'rov hech qachon yuborilmaydi). Tayyor rasm — e'lon sahifasida banner,
 * tayyorlanayotgani — yo'q; faqat egasi yarata oladi.
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
  const photo = page.locator("[data-listing-photo] img");
  await expect(photo).toBeVisible();
  await expect(photo).toHaveAttribute("src", IMG);
  await expect(photo).toHaveAttribute("alt", TITLE);
  // ega (2026-11-22): «AI rasm» yozuvi yo'q
  await expect(page.locator("[data-listing-photo] figcaption")).toHaveCount(0);
  // ixcham: keng banner (balandligi kengligidan ancha kichik)
  const box = (await photo.boundingBox())!;
  expect(box.height).toBeLessThan(box.width * 0.6);
});

test("egasi yaratadi (soxta OpenAI) → saqlanadi → e'londa va post rasmida; begona — 403", async ({ page, context }) => {
  const [r] = await sql<{ id: string }>("select id from public.regions where slug = 'tashkent_city'");
  const [v] = await sql<{ id: string; slug: string }>(
    `insert into public.vacancies (owner_profile_id, title, region_id, description, status, salary_negotiable, published_at, expires_at)
     values ($1, $2, $3, 'Ofisga farrosh kerak, ish vaqti 8:00 dan 17:00 gacha', 'active', true, now(), now() + interval '10 days')
     returning id, slug`,
    [USERS.employer, TITLE, r!.id],
  );
  // begona foydalanuvchi — rad (OpenAI'ga so'rov ham yo'q)
  await loginAs(context, USERS.workerA);
  const denied = await page.request.post("/api/listing-image", { data: { entity: "vacancy", id: v!.id } });
  expect(denied.status()).toBe(403);
  expect(await sql("select 1 from public.listing_images where entity_id = $1", [v!.id])).toHaveLength(0);

  await context.clearCookies();
  await loginAs(context, USERS.employer);
  const res = await page.request.post("/api/listing-image", { data: { entity: "vacancy", id: v!.id } });
  expect(res.status()).toBe(200);
  const body = (await res.json()) as { ok: boolean; url: string };
  expect(body.ok).toBe(true);
  expect(body.url).toMatch(new RegExp(`/listing-images/vacancy/${v!.id}-\\d+\\.jpg$`));
  const [row] = await sql<{ status: string; prompt: string }>("select status, prompt from public.listing_images where entity_id = $1", [v!.id]);
  expect(row!.status).toBe("ready");
  expect(row!.prompt).toMatch(/no text/);

  await page.goto(`/jobs/${v!.slug}`);
  await expect(page.locator("[data-listing-photo] img")).toHaveAttribute("src", body.url);
  // kanal posti rasmi — surat fonda (PNG chiziladi)
  const img = await page.request.get(`/api/promo/vacancy/${encodeURIComponent(v!.slug)}?f=post&img=1`);
  expect(img.status()).toBe(200);
  expect(img.headers()["content-type"]).toContain("image/png");
});

test("chat natijasida — karta rasm bilan (belgisiz); rasmsiz e'lon — avvalgidek (2026-11-22)", async ({ page, context }) => {
  const [n] = await sql<{ id: string; category_id: string }>("select id, category_id from public.profession_nodes where name_uz = 'Farrosh' and selectable limit 1");
  const [r] = await sql<{ id: string }>("select id from public.regions where slug = 'tashkent_city'");
  const [v] = await sql<{ id: string }>(
    `insert into public.vacancies (owner_profile_id, title, region_id, profession_node_id, category_id, description, status, salary_negotiable, published_at, expires_at)
     values ($1, $2, $3, $4, $5, 'Ofisga farrosh kerak, ish vaqti 8:00 dan 17:00 gacha', 'active', true, now(), now() + interval '10 days')
     returning id`,
    [USERS.employer, TITLE, r!.id, n!.id, n!.category_id],
  );
  await sql("insert into public.listing_images (entity, entity_id, owner_profile_id, status, image_url, attempts) values ('vacancy', $1, $2, 'ready', $3, 1)", [v!.id, USERS.employer, IMG]);
  await asGuest(context);
  await asMode(context, "worker");
  await page.goto("/");
  const box = page.locator("form[data-hydrated] #start-chat-text");
  await box.fill("Men farroshman, Toshkent shahrida ish kerak");
  await box.press("Enter");
  const last = page.locator("[data-guided-ai]").last();
  await expect(last).toHaveAttribute("data-guided-ai", /^(results|next)$/, { timeout: 20_000 });
  if ((await last.getAttribute("data-guided-ai")) === "next") {
    await box.blur();
    await last.locator("[data-guided-next-to='see']").click();
    await expect(page.locator("[data-guided-ai]").last()).toHaveAttribute("data-guided-ai", "results", { timeout: 20_000 });
  }
  const card = page.locator("[data-ai-card='job']").filter({ hasText: TITLE });
  await expect(card.locator("[data-ai-card-image='ai'] img")).toHaveAttribute("src", IMG);
  await expect(card.locator("[data-ai-card-image='ai'] figcaption")).toHaveCount(0);
  // boshqa (rasmsiz) kartalarda rasm joyi yo'q
  await expect(page.locator("[data-ai-card='job']").filter({ hasNotText: TITLE }).locator("[data-ai-card-image]")).toHaveCount(0);
});
