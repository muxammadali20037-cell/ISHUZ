import { expect, test, type BrowserContext, type Locator } from "@playwright/test";
import { USERS, asGuest, asMode, loginAs, sql, stack } from "../support";

/**
 * R-F · tillar va tor ekran (360 px): asosiy ma'lumot "…" bilan kesilmasin, qator noto'g'ri joydan bo'linmasin.
 *  - ruscha "Работодатель" rejim tugmasida to'liq;
 *  - ishchi kartasida maosh summasi va tajriba ("Желаемая зарплата: 20 000 0…" / "Больше …" edi) to'liq;
 *  - vakansiya kartasida "сум/мес" ikki qatorga bo'linmaydi ("сум/" | "мес" edi);
 *  - faqat boshlang'ich maosh: o'zbekchada "kamida 4 000 000 so'm/oy" ("dan 4 000 000 so'm" — grammatik xato edi);
 *  - <html lang> — haqiqiy BCP-47 teg (kirill uchun "oz" emas, "uz-Cyrl"): ekran o'qigichi tilni to'g'ri tanlaydi.
 */

const host = new URL(stack.app).hostname;
const WORKER = "7e2e0000-0000-4000-8000-0000000001d0";

async function locale(ctx: BrowserContext, value: string) {
  await ctx.addCookies([{ name: "ishuz_locale", value, domain: host, path: "/" }]);
}

/**
 * Element ekranda va matni to'liq sig'adimi ("…" bilan kesilmagan). Avval ko'rinishini kutamiz: oqim (streaming) paytida
 * kontent bir lahza yashirin nusxada turadi — u yerda 0 = 0 bo'lib, kesilgan matn ham "sig'di" deb chiqardi.
 */
async function fits(el: Locator) {
  await expect(el).toBeVisible();
  return el.evaluate((n) => n.clientWidth > 0 && n.scrollWidth <= n.clientWidth + 1);
}

test.use({ viewport: { width: 360, height: 800 } });

test.beforeAll(async () => {
  await sql("delete from public.vacancies where owner_profile_id = $1", [USERS.employer]);
  await sql(`insert into auth.users (id, phone, phone_confirmed_at, raw_user_meta_data) values ($1, '+998907770191', now(), '{"first_name":"Zarina","last_name":"Tosheva"}') on conflict (id) do nothing`, [WORKER]);
  await sql("delete from public.worker_profiles where profile_id = $1", [WORKER]);
  const [n] = await sql<{ id: string; category_id: string }>("select id, category_id from public.profession_nodes where name_uz = 'Buxgalter' and selectable order by depth limit 1");
  const [w] = await sql<{ id: string }>(
    `insert into public.worker_profiles (profile_id, headline, about, region_id, profession_node_id, category_id, experience_level, is_public, onboarding_completed_at)
     select $1, 'Buxgalter', 'Buxgalteriya, 1C, soliq hisobotlari', r.id, $2, $3, '5y_plus', true, now() from public.regions r where r.slug = 'tashkent_city'
     returning id`,
    [WORKER, n!.id, n!.category_id],
  );
  await sql(
    `insert into public.worker_preferences (worker_id, salary_expected, salary_type) values ($1, 20000000, 'monthly')
     on conflict (worker_id) do update set salary_expected = excluded.salary_expected, salary_type = excluded.salary_type`,
    [w!.id],
  );
  for (const [title, from, to] of [["Bosh buxgalter (L1)", 6_000_000, 10_000_000], ["Buxgalter yordamchisi (L1)", 4_000_000, null]] as const) {
    await sql(
      `insert into public.vacancies (owner_profile_id, title, region_id, description, status, profession_node_id, salary_from, salary_to, salary_type, published_at, expires_at)
       select $1, $2, r.id, 'Sinov e''loni: ' || $2 || ', 1C va soliq hisobotlari', 'active', $3, $4, $5, 'monthly', now(), now() + interval '10 days'
       from public.regions r where r.slug = 'tashkent_city'`,
      [USERS.employer, title, n!.id, from, to],
    );
  }
});

test.afterAll(async () => {
  await sql("delete from public.vacancies where owner_profile_id = $1", [USERS.employer]);
  await sql("delete from public.worker_profiles where profile_id = $1", [WORKER]);
});

