import { expect, test, type Page } from "@playwright/test";
import { USERS, asGuest, asMode, loginAs, sql } from "../support";
import { findLayoutIssues, fullHeight, zoomText } from "../overlap";

/**
 * 2026-10 · "yozuvlar ustma-ust chiqqan, belgilar yozuvni to'sib qo'ygan" (egasi telefonda ko'rgan) — qayta chiqmasin.
 * Asosiy sahifalar: kichik telefon (320, o'zbekcha), katta shrift (390, ruscha, faqat yozuv 1.3×) va kompyuter (1440).
 * Tekshiriladi (e2e/overlap.ts): yozuv boshqa element ostida qolmagan, ikki yozuv kesishmagan, belgi yozuv ustiga tushmagan,
 * yozuv ekran chetidan chiqmagan, "…" siz qirqilmagan. Ma'lumotda uzun sarlavha va uzun kompaniya nomi bor.
 */
const LONG = "Omborxona bo'yicha katta mutaxassis (yuk qabul qilish, hisobga olish va jo'natish) — Toshkent Xalqaro Logistika Markazi";

const CASES: { name: string; width: number; locale: "uz" | "ru"; zoom?: number }[] = [
  { name: "320 uz", width: 320, locale: "uz" },
  { name: "390 ru katta shrift", width: 390, locale: "ru", zoom: 1.3 },
  { name: "1440 uz", width: 1440, locale: "uz" },
];

const PAGES: { name: string; url: string; who: "guest" | "worker" | "employer" | "seeker-guest" }[] = [
  { name: "mehmon bosh sahifasi", url: "/", who: "guest" },
  { name: "ish qidiruvchi bosh sahifasi", url: "/", who: "worker" },
  { name: "ish beruvchi bosh sahifasi", url: "/", who: "employer" },
  { name: "qidiruv natijalari", url: "/search?mode=jobs&any=1&region=all", who: "worker" },
  { name: "e'lon berish (kasb tanlash)", url: "/post/worker", who: "seeker-guest" },
  { name: "kabinet", url: "/cabinet", who: "worker" },
  { name: "AI yordamchi", url: "/ai", who: "worker" },
  { name: "til (birinchi ochilish)", url: "/start/til", who: "guest" },
  { name: "rol (birinchi ochilish)", url: "/start/rol", who: "guest" },
];

test.beforeAll(async () => {
  await sql("delete from public.vacancies where owner_profile_id = $1 and title = $2", [USERS.employer, LONG]);
  await sql(
    `insert into public.vacancies (owner_profile_id, title, region_id, description, status, salary_from, salary_to, salary_type, schedule, published_at, expires_at)
     select $1, $2, r.id, 'Uzun sarlavhali sinov e''loni: omborxona, hisob va jo''natish ishlari', 'active', 12500000, 18750000, 'monthly', '6_1', now(), now() + interval '7 days'
     from public.regions r where r.slug = 'tashkent_city'`,
    [USERS.employer, LONG],
  );
});
test.afterAll(async () => {
  await sql("delete from public.vacancies where owner_profile_id = $1 and title = $2", [USERS.employer, LONG]);
});

async function check(page: Page, zoom?: number) {
  await page.waitForLoadState("networkidle").catch(() => undefined);
  if (zoom) await zoomText(page, zoom);
  await fullHeight(page);
  return findLayoutIssues(page);
}

for (const c of CASES) {
  test(`ustma-ust yozuv yo'q: ${c.name}`, async ({ page, context }) => {
    test.setTimeout(180_000);
    await page.emulateMedia({ reducedMotion: "reduce" });
    const bad: string[] = [];
    for (const p of PAGES) {
      if (p.who === "worker") await loginAs(context, USERS.workerA);
      else if (p.who === "employer") {
        await loginAs(context, USERS.employer);
        await asMode(context, "employer");
      } else await asGuest(context);
      if (p.who === "seeker-guest") await asMode(context, "worker");
      if (p.who === "guest") await context.clearCookies({ name: "ib_mode" });
      await context.addCookies([{ name: "ishuz_locale", value: c.locale, url: test.info().project.use.baseURL ?? "http://localhost:3300" }]);
      await page.setViewportSize({ width: c.width, height: c.width < 768 ? 800 : 900 });
      await page.goto(p.url);
      for (const i of await check(page, c.zoom)) bad.push(`${p.name}: ${i.kind} — ${i.text}${i.other ? ` ⟂ ${i.other}` : ""}`);
    }
    expect(bad).toEqual([]);
  });
}

test("AI yordamchi oynasi: javob va kartalar ustma-ust emas (320 va katta shrift)", async ({ page, context }) => {
  test.setTimeout(120_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await asGuest(context);
  await asMode(context, "worker");
  for (const [width, zoom] of [
    [320, undefined],
    [390, 1.3],
  ] as const) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/");
    await page.getByRole("button", { name: "AI bilan qidirish" }).first().click();
    const dialog = page.getByRole("dialog", { name: "AI yordamchi" });
    await dialog.getByLabel("Nima qidiryapsiz?").fill("Toshkentda omborchi");
    await dialog.getByRole("button", { name: "Topish" }).click();
    await expect(dialog.getByText(/^Tushundim:/).last()).toBeVisible();
    if (zoom) await zoomText(page, zoom);
    expect(await findLayoutIssues(page, "[role=dialog]")).toEqual([]);
    await page.keyboard.press("Escape");
  }
});

test("pastki menyu: hech narsa menyudan yuqoriga chiqmaydi — ostidan o'tayotgan yozuvni to'smaydi (\"E'lon\" ham)", async ({ page, context }) => {
  for (const mode of ["worker", "employer"] as const) {
    await asGuest(context);
    await asMode(context, mode);
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/");
      const nav = page.locator("nav.bottom-nav");
      await expect(nav.getByRole("link", { name: "E'lon" })).toBeVisible();
      const out = await nav.evaluate((n) => {
        const top = n.getBoundingClientRect().top;
        return Array.from(n.querySelectorAll("*"))
          .filter((el) => el.getBoundingClientRect().top < top - 0.5)
          .map((el) => `${el.tagName}.${el.getAttribute("class")?.slice(0, 40)}`);
      });
      expect(out, `${mode} ${width}`).toEqual([]);
    }
  }
});
