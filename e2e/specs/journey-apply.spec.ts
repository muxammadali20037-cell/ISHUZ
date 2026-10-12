import { expect, test } from "@playwright/test";
import { USERS, asGuest, loginAs, pickProfession, sql } from "../support";

/**
 * C8.10 · qabul mezoni #32 (J1): bosh sahifa → qidiruv → batafsil → ariza, mobil va desktop.
 * Mehmon qidiradi; "Ariza yuborish" kirishga aynan shu vakansiyaga qaytish yo'li bilan olib boradi; kirgach ariza yuboriladi.
 * Kirish — imzolangan sinov cookie'si (Telegram kodi stendda yo'q, C8.6).
 */

const VIEWPORTS = [
  { name: "mobil", width: 390, height: 844 },
  { name: "desktop", width: 1280, height: 900 },
];

async function setup() {
  await sql("delete from public.vacancies where owner_profile_id = $1", [USERS.employer]);
  await sql("delete from public.worker_profiles where profile_id = $1", [USERS.workerB]);
  const [n] = await sql<{ id: string }>("select id from public.profession_nodes where name_uz = 'Buxgalter' and selectable limit 1");
  const [r] = await sql<{ id: string }>("select id from public.regions where slug = 'tashkent_city'");
  await sql(
    `insert into public.vacancies (owner_profile_id, title, region_id, description, status, profession_node_id, salary_negotiable, published_at, expires_at)
     values ($1, 'Buxgalter', $2, 'Kichik do''konga buxgalter kerak, haftasiga 5 kun', 'active', $3, true, now(), now() + interval '10 days')`,
    [USERS.employer, r!.id, n!.id],
  );
  await sql(
    `insert into public.worker_profiles (profile_id, headline, about, region_id, profession_node_id, experience_level, onboarding_completed_at)
     values ($1, 'Buxgalter', 'Buxgalteriya, 1C, soliq hisobotlari', $2, $3, '3_5y', now())`,
    [USERS.workerB, r!.id, n!.id],
  );
}

test.afterEach(async () => {
  await sql("delete from public.vacancies where owner_profile_id = $1", [USERS.employer]);
  await sql("delete from public.worker_profiles where profile_id = $1", [USERS.workerB]);
});

for (const vp of VIEWPORTS) {
  test(`${vp.name}: bosh sahifa → qidiruv → batafsil → ariza (kirish bilan, shu vakansiyaga qaytib)`, async ({ page, context }) => {
    test.setTimeout(90_000);
    await setup();
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await asGuest(context);

    // 1. bosh sahifa: "E'lonlarni ko'rish" → "Ish e'lonlari"
    await page.goto("/");
    await page.getByRole("main").getByRole("link", { name: "Ish e'lonlari", exact: true }).click();
    await page.waitForURL(/\/search\?mode=jobs/);

    // 2. qidiruv: kasb → hudud → tuman (har qadamda savol sarlavhada)
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ish qidiraman");
    await expect(page.getByText("Qaysi kasb bo'yicha ish qidiryapsiz?")).toBeVisible();
    await pickProfession(page, "Buxgalter", "Buxgalter");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Qaysi viloyatda?");
    await page.getByRole("link", { name: "Toshkent shahri", exact: true }).click();
    await page.getByRole("link", { name: /^Butun (viloyat|shahar)/ }).click();
    await page.waitForURL(/district=all/);

    // 3. natija → batafsil
    const card = page.locator("main article").filter({ hasText: "Buxgalter" }).first();
    await expect(card).toBeVisible();
    await card.getByRole("link", { name: "Batafsil" }).click();
    await page.waitForURL(/\/jobs\/[^/]+$/);
    const jobUrl = new URL(page.url()).pathname;

    // 4. mehmon "Ariza yuborish" → kirish, qaytish yo'li — aynan shu vakansiya
    await page.getByRole("button", { name: "Ariza yuborish" }).last().click();
    await page.waitForURL(/\/auth\?next=/);
    expect(new URL(page.url()).searchParams.get("next")).toBe(jobUrl);

    // 5. kirdi → qaytdi → ariza → "Ariza yuborildi" → arizani ko'rish
    await loginAs(context, USERS.workerB);
    await page.goto(jobUrl);
    await page.getByRole("button", { name: "Ariza yuborish" }).last().click();
    await page.getByRole("dialog").getByRole("button", { name: "Ariza yuborish" }).click();
    await expect(page.getByRole("dialog").getByText("Ariza yuborildi").first()).toBeVisible();
    await page.getByRole("link", { name: "Arizani ko'rish" }).click();
    await page.waitForURL(/\/applications\/[0-9a-f-]{36}$/);
    await expect(page.getByText("Yuborildi").first()).toBeVisible();
    // vakansiya sahifasi endi "Ariza yuborildi" holatini ko'rsatadi (qayta yuborish tugmasi yo'q)
    await page.goto(jobUrl);
    await expect(page.getByRole("button", { name: "Ariza yuborish" })).toHaveCount(0);
  });
}
