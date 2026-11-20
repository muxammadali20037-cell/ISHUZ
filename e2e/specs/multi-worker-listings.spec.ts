import { expect, test } from "@playwright/test";
import { USERS, asMode, formReady, loginAs, next, pickProfession, pickWholeRegion, sql } from "../support";

/**
 * 0086 · Bir kishida bir nechta ishchi e'loni (ega, 2026-11-20: "men ishchiman — menga faqat 1 ta e'lon joylay
 * olyapman; 10 ta, 100 ta joylasin kerak bo'lsa"). "E'lonlarim" → "Yana e'lon joylash" → bo'sh forma → ikkinchi e'lon;
 * ikkalasi ham "E'lonlarim"da, har biri o'z tahriri va "Ishga joylashdim" tugmasi bilan; asosiy e'lon o'zgarmaydi.
 */
// alohida sinov foydalanuvchisi — boshqa testlarning ishchilariga tegilmaydi
const W = "7e2e0000-0000-4000-8000-0000000000a6";

async function cleanup() {
  await sql("delete from auth.users where id = $1", [W]);
}

test.afterEach(cleanup);

test("ishchi: ikkinchi e'lon alohida joylanadi; ikkalasi E'lonlarimda, har birini alohida o'zgartirish va to'xtatish mumkin", async ({ page, context }) => {
  test.setTimeout(120_000);
  await cleanup();
  await sql(`insert into auth.users (id, phone, phone_confirmed_at, raw_user_meta_data) values ($1, '+998901110086', now(), '{"first_name":"Sardor","last_name":"K"}')`, [W]);
  const [r] = await sql<{ id: string }>("select id from public.regions where slug = 'tashkent_city'");
  const [n] = await sql<{ id: string }>("select id from public.profession_nodes where name_uz = 'Buxgalter' and selectable limit 1");
  // asosiy e'lon — avvaldan bor
  const [primary] = await sql<{ id: string }>(
    `insert into public.worker_profiles (profile_id, headline, profession_node_id, region_id, about, is_public, onboarding_completed_at)
     values ($1, 'Buxgalter', $2, $3, 'Buxgalteriya hisobi, 1C bilan 5 yil', true, now()) returning id`,
    [W, n!.id, r!.id],
  );
  await sql("insert into public.worker_listing_phones (worker_id, phone) values ($1, '+998901110001')", [primary!.id]);
  await loginAs(context, W);
  await asMode(context, "worker");

  await page.goto("/cabinet/elonlar");
  await expect(page.locator('[data-my-listing="worker"]')).toHaveCount(1);
  await page.locator("[data-add-worker-listing]").click();
  await page.waitForURL(/\/post\/worker\?new=1/);
  await formReady(page);
  await expect(page.getByText("Yana bitta e'lon").first()).toBeVisible();

  // bo'sh forma: asosiy e'lonning kasbi va matni ko'chmaydi
  await pickProfession(page, "Haydovchi", "Haydovchi");
  await next(page);
  await pickWholeRegion(page);
  await next(page);
  await expect(page.locator("#about")).toHaveValue("");
  await page.locator("#phone").fill("935556677");
  await page.locator("#about").fill("Yengil avtomobilda 4 yil haydovchi bo'lib ishlaganman");
  await page.getByRole("radio", { name: "3 yildan ko'p" }).click();
  await next(page);
  await page.getByRole("button", { name: /^E'lonni joylash/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: /joylandi/i })).toBeVisible({ timeout: 30_000 });

  const rows = await sql<{ id: string; is_primary: boolean; headline: string; about: string; phone: string | null }>(
    `select w.id, w.is_primary, w.headline, w.about, lp.phone from public.worker_profiles w
       left join public.worker_listing_phones lp on lp.worker_id = w.id
      where w.profile_id = $1 order by w.is_primary desc`,
    [W],
  );
  expect(rows).toHaveLength(2);
  expect(rows[0]).toMatchObject({ id: primary!.id, is_primary: true, headline: "Buxgalter", about: "Buxgalteriya hisobi, 1C bilan 5 yil", phone: "+998901110001" });
  expect(rows[1]).toMatchObject({ is_primary: false, headline: "Haydovchi", phone: "+998935556677" });
  const extra = rows[1]!.id;

  // E'lonlarim: ikkala e'lon, asosiysi birinchi; tahrir havolalari har biriga o'zi
  await page.goto("/cabinet/elonlar");
  const cards = page.locator('[data-my-listing="worker"]');
  await expect(cards).toHaveCount(2);
  await expect(page.locator("[data-my-workers] h2")).toHaveText("O'zim haqimdagi e'lonlar (2)");
  await expect(cards.nth(0)).toContainText("Buxgalter");
  await expect(cards.nth(1)).toContainText("Haydovchi");
  await expect(cards.nth(0).getByRole("link", { name: /O'zgartirish/ })).toHaveAttribute("href", "/post/worker");
  await expect(cards.nth(1).getByRole("link", { name: /O'zgartirish/ })).toHaveAttribute("href", `/post/worker?listing=${extra}`);

  // qo'shimcha e'lonni tahrirlash — o'sha e'lon ochiladi (asosiysi emas)
  await page.goto(`/post/worker?listing=${extra}`);
  await formReady(page);
  await expect(page.getByText("E'lonni o'zgartirish").first()).toBeVisible();
  await page.goto(`/post/worker?listing=${extra}&step=3`);
  await formReady(page);
  await expect(page.locator("#about")).toHaveValue("Yengil avtomobilda 4 yil haydovchi bo'lib ishlaganman");

  // ikkinchi e'lon qidiruvda alohida chiqadi
  const [found] = await sql<{ n: string }>("select count(*) as n from public.simple_search_workers((select id from public.profession_nodes where name_uz = 'Haydovchi' and selectable limit 1), $1) where id = $2", [r!.id, extra]);
  expect(Number(found!.n)).toBe(1);

  // faqat qo'shimcha e'lon to'xtatiladi — asosiysi qidiruvda qoladi
  await page.goto("/cabinet/elonlar");
  await cards.nth(1).getByRole("button", { name: "Ishga joylashdim" }).click();
  await page.getByRole("button", { name: "Ha, topdim" }).click();
  await expect.poll(async () => (await sql<{ pub: boolean }>("select is_public as pub from public.worker_profiles where id = $1", [extra]))[0]!.pub).toBe(false);
  const [p] = await sql<{ pub: boolean }>("select is_public as pub from public.worker_profiles where id = $1", [primary!.id]);
  expect(p!.pub).toBe(true);

  // begona e'lonni tahrirlash sahifasi — topilmadi
  await loginAs(context, USERS.workerB);
  await asMode(context, "worker");
  await page.goto(`/post/worker?listing=${extra}`);
  await expect(page.getByRole("heading", { level: 1, name: "Sahifa topilmadi" })).toBeVisible();
  await expect(page.locator("#about, [data-wizard-next]")).toHaveCount(0);
});
