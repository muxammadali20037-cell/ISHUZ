import { expect, test } from "@playwright/test";
import { USERS, asGuest, sql } from "../support";

/**
 * 04–06 (ega "MASTER PROMPT", 2026-11-16): xush kelibsiz → "Boshlash" → rol ("Siz qaysi maqsadda keldingiz?") →
 * 05 "Qaysi kasblar sizga mos keladi?" (bir nechta, 5 tagacha, qidiruv bilan) → 06 "Qayerda ishlashni istaysiz?" (viloyat,
 * tuman, masofaviy, tajriba) → bosh sahifa: "Sizga mos ishlar" tanlangan kasb va hudud bo'yicha. Kirish talab qilinmaydi.
 */

const TITLE = "Tandir non yopuvchi — seeker-setup sinovi";

test.beforeAll(async () => {
  await sql("delete from public.vacancies where owner_profile_id = $1 and title = $2", [USERS.employer, TITLE]);
  await sql(
    `insert into public.vacancies (owner_profile_id, title, region_id, category_id, profession_node_id, description, status, salary_from, salary_type, published_at, expires_at)
     select $1, $2, r.id, n.category_id, n.id, 'Sinov e''loni.', 'active', 4000000, 'monthly', now(), now() + interval '5 days'
     from public.regions r, lateral (select id, category_id from public.profession_nodes where name_uz = 'Oshpaz' and selectable order by depth limit 1) n
     where r.slug = 'samarkand'`,
    [USERS.employer, TITLE],
  );
});
test.afterAll(async () => {
  await sql("delete from public.vacancies where owner_profile_id = $1 and title = $2", [USERS.employer, TITLE]);
});

test("mehmon: rol → kasblar (qidiruv, bir nechta, olib tashlash) → hudud va tajriba → bosh sahifada 'Sizga mos ishlar'", async ({ page, context }) => {
  test.setTimeout(90_000);
  await asGuest(context);
  await context.clearCookies({ name: "ib_mode" });
  await page.goto("/start/rol?from=welcome");
  await expect(page.getByRole("heading", { level: 1, name: "Siz qaysi maqsadda keldingiz?" })).toBeVisible();
  await page.getByText("Men ish qidiryapman", { exact: true }).click();
  await page.getByRole("button", { name: "Davom etish" }).click();

  // 05
  await page.waitForURL("**/start/kasblar");
  await expect(page.getByRole("heading", { level: 1, name: "Qaysi kasblar sizga mos keladi?" })).toBeVisible();
  await expect(page.getByText("1/2-qadam")).toBeVisible();
  const cont = page.getByRole("button", { name: "Davom etish" });
  await expect(cont).toBeDisabled();
  const search = page.getByRole("searchbox").or(page.getByRole("textbox")).first();
  for (const q of ["Oshpaz", "Sotuvchi"]) {
    await search.fill(q);
    await page.getByRole("button", { name: new RegExp(`^${q}`) }).first().click();
  }
  const picked = page.locator("[data-picked-professions]");
  await expect(picked.getByText("Tanlangan: 2 / 5")).toBeVisible();
  await picked.getByRole("button", { name: /Sotuvchi.*olib tashlash/ }).click();
  await expect(picked.getByText("Tanlangan: 1 / 5")).toBeVisible();
  await expect(cont).toBeEnabled();
  await cont.click();

  // 06
  await page.waitForURL("**/start/hudud");
  await expect(page.getByRole("heading", { level: 1, name: "Qayerda ishlashni istaysiz?" })).toBeVisible();
  await expect(page.getByText("2/2-qadam")).toBeVisible();
  await page.getByLabel("Viloyat", { exact: true }).selectOption({ label: "Samarqand" });
  await expect(page.getByLabel("Tuman yoki shahar")).toBeVisible();
  await page.getByText("Masofaviy (uydan) ish ham mos keladi").click();
  await page.getByText("Tajriba yo'q", { exact: true }).click();
  await page.getByRole("button", { name: "Tayyor" }).click();

  // 07: tanlangan kasb va hudud bo'yicha haqiqiy e'lon
  await page.waitForURL((u) => new URL(u).pathname === "/");
  await expect(page.getByRole("heading", { name: "Sizga mos ishlar" })).toBeVisible();
  await expect(page.getByText(/Kasbingiz bo'yicha: Oshpaz/)).toBeVisible();
  await expect(page.getByText(TITLE)).toBeVisible();
  const cookies = await context.cookies();
  expect(cookies.find((c) => c.name === "ib_place")?.value).toBe("samarkand~all");
  expect(cookies.find((c) => c.name === "ib_prefs")?.value).toMatch(/^[0-9a-f-]{36}~1~none$/);

  // qaytib kelsa — tanlov saqlangan
  await page.goto("/start/kasblar");
  await expect(page.locator("[data-picked-professions]").getByText("Tanlangan: 1 / 5")).toBeVisible();
  await page.goto("/start/hudud");
  await expect(page.getByLabel("Viloyat", { exact: true })).toHaveValue("samarkand");
  await expect(page.getByRole("checkbox")).toBeChecked();
});

test("ish beruvchi rolida kasb va hudud so'ralmaydi — darhol bosh sahifa", async ({ page, context }) => {
  await asGuest(context);
  await context.clearCookies({ name: "ib_mode" });
  await page.goto("/start/rol?from=welcome");
  await page.getByText("Men xodim qidiryapman", { exact: true }).click();
  await page.getByRole("button", { name: "Davom etish" }).click();
  await page.waitForURL((u) => new URL(u).pathname === "/");
});
