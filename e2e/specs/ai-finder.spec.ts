import { expect, test, type Page } from "@playwright/test";
import { USERS, asGuest, asMode, loginAs, sql } from "../support";

/**
 * D4 / 2026-10 · "AI bilan qidirish" — qidiruv blokida (ekranni to'sadigan suzuvchi tugma yo'q): "O'zingizga mosini toping"
 * oynasi; qisqa matn → tushunilgan narsalar + mos e'lonlar shu oynada (stendda AI kaliti yo'q — lug'at bilan tushuniladi).
 */

async function nodeId(name: string) {
  const [r] = await sql<{ id: string }>("select id from public.profession_nodes where name_uz = $1 and selectable limit 1", [name]);
  return r!.id;
}

async function vacancy(title: string, profession: string, salaryType: "monthly" | "daily" = "monthly") {
  const [r] = await sql<{ id: string }>("select id from public.regions where slug = 'tashkent_city'");
  const [v] = await sql<{ slug: string }>(
    `insert into public.vacancies (owner_profile_id, title, region_id, description, status, profession_node_id, salary_from, salary_type, published_at, expires_at)
     values ($1, $2, $3, 'Sinov e''loni: ish joyi tavsifi, grafik va shartlar', 'active', $4, 200000, $5, now(), now() + interval '10 days') returning slug`,
    [USERS.employer, title, r!.id, await nodeId(profession), salaryType],
  );
  return v!.slug;
}

const fab = (page: Page) => page.getByRole("button", { name: "AI bilan qidirish" });

test.beforeEach(async () => {
  await sql("delete from public.vacancies where owner_profile_id = $1", [USERS.employer]);
});
test.afterEach(async () => {
  await sql("delete from public.vacancies where owner_profile_id = $1", [USERS.employer]);
});

test("AI tugmasi qidiruv blokida (suzuvchi emas): sahifa aylantirilganda ekranni to'smaydi, vakansiya sahifasida yo'q", async ({ page, context }) => {
  const slug = await vacancy("Buxgalter", "Buxgalter");
  await asGuest(context);
  await asMode(context, "worker");
  await page.goto("/");
  // qidiruv blokining ichida (bir xil ota konteyner), pozitsiyasi oddiy — fixed/sticky emas
  const box = (await fab(page).boundingBox())!;
  const search = (await page.getByRole("search", { name: "Ish qidirish" }).boundingBox())!;
  expect(box.y).toBeGreaterThan(search.y);
  expect(box.y).toBeLessThan(search.y + search.height + 60);
  expect(await fab(page).evaluate((el) => getComputedStyle(el).position)).toBe("static");
  await page.mouse.wheel(0, 2000);
  await expect(fab(page)).not.toBeInViewport();
  // vakansiya sahifasida "Ariza yuborish" paneli ustida hech narsa yo'q
  await page.goto(`/jobs/${slug}`);
  await expect(page.getByRole("button", { name: "Ariza yuborish" }).last()).toBeVisible();
  await expect(fab(page)).toHaveCount(0);
});

test("matn → tushunilgan kasb va hudud, mos e'lonlar oyna ichida; e'lon bosilsa — sahifasi ochiladi", async ({ page, context }) => {
  const slug = await vacancy("Buxgalter", "Buxgalter");
  await vacancy("Oshpaz", "Oshpaz");
  await asGuest(context);
  await page.goto("/");
  await fab(page).click();
  const dialog = page.getByRole("dialog", { name: "O'zingizga mosini toping" });
  await expect(dialog.getByRole("radio", { name: "Ish qidiryapman" })).toHaveAttribute("aria-checked", "true");
  await dialog.getByLabel("Nima qidiryapsiz?").fill("Toshkent shahrida buxgalter");
  await dialog.getByRole("button", { name: "Topish" }).click();
  await expect(dialog.getByText(/^Tushundim:/)).toContainText("Buxgalter");
  await expect(dialog.getByText(/^Tushundim:/)).toContainText("Toshkent shahri");
  const cards = dialog.locator("article");
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toContainText("Buxgalter");
  await cards.first().getByRole("heading").getByRole("link").click();
  await page.waitForURL(`**/jobs/${slug}`);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("'kunlik ish' tushuniladi — faqat kunliklar; kasb aniqlanmasa — aniq taklif", async ({ page, context }) => {
  await vacancy("Yuk tashuvchi", "Buxgalter", "daily");
  await vacancy("Buxgalter", "Buxgalter", "monthly");
  await asGuest(context);
  await page.goto("/");
  await fab(page).click();
  const dialog = page.getByRole("dialog", { name: "O'zingizga mosini toping" });
  await dialog.getByLabel("Nima qidiryapsiz?").fill("kunlik ish");
  await dialog.getByRole("button", { name: "Topish" }).click();
  await expect(dialog.getByText(/^Tushundim:/)).toContainText("Kunlik ishlar");
  await expect(dialog.locator("article")).toHaveCount(1);
  await expect(dialog.locator("article").first()).toContainText("Yuk tashuvchi");
  await expect(dialog.locator("article").first()).toContainText("/kun");

  await dialog.getByLabel("Nima qidiryapsiz?").fill("qwerty asdf");
  await dialog.getByRole("button", { name: "Topish" }).click();
  await expect(dialog.getByText("Kasbni aniqlay olmadim")).toBeVisible();
  await expect(dialog.getByRole("link", { name: "Kasbni ro'yxatdan tanlash" })).toHaveAttribute("href", /\/search\?mode=jobs/);
});

test("ish beruvchi (kirgan, panel): AI qidiruv nomzod qidiruvi yonida, faqat ishchilar ichida", async ({ page, context }) => {
  await sql(
    `insert into public.employer_profiles (profile_id, employer_type, display_name, onboarding_completed_at)
     values ($1, 'person', 'Dilnoza opa', now()) on conflict (profile_id) do nothing`,
    [USERS.employer],
  );
  await sql("update public.profiles set active_role = 'employer' where id = $1", [USERS.employer]);
  await loginAs(context, USERS.employer);
  await page.goto("/");
  await fab(page).click();
  // ish beruvchi rejimi: faqat ishchilar ichidan qidiradi (rejim tanlovi ko'rsatilmaydi)
  await expect(page.getByRole("dialog").getByText("Ishchilar ichidan qidiriladi")).toBeVisible();
  await expect(page.getByRole("dialog").getByRole("radio")).toHaveCount(0);
});
