import { expect, test, type Page } from "@playwright/test";
import { USERS, asMode, chatSend, gatewayUrl, loginAs, sql, stack } from "../support";

/**
 * Kasb rasmi (ega, 2026-11-27: "har bitta kasbga rasm yaratib olsak, birinchi qo'yib chiqsin — oddiy rasmni tanlab
 * «Joylash» bossa buzilmasin"; tanlovi: "Kerak bo'lganda + tugma"). Stendda OpenAI soxta (gateway), kasb rasmlari
 * odatda o'chiq (seed.sql) — bu spec yoqadi va qaytaradi.
 */
test.use({ serviceWorkers: "block" });

let node = "";
const lastAi = (page: Page) => page.locator("[data-guided-ai]").last();
const settled = (page: Page) => expect(page.locator("[data-guided-ai='thinking'], [data-guided-ai='searching']")).toHaveCount(0, { timeout: 20_000 });

async function cleanup() {
  await sql("delete from public.worker_listing_phones where worker_id in (select id from public.worker_profiles where profile_id = $1)", [USERS.workerB]);
  await sql("delete from public.worker_profiles where profile_id = $1", [USERS.workerB]);
  await sql("delete from public.listing_images where owner_profile_id in ($1, $2)", [USERS.workerA, USERS.workerB]);
  await sql("delete from public.profession_images");
  await sql("delete from public.rate_limits where key like 'listing_images:%' or key like 'profession_images:%' or key like 'listing-image%'");
}

test.beforeAll(async () => {
  const [n] = await sql<{ id: string }>("select id from public.profession_nodes where name_uz = 'Oshpaz' and is_active order by depth limit 1");
  node = n!.id;
});
test.beforeEach(async () => {
  await cleanup();
  await sql("update public.app_settings set value = 'true'::jsonb where key = 'profession_images_enabled'");
});
test.afterEach(async () => {
  await sql("update public.app_settings set value = 'false'::jsonb where key = 'profession_images_enabled'");
  await sql("delete from public.admin_users where profile_id = $1", [USERS.workerB]);
  await cleanup();
  await sql("update public.profiles set first_name = 'Botir', last_name = 'Boboyev' where id = $1", [USERS.workerB]);
});

/** kirgan ish izlovchi: chatda "oshpaz" e'loni — tayyor kartagacha */
async function workerPostToPreview(page: Page) {
  await page.goto("/chat");
  await chatSend(page, "Men oshpazman, o'zim haqimda e'lon bermoqchiman");
  await settled(page);
  await expect(lastAi(page)).toHaveAttribute("data-guided-ai", "post-venue");
  await lastAi(page).locator("[data-post-wx-venue='any']").click();
  await settled(page);
  await page.locator("[data-post-region]", { hasText: "Toshkent shahri" }).click();
  await settled(page);
  await lastAi(page).locator("[data-post-gender='male']").click();
  await settled(page);
  await chatSend(page, "30");
  await settled(page);
  await lastAi(page).locator("[data-post-exp='3plus']").click();
  await settled(page);
  await chatSend(page, "yo'q");
  await settled(page);
  await chatSend(page, "90 123 45 67");
  await settled(page);
  const preview = lastAi(page);
  await expect(preview).toHaveAttribute("data-guided-ai", "post-preview");
  return preview;
}

test("kasb rasmi tayyor — e'lon kartasida oldindan qo'yilgan; «Joylash»ning o'zi kifoya — e'lon shu rasm bilan", async ({ page, context }) => {
  test.setTimeout(120_000);
  // kasb rasmi bor (oldin kimdir yaratgan) — fayl stend saqlovida
  const [{ url }] = (await sql<{ url: string }>(
    `insert into public.profession_images (node_id, status, image_url, storage_path, model, attempts)
     values ($1, 'ready', $2, 'e2e-oshpaz.jpg', 'e2e', 1)
     returning image_url as url`,
    [node, `${gatewayUrl}/storage/v1/object/public/profession-images/e2e-oshpaz.jpg`],
  )) as [{ url: string }];
  await loginAs(context, USERS.workerB);
  await asMode(context, "worker");
  await context.clearCookies({ name: "ib_place" });
  const preview = await workerPostToPreview(page);

  const image = preview.locator("[data-listing-image]");
  await expect(image).toHaveAttribute("data-listing-image", "ready");
  await expect(image.locator("[data-listing-image-preview]")).toHaveAttribute("src", url);
  await expect(image.locator("[data-listing-image-preset]")).toHaveText("Bu — kasbingiz uchun tayyor rasm. Yoqsa, shunday joylang.");
  await expect(image.locator("[data-listing-image-create]")).toHaveCount(0);
  // xarajat yo'q: rasm yaratish hisoblagichlari tegilmagan
  expect(await sql("select 1 from public.rate_limits where key like 'listing_images:%'")).toHaveLength(0);

  await preview.locator("[data-post-publish]").click();
  await expect(page.locator("[data-guided-ai='post-done']")).toContainText("Tabriklaymiz! E'loningiz joylandi", { timeout: 30_000 });
  const [img] = await sql<{ image_url: string; status: string; prompt: string }>(
    `select li.image_url, li.status, li.prompt from public.listing_images li
       join public.worker_profiles w on w.id = li.entity_id where li.entity = 'worker' and w.profile_id = $1`,
    [USERS.workerB],
  );
  expect(img).toEqual({ image_url: url, status: "ready", prompt: `profession:${node}` });
});

