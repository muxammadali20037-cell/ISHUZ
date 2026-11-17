import { expect, test } from "@playwright/test";
import { USERS, asGuest, asMode, loginAs, next, pickProfession, pickWholeRegion, sql } from "../support";

/**
 * D3/R-C · bosh sahifadagi tezkor bo'limlar va "Kunlik ishlar":
 *  - ish beruvchi bosh sahifasi (2.0): oynalar yo'q — qidiruv ostida 4 ta tez yo'l (kunlik ishchilar, yaqin, tajribali, masofaviy);
 *  - ish izlovchi bosh sahifasi (2.0, 2026-11): oynalar yo'q — qidiruv ostida 4 ta tez yo'l (kunlik, yaqin, masofaviy, tajribasiz);
 *  - ish beruvchi oddiy formada "Kunlik" haq tanlaydi → bazada kunlik → "Kunlik ish" tez yo'li faqat kunliklarni ko'rsatadi.
 */

async function nodeId(name: string) {
  const [r] = await sql<{ id: string }>("select id from public.profession_nodes where name_uz = $1 and selectable limit 1", [name]);
  return r!.id;
}

test.beforeEach(async () => {
  await sql("delete from public.vacancies where owner_profile_id = $1", [USERS.employer]);
  await sql(
    `insert into public.employer_profiles (profile_id, employer_type, display_name, onboarding_completed_at)
     values ($1, 'person', 'Dilnoza opa', now()) on conflict (profile_id) do nothing`,
    [USERS.employer],
  );
});
test.afterEach(async () => {
  await sql("delete from public.vacancies where owner_profile_id = $1", [USERS.employer]);
});

