import { expect, test, type Page } from "@playwright/test";
import { USERS, asGuest, asMode, loginAs, sql } from "../support";

/** C8.7 · kabinet, e'lon sahifasi, profil: holat va keyingi amal tushunarli, bitta aksent rang, o'zbekcha atamalar */

async function activeVacancy() {
  await sql("delete from public.vacancies where owner_profile_id = $1", [USERS.employer]);
  const [n] = await sql<{ id: string }>("select id from public.profession_nodes where name_uz = 'Buxgalter' and selectable limit 1");
  const [r] = await sql<{ id: string }>("select id from public.regions where slug = 'tashkent_city'");
  const [v] = await sql<{ slug: string }>(
    `insert into public.vacancies (owner_profile_id, title, region_id, description, status, profession_node_id, salary_negotiable, published_at, expires_at)
     values ($1, 'Buxgalter', $2, 'Kichik do''konga buxgalter kerak, haftasiga 5 kun', 'active', $3, true, now(), timestamptz '2026-10-22 12:00+05')
     returning slug`,
    [USERS.employer, r!.id, n!.id],
  );
  return v!.slug;
}

async function bigBrandSurfaces(page: Page) {
  return page.evaluate(() => {
    // token ranglari brauzer hisoblagan ko'rinishda (5.0 tokenlari oklch da — namuna element orqali)
    const brand = ["--primary", "--success"].map((v) => {
      const probe = document.createElement("span");
      probe.style.backgroundColor = `var(${v})`;
      document.body.append(probe);
      const c = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return c;
    });
    return Array.from(document.querySelectorAll<HTMLElement>("main *")).filter((el) => brand.includes(getComputedStyle(el).backgroundColor) && el.getBoundingClientRect().height >= 80).length;
  });
}

test.afterEach(async () => {
  await sql("delete from public.vacancies where owner_profile_id = $1", [USERS.employer]);
  await sql("delete from public.worker_profiles where profile_id = $1", [USERS.workerB]);
});

test("kabinet: faol e'lon muddati 'gacha' bilan; 'Ishchi topdim' yopuvchi amal — eng yorqin tugma emas", async ({ page, context }) => {
  await activeVacancy();
  await loginAs(context, USERS.employer);
  await asMode(context, "employer");
  // e'lonlar — "E'lonlarim" bo'limida (2026-11-21: pastki menyuning 2-bo'limi, "Faol" yorlig'i)
  await page.goto("/cabinet/elonlar");
  await expect(page.getByText("Faol — qidiruvda ko'rinadi · 22-oktabr 2026 gacha")).toBeVisible();
  const found = page.getByRole("button", { name: "Ishchi topdim" });
  await expect(found).toBeVisible();
  const bg = await found.evaluate((el) => getComputedStyle(el).backgroundColor);
  // 5.0 tokenlari oklch da — token rangi brauzer hisoblagan ko'rinishda (namuna element orqali) solishtiriladi
  const success = await page.evaluate(() => {
    const probe = document.createElement("span");
    probe.style.backgroundColor = "var(--success)";
    document.body.append(probe);
    const c = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return c;
  });
  expect(bg).not.toBe(success);
  // Profil sodda (2026-11-21): "yangi e'lon" bloki yo'q; rejim almashtirgichi yo'q; rol — "Boshqa sozlamalar" ichida
  await page.goto("/cabinet");
  await expect(page.getByRole("link", { name: "Ish e'loni berish" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "O'zim haqimda e'lon berish" })).toHaveCount(0);
  await expect(page.getByRole("radiogroup", { name: "Rejim" })).toHaveCount(0);
  await page.locator("main [data-fold='more'] [data-fold-toggle]").click();
  await expect(page.locator("main [data-role-switch]")).toHaveText(/Ish izlovchiga o'tish/);
});

test("vakansiya sahifasi: bandlik turi o'zbekcha ('To'liq kun', 'Full-time' emas)", async ({ page, context }) => {
  const slug = await activeVacancy();
  await asGuest(context);
  await page.goto(`/jobs/${slug}`);
  // sarlavhadagi shartlar qatorida va "Sharoitlar" bo'limida
  await expect(page.getByText("To'liq kun").first()).toBeVisible();
  await expect(page.getByText("Full-time")).toHaveCount(0);
  // kasb yo'li o'z qatorida: mobil'da qator boshida yolg'iz "·" qolmaydi
  await expect(page.locator("main span[aria-hidden]").filter({ hasText: /^·$/ })).toHaveCount(0);
});

test("profil tanlovi (hali profili yo'q foydalanuvchi): ikki teng neytral karta, takrorlangan izoh yo'q", async ({ page, context }) => {
  // ishchi ham, ish beruvchi ham profili yo'q — /profile tanlov ekraniga olib boradi (boshqa testlar qoldirgan holatga bog'liq emas)
  await sql("delete from public.worker_profiles where profile_id = $1", [USERS.workerA]);
  await loginAs(context, USERS.workerA);
  await page.goto("/profile");
  await page.waitForURL(/\/onboarding/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect(await bigBrandSurfaces(page)).toBe(0);
  await expect(page.getByText(/ikkala rejim/i)).toHaveCount(1);
});

test("ishchi e'loni (egasi): holat neytral kartada; ikonka plitasida 'Kasb tasviri' yozuvi yo'q", async ({ page, context }) => {
  await sql("delete from public.worker_profiles where profile_id = $1", [USERS.workerB]);
  const [n] = await sql<{ id: string }>("select id from public.profession_nodes where name_uz = 'Buxgalter' and selectable limit 1");
  const [r] = await sql<{ id: string }>("select id from public.regions where slug = 'tashkent_city'");
  const [w] = await sql<{ id: string }>(
    `insert into public.worker_profiles (profile_id, headline, about, region_id, profession_node_id, experience_level, onboarding_completed_at)
     values ($1, 'Buxgalter', 'Buxgalteriya, 1C, soliq hisobotlari', $2, $3, '3_5y', now()) returning id`,
    [USERS.workerB, r!.id, n!.id],
  );
  await loginAs(context, USERS.workerB);
  await page.goto(`/listing/${w!.id}`);
  await expect(page.getByText("Qidiruvda ko'rinadi")).toBeVisible();
  await expect(page.getByRole("link", { name: "E'lonni o'zgartirish" })).toBeVisible();
  expect(await bigBrandSurfaces(page)).toBe(0);
  // holat — kichik nuqtali yozuv, butun blok yashil chegara bilan o'ralmaydi
  const successBorders = await page.evaluate(() => {
    // token rangi brauzer hisoblagan ko'rinishda (5.0 tokenlari oklch da)
    const probe = document.createElement("span");
    probe.style.color = "var(--success)";
    document.body.append(probe);
    const success = getComputedStyle(probe).color;
    probe.remove();
    return Array.from(document.querySelectorAll<HTMLElement>("main *")).filter((el) => {
      const cs = getComputedStyle(el);
      return cs.borderTopStyle !== "none" && parseFloat(cs.borderTopWidth) > 0 && cs.borderTopColor === success;
    }).length;
  });
  expect(successBorders).toBe(0);
  // surat ham, kasb rasmi ham yo'q — faqat ikonka: "Kasb tasviri" yozuvi ma'nosiz
  await expect(page.getByText("Kasb tasviri")).toHaveCount(0);
});