test("kasb rasmi yo'q: «Rasm yaratish» — kasb rasmini yaratadi (keyingilarga tayyor); «Boshqa rasm» — faqat shu e'longa; begona qoralamaga — yo'q", async ({ page, context }) => {
  await loginAs(context, USERS.workerB);
  const api = (body: Record<string, unknown>) => page.request.post("/api/listing-image", { data: body, headers: { origin: new URL(stack.app).origin } });
  const [d1, d2, d3] = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];

  // hali yo'q — oldindan qo'yiladigan rasm yo'q
  expect(await (await api({ entity: "worker", draft: d1, professionId: node, preset: true })).json()).toEqual({ ok: false, error: "no_preset" });
  // "Rasm yaratish" — kasb rasmi yaratiladi va qoralamaga qo'yiladi
  const made = (await (await api({ entity: "worker", draft: d1, professionId: node, title: "Oshpaz" })).json()) as { ok: boolean; url: string };
  expect(made.ok).toBe(true);
  expect(made.url).toMatch(/\/storage\/v1\/object\/public\/profession-images\/[0-9a-f-]{36}-\d+\.jpg$/);
  const [pi] = await sql<{ status: string; image_url: string; prompt: string }>("select status, image_url, prompt from public.profession_images where node_id = $1", [node]);
  expect(pi).toMatchObject({ status: "ready", image_url: made.url });
  expect(pi!.prompt).toMatch(/Job: Cook|Job: Chef|Job: Oshpaz/);
  expect(pi!.prompt).toContain("No portrait");
  // keyingi odam (shu odamning keyingi e'loni ham) — xarajatsiz o'sha rasm
  expect(await (await api({ entity: "vacancy", draft: d2, professionId: node, preset: true })).json()).toEqual({ ok: true, url: made.url });
  // "Boshqa rasm" — faqat shu e'longa (e'lon rasmlari bucket'i), kasb rasmi o'zgarmaydi
  const own = (await (await api({ entity: "worker", draft: d3, professionId: node, title: "Oshpaz", unique: true })).json()) as { ok: boolean; url: string };
  expect(own.ok).toBe(true);
  expect(own.url).toMatch(/\/listing-images\/worker\//);
  expect((await sql<{ image_url: string }>("select image_url from public.profession_images where node_id = $1", [node]))[0]!.image_url).toBe(made.url);
  // xarajat: shu odamga 2 ta yaratish yozildi (kasb rasmi + alohida), oldindan qo'yish — hisobsiz
  const [rl] = await sql<{ count: number }>("select count::int as count from public.rate_limits where key = $1", [`listing_images:user:${USERS.workerB}`]);
  expect(rl!.count).toBe(2);

  // boshqa odam birovning qoralamasiga kasb rasmini qo'ya olmaydi
  await loginAs(context, USERS.workerA);
  expect((await api({ entity: "vacancy", draft: d2, professionId: node, preset: true })).status()).toBe(403);
});

test("admin: ommabop kasblarga oldindan yaratish va yoqmaganini almashtirish — audit bilan", async ({ page, context }) => {
  test.setTimeout(120_000);
  await sql(
    `insert into public.admin_users (profile_id, role, permissions, is_active) values ($1, 'super_admin', '{}', true)
     on conflict (profile_id) do update set is_active = true, role = 'super_admin'`,
    [USERS.workerB],
  );
  await loginAs(context, USERS.workerB, "aal2");
  await page.goto("/admin/professions");
  const card = page.locator("[data-admin-profession-images]");
  await expect(card.getByRole("heading", { name: "Kasb rasmlari" })).toBeVisible();
  await expect(card.locator("[data-admin-profession-images-ready]")).toHaveText("Tayyor: 0 ta");
  await card.locator("[data-admin-profession-images-generate]").click();
  await expect(card.locator("[data-admin-profession-images-ready]")).not.toHaveText("Tayyor: 0 ta", { timeout: 60_000 });
  const ready = await sql<{ node_id: string; image_url: string }>("select node_id, image_url from public.profession_images where status = 'ready'");
  expect(ready.length).toBeGreaterThanOrEqual(1);
  expect(ready.length).toBeLessThanOrEqual(4);
  await expect(card.locator("[data-admin-profession-image]")).toHaveCount(ready.length);
  // oldindan yaratish foydalanuvchilarning kunlik chegarasini yemaydi
  expect(await sql("select 1 from public.rate_limits where key = 'listing_images:day'")).toHaveLength(0);

  const first = ready[0]!;
  await card.locator(`[data-admin-profession-image='${first.node_id}']`).getByRole("button", { name: /^Almashtirish/ }).click();
  await expect.poll(async () => (await sql<{ image_url: string }>("select image_url from public.profession_images where node_id = $1", [first.node_id]))[0]!.image_url, { timeout: 60_000 }).not.toBe(first.image_url);
  const audit = await sql<{ action: string }>("select action from public.audit_logs where actor_id = $1 and action like 'profession_images.%' order by created_at", [USERS.workerB]);
  expect(audit.map((a) => a.action)).toEqual(["profession_images.generate", "profession_images.regenerate"]);
});