test("ru, 360 px: rejim tugmasi yozuvlari to'liq; <html lang> — BCP-47", async ({ page, context }) => {
  await asGuest(context);
  await asMode(context, "worker");
  await locale(context, "ru");
  await page.goto("/");
  const group = page.getByRole("radiogroup");
  for (const name of ["Соискатель", "Работодатель"]) {
    const label = group.getByRole("radio", { name }).locator("span");
    await expect(label).toHaveText(name);
    expect(await fits(label), name).toBe(true);
  }
  await expect(page.locator("html")).toHaveAttribute("lang", "ru");
  await locale(context, "oz");
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "uz-Cyrl");
});

test("ru, 360 px: ishchi kartasida maosh summasi va tajriba to'liq (to'liq yozuv ekran o'qigichi uchun)", async ({ page, context }) => {
  await loginAs(context, USERS.employer);
  await asMode(context, "employer");
  await locale(context, "ru");
  const [n] = await sql<{ id: string }>("select id from public.profession_nodes where name_uz = 'Buxgalter' and selectable order by depth limit 1");
  await page.goto(`/search?mode=workers&p=${n!.id}&region=all`);
  const card = page.locator("main article").filter({ hasText: "Zarina T." });
  await expect(card).toHaveCount(1);
  // maosh qatori ham, ichidagi ko'rinadigan matn ham "…" bilan kesilmagan
  const line = card.locator("p").filter({ hasText: "20 000 000" });
  expect(await fits(line), "maosh qatori").toBe(true);
  const salary = line.locator("span[aria-hidden]");
  await expect(salary).toHaveText("20 000 000 сум/мес");
  expect(await fits(salary), "maosh").toBe(true);
  const exp = card.locator("span[title^='Опыт'] span.truncate");
  await expect(exp).toHaveText("От 3 лет");
  expect(await fits(exp), "tajriba").toBe(true);
  await expect(card).toContainText("Желаемая зарплата: 20 000 000 сум/мес");
  await expect(card).toContainText("Опыт: Больше 3 лет");
});

test("ru, 360 px: vakansiya kartasida 'сум/мес' bitta qatorda, raqam ichidan bo'linmaydi", async ({ page, context }) => {
  await asGuest(context);
  await asMode(context, "worker");
  await locale(context, "ru");
  const [n] = await sql<{ id: string }>("select id from public.profession_nodes where name_uz = 'Buxgalter' and selectable order by depth limit 1");
  await page.goto(`/search?mode=jobs&p=${n!.id}&region=all`);
  const card = page.locator("main article").filter({ hasText: "Bosh buxgalter (L1)" });
  const salary = card.locator("span.tabular").first();
  await expect(salary).toBeVisible();
  await expect(salary).toHaveText("6 000 000 – 10 000 000 сум/мес");
  // har bir yaxlit bo'lak (raqam guruhi, "сум/мес") ekranda bitta qatorda — DOM tuzilishidan qat'i nazar, matn bo'yicha
  const split = await salary.evaluate((el) => {
    const text = el.textContent ?? "";
    const out: string[] = [];
    for (const m of text.matchAll(/\d{1,3}(?: \d{3})+|сум\/мес/g)) {
      const range = document.createRange();
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let pos = 0;
      let started = false;
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const len = node.textContent?.length ?? 0;
        if (!started && m.index < pos + len) {
          range.setStart(node, m.index - pos);
          started = true;
        }
        if (started && m.index + m[0].length <= pos + len) {
          range.setEnd(node, m.index + m[0].length - pos);
          break;
        }
        pos += len;
      }
      const rects = Array.from(range.getClientRects()).filter((r) => r.width > 0);
      // o'lchab bo'lmasa (ko'rinmayapti) — ham xato
      if (!rects.length || rects.some((r) => r.top >= rects[0]!.bottom - 1)) out.push(m[0]);
    }
    return out;
  });
  expect(split, "ikki qatorga bo'lingan bo'laklar").toEqual([]);
});

test("faqat boshlang'ich maosh: uz — 'kamida 4 000 000 so'm/oy', ru — 'от 4 000 000 сум/мес'", async ({ page, context }) => {
  await asGuest(context);
  await asMode(context, "worker");
  const [n] = await sql<{ id: string }>("select id from public.profession_nodes where name_uz = 'Buxgalter' and selectable order by depth limit 1");
  const card = page.locator("main article").filter({ hasText: "Buxgalter yordamchisi (L1)" });
  await locale(context, "uz");
  await page.goto(`/search?mode=jobs&p=${n!.id}&region=all`);
  await expect(card).toContainText("kamida 4 000 000 so'm/oy");
  await expect(card).not.toContainText("dan 4 000 000");
  await locale(context, "ru");
  await page.goto(`/search?mode=jobs&p=${n!.id}&region=all`);
  await expect(card).toContainText("от 4 000 000 сум/мес");
});