test("bosh sahifa (ish izlovchi): rasmli oynalar va tez yo'l plitkalari yo'q — hammasi «Bo'limlar»da, bitta ustunda; har biri bir bosishda natijaga", async ({ page, context }) => {
  await asGuest(context);
  await asMode(context, "worker");
  await page.goto("/");
  // ish izlovchi bosh sahifasida admin oynalari ko'rsatilmaydi (bitta vazifa — qidiruv)
  await expect(page.getByRole("region", { name: "Tezkor bo'limlar" })).toHaveCount(0);
  // 2026-11-17 (ega): "kunlik, masofaviy, tajriba — hammasini bo'limlarga qo'sh; hammasi bir qatorda"
  await expect(page.getByRole("navigation", { name: "Tez qidiruv" })).toHaveCount(0);
  const menu = page.locator("[data-home-menu]");
  const item = (key: string) => menu.locator(`[data-menu-item="${key}"]`);
  await expect(item("daily")).toContainText("Kunlik ish");
  await expect(item("near")).toContainText("Yaqin atrofdagi ishlar");
  await expect(item("remote")).toContainText("Masofaviy ish");
  await expect(item("noexp")).toContainText("Tajriba talab qilinmaydigan ishlar");
  // qidiruv maydoni tepada; har bir qator barmoq bilan bosishga qulay (≥ 44px), to'liq kenglikda
  const field = (await page.locator("form[data-ai-field]:visible").boundingBox())!;
  expect(field.y).toBeLessThan(400);
  for (const key of ["masters", "ai", "daily", "remote", "noexp", "near"]) {
    const box = (await item(key).boundingBox())!;
    expect(box.y).toBeGreaterThan(field.y);
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
  // uzun nomlar qisqartirilmaydi (… yo'q)
  expect(await item("noexp").evaluate((el) => [...el.querySelectorAll("span")].every((s) => s.scrollWidth <= s.clientWidth + 1))).toBe(true);
  // telefonda sahifa yonga siljimaydi
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

  // kunlik ishlar: kasb ham, hudud ham so'ralmaydi — darhol natijalar
  await item("daily").click();
  await page.waitForURL(/\/search\?mode=jobs&region=all&pay=daily$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Kunlik ishlar");
  await page.goBack();
  await item("remote").click();
  await page.waitForURL(/\/search\?mode=jobs&region=remote/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("bosh sahifa (ish beruvchi): tez yo'llar «Bo'limlar»da, «Barcha nomzodlar» — pastki menyuda; tepada «Vakansiya joylash»", async ({ page, context }) => {
  await asGuest(context);
  await asMode(context, "employer");
  await page.goto("/");
  await expect(page.getByRole("region", { name: "Tezkor bo'limlar" })).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Tez qidiruv" })).toHaveCount(0);
  const menu = page.locator("[data-home-menu]");
  const item = (key: string) => menu.locator(`[data-menu-item="${key}"]`);
  await expect(item("daily")).toContainText("Kunlik ishchi");
  await expect(item("near")).toContainText("Yaqin atrofdagi ishchi");
  await expect(item("exp")).toContainText("Tajribali ishchi");
  await expect(item("remote")).toContainText("Masofaviy ishchi");
  // barcha nomzodlar — pastki menyudagi "Nomzodlar" (bo'limlarda takrorlanmaydi, ega 2026-11-17)
  await expect(item("candidates")).toHaveCount(0);
  await expect(page.locator("nav.bottom-nav").getByRole("link", { name: "Nomzodlar" })).toBeVisible();
  // bitta tugma — yordamchi bilan joylash; ingichka (44–48 px), qidiruvdan kichikroq (ega, 2026-11-17)
  const post = page.getByRole("main").getByRole("link", { name: "Vakansiya joylash", exact: true });
  await expect(post).toHaveCount(1);
  await expect(post).toHaveAttribute("href", "/post/vacancy?ai=1");
  const ph = (await post.boundingBox())!.height;
  expect(ph).toBeGreaterThanOrEqual(44);
  expect(ph).toBeLessThanOrEqual(48);
  await item("daily").click();
  await page.waitForURL(/\/search\?mode=workers&region=all&pay=daily&any=1$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Ishchilar");
});

test("kunlik ish: formada 'Kunlik' → bazada kunlik → 'Kunlik ishlar'da faqat kunliklar", async ({ page, context }) => {
  test.setTimeout(90_000);
  // oylik e'lon (kunlik ro'yxatida chiqmasligi kerak)
  const [r] = await sql<{ id: string }>("select id from public.regions where slug = 'tashkent_city'");
  await sql(
    `insert into public.vacancies (owner_profile_id, title, region_id, description, status, profession_node_id, salary_from, salary_type, published_at, expires_at)
     values ($1, 'Oshpaz', $2, 'Oylik ish: oshxonada doimiy oshpaz kerak', 'active', $3, 5000000, 'monthly', now(), now() + interval '10 days')`,
    [USERS.employer, r!.id, await nodeId("Oshpaz")],
  );

  await loginAs(context, USERS.employer);
  await asMode(context, "employer");
  await page.goto("/post/vacancy");
  await pickProfession(page, "Buxgalter", "Buxgalter");
  await next(page);
  await pickWholeRegion(page);
  await next(page);
  await page.getByRole("radio", { name: "O'zim uchun" }).click();
  await page.locator("#org").fill("Dilnoza opa");
  await page.locator("#desc").fill("Bir kunlik ish: do'kon hisobotlarini tartiblash, 9 dan 18 gacha");
  await page.getByRole("radiogroup", { name: "Haq qanday to'lanadi?" }).getByRole("radio", { name: /^Kunlik/ }).click();
  await expect(page.getByText("Maosh (so'm, kuniga)")).toBeVisible();
  await page.locator("#salary-from").fill("250000");
  await next(page);
  await page.getByRole("button", { name: /E'lonni joylash/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: /joylandi/i })).toBeVisible({ timeout: 30_000 });
  const [v] = await sql<{ salary_type: string; salary_from: number }>(
    "select salary_type, salary_from from public.vacancies where owner_profile_id = $1 and title <> 'Oshpaz'",
    [USERS.employer],
  );
  expect(v).toEqual({ salary_type: "daily", salary_from: 250000 });

  // mehmon bosh sahifadagi "Kunlik ish" bo'limidan: bir bosishda natijalar — faqat kunlik e'lon
  await asGuest(context);
  await asMode(context, "worker");
  await page.goto("/");
  await page.locator('[data-home-menu] [data-menu-item="daily"]').click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Kunlik ishlar");
  const cards = page.locator("main article");
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toContainText("Buxgalter");
  await expect(cards.first()).toContainText("/kun");
  await expect(page.locator("main article").filter({ hasText: "Oshpaz" })).toHaveCount(0);
});
