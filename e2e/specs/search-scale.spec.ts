import { expect, test, type Locator, type Page } from "@playwright/test";
import { asGuest, asMode, loginAs, sql } from "../support";

/**
 * 100 ta vakansiya + 100 ta ishchi (2026-11-15, egasi: "ozing 100 ta vakansiya joylada 100 lasnyam ishch paneldan oddiy sozlar
 * bilan qidrb kor"). FAQAT lokal sinov stendida: jonli saytga soxta e'lon qo'yilmaydi (haqiqiy foydalanuvchini aldaydi).
 *
 * Oddiy odam yozadigan so'zlar sarlavhadagi qidiruvdan ("Ish va ishchilar izlash") yuboriladi va natija tekshiriladi:
 *  - topilgan son bazadagi haqiqatga teng (o'ylab topilgan e'lon yo'q, bittasi ham tushib qolmagan);
 *  - ko'rsatilgan kartochkalarning har biri so'ralgan kasb (va joy) bo'yicha;
 *  - ish beruvchi rejimida xuddi shu maydon ishchilarni qidiradi.
 * Hammasi testdan keyin o'chiriladi.
 */

const BOSS = "7e2e0000-0000-4000-8000-000000000900"; // 100 vakansiya egasi — alohida sinov ish beruvchisi
const workerId = (i: number) => `7e2e0000-0000-4000-8000-0000000010${String(i).padStart(2, "0")}`;
const WORKER_IDS = Array.from({ length: 100 }, (_, i) => workerId(i));

const PROFS = [
  "Oshpaz", "Sotuvchi", "Haydovchi", "Kassir", "Buxgalter", "Ofitsiant", "Taksi haydovchisi", "Santexnik", "Elektrik", "Tikuvchi", "Quruvchi",
  "Farrosh", "Enaga", "Sartarosh", "Hamshira", "Omborchi", "Barista", "Payvandchi", "Duradgor", "Avtomexanik", "Dasturchi", "Bog'bon",
];
// [viloyat slug, tuman]
const PLACES: [string, string][] = [
  ["tashkent_city", "Chilonzor tumani"],
  ["samarkand", "Samarqand shahri"],
  ["tashkent_city", "Yunusobod tumani"],
  ["fergana", "Farg'ona shahri"],
  ["tashkent_city", "Mirzo Ulug'bek tumani"],
  ["andijan", "Andijon shahri"],
  ["tashkent_city", "Yakkasaroy tumani"],
  ["bukhara", "Buxoro shahri"],
  ["tashkent_city", "Olmazor tumani"],
  ["namangan", "Namangan shahri"],
];
const FIRST = ["Aziz", "Bekzod", "Jasur", "Sardor", "Dilshod", "Otabek", "Rustam", "Shoxrux", "Jahongir", "Nodira", "Malika", "Gulnora", "Zarina", "Madina", "Feruza", "Sevara", "Kamola", "Nilufar", "Sherzod", "Ulug'bek"];
const LAST = ["Karimov", "Rahimov", "Tursunov", "Yusupov", "Qodirov", "Ergashev", "Nazarov", "Saidov", "Xolmatov", "Mirzayev"];
const EXP = ["none", "lt_6m", "1_2y", "2_3y", "3_5y", "5y_plus"];

async function cleanup() {
  await sql("delete from public.vacancies where owner_profile_id = $1", [BOSS]);
  await sql("delete from auth.users where id = any($1::uuid[])", [[BOSS, ...WORKER_IDS]]);
}

async function seed() {
  await cleanup();
  // ish beruvchi
  await sql(`insert into auth.users (id, phone, phone_confirmed_at, raw_user_meta_data) values ($1, '+998902229900', now(), '{"first_name":"Sinov","last_name":"Korxona"}')`, [BOSS]);
  await sql(`insert into public.profile_contacts (profile_id, phone, phone_verified_at) values ($1, '+998902229900', now()) on conflict (profile_id) do nothing`, [BOSS]);
  await sql(
    `insert into public.employer_profiles (profile_id, employer_type, display_name, onboarding_completed_at) values ($1, 'company', 'Sinov korxonasi', now())
     on conflict (profile_id) do nothing`,
    [BOSS],
  );

  // 100 ta vakansiya: kasb = PROFS[g % 22], joy = PLACES[g % 10], har 4-chisi kunlik haq bilan
  const rows = Array.from({ length: 100 }, (_, g) => ({
    prof: PROFS[g % PROFS.length]!,
    region: PLACES[g % PLACES.length]![0],
    district: PLACES[g % PLACES.length]![1],
    daily: g % 4 === 0,
    salary: g % 4 === 0 ? 200_000 + (g % 3) * 50_000 : 3_000_000 + (g % 7) * 500_000,
    minutes: g,
  }));
  await sql(
    `insert into public.vacancies (owner_profile_id, title, region_id, district_id, category_id, profession_node_id, description, status,
                                   salary_from, salary_type, published_at, expires_at)
     select $1, x.prof || ' kerak — ' || d.name_uz, r.id, d.id, n.category_id, n.id,
            x.prof || ' kerak. Ish vaqti 9:00–18:00, tushlik bepul. Tajriba bo''lsa yaxshi, o''rgatamiz.', 'active',
            x.salary, (case when x.daily then 'daily' else 'monthly' end)::public.salary_type, now() - make_interval(mins => x.minutes), now() + interval '20 days'
     from jsonb_to_recordset($2::jsonb) as x(prof text, region text, district text, daily boolean, salary int, minutes int)
     join public.regions r on r.slug = x.region
     join public.districts d on d.region_id = r.id and d.name_uz = x.district
     join lateral (select id, category_id from public.profession_nodes where name_uz = x.prof and selectable and is_active order by depth limit 1) n on true`,
    [BOSS, JSON.stringify(rows)],
  );

  // 100 ta ishchi: kasb = PROFS[i % 22], joy = PLACES[(i + 3) % 10], har 6-chisi bugundan ishga tayyor
  const workers = WORKER_IDS.map((id, i) => ({
    id,
    phone: `+99890222${String(i).padStart(4, "0")}`,
    first: FIRST[i % FIRST.length]!,
    last: LAST[(i * 3) % LAST.length]!,
    prof: PROFS[i % PROFS.length]!,
    region: PLACES[(i + 3) % PLACES.length]![0],
    district: PLACES[(i + 3) % PLACES.length]![1],
    exp: EXP[i % EXP.length]!,
    today: i % 6 === 0,
    minutes: i,
  }));
  const meta = JSON.stringify(workers);
  await sql(
    `insert into auth.users (id, phone, phone_confirmed_at, raw_user_meta_data)
     select x.id, x.phone, now(), jsonb_build_object('first_name', x.first, 'last_name', x.last)
     from jsonb_to_recordset($1::jsonb) as x(id uuid, phone text, first text, last text)`,
    [meta],
  );
  await sql(
    `insert into public.profile_contacts (profile_id, phone, phone_verified_at)
     select x.id, x.phone, now() from jsonb_to_recordset($1::jsonb) as x(id uuid, phone text)
     on conflict (profile_id) do nothing`,
    [meta],
  );
  await sql(
    `insert into public.worker_profiles (profile_id, headline, category_id, profession_node_id, region_id, district_id, experience_level, about,
                                         onboarding_completed_at, is_public, last_active_at)
     select x.id, x.prof, n.category_id, n.id, r.id, d.id, x.exp::public.experience_level,
            'Ishga tayyorman. Mas''uliyatli, o''z vaqtida kelaman.', now(), true, now() - make_interval(mins => x.minutes)
     from jsonb_to_recordset($1::jsonb) as x(id uuid, prof text, region text, district text, exp text, minutes int)
     join public.regions r on r.slug = x.region
     join public.districts d on d.region_id = r.id and d.name_uz = x.district
     join lateral (select id, category_id from public.profession_nodes where name_uz = x.prof and selectable and is_active order by depth limit 1) n on true`,
    [meta],
  );
  await sql(
    `insert into public.worker_preferences (worker_id, availability)
     select w.id, (case when x.today then 'today' else 'negotiable' end)::public.availability
     from jsonb_to_recordset($1::jsonb) as x(id uuid, today boolean)
     join public.worker_profiles w on w.profile_id = x.id
     on conflict (worker_id) do update set availability = excluded.availability`,
    [meta],
  );
}

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  await seed();
  const [counts] = await sql<{ v: string; w: string }>(
    `select (select count(*) from public.vacancies where owner_profile_id = $1 and status = 'active') v,
            (select count(*) from public.worker_profiles where profile_id = any($2::uuid[]) and is_public) w`,
    [BOSS, WORKER_IDS],
  );
  expect(Number(counts?.v), "100 ta vakansiya joylandi").toBe(100);
  expect(Number(counts?.w), "100 ta ishchi e'loni joylandi").toBe(100);
});
test.afterAll(cleanup);
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.clear();
    for (const k of Object.keys(localStorage)) if (k.startsWith("ib_ai_")) localStorage.removeItem(k);
  });
});

/** Bazadagi haqiqat (qidiruvdan mustaqil oddiy SQL): shu kasb [va joy] bo'yicha faol vakansiyalar soni */
async function jobsInDb(prof: string | null, where: { district?: string; region?: string; daily?: boolean } = {}) {
  const [r] = await sql<{ n: string }>(
    `select count(*) n from public.vacancies v
     join public.regions r on r.id = v.region_id
     left join public.districts d on d.id = v.district_id
     left join public.profession_nodes p on p.id = v.profession_node_id
     where v.status = 'active' and v.expires_at > now()
       and ($1::text is null or p.name_uz = $1) and ($2::text is null or d.name_uz = $2) and ($3::text is null or r.slug = $3)
       and (not $4 or v.salary_type = 'daily')`,
    [prof, where.district ?? null, where.region ?? null, !!where.daily],
  );
  return Number(r?.n);
}

/** Bazadagi haqiqat: shu kasb [va joy, tajriba] bo'yicha ochiq ishchi e'lonlari soni */
async function workersInDb(prof: string, where: { district?: string; region?: string; experienced?: boolean } = {}) {
  const [r] = await sql<{ n: string }>(
    `select count(*) n from public.worker_profiles w
     join public.profiles pf on pf.id = w.profile_id
     join public.profession_nodes p on p.id = w.profession_node_id
     left join public.regions r on r.id = w.region_id
     left join public.districts d on d.id = w.district_id
     where w.is_public and w.onboarding_completed_at is not null and not pf.is_blocked and w.status <> 'not_looking'
       and p.name_uz = $1 and ($2::text is null or d.name_uz = $2) and ($3::text is null or r.slug = $3)
       and (not $4 or w.experience_level not in ('none', 'lt_6m'))`,
    [prof, where.district ?? null, where.region ?? null, !!where.experienced],
  );
  return Number(r?.n);
}

/**
 * Sarlavhadagi qidiruvga oddiy so'z yozib, Enter — yordamchi oynasidagi javob.
 * Har so'rov yangi suhbatda (oldingi javob aralashmasin): sahifa skriptlaridan oldin suhbat xotirasi tozalanadi.
 */
async function search(page: Page, text: string) {
  await page.goto("/");
  const field = page.locator("form[data-top-search][data-hydrated] input[name='q']");
  // ish qidiruvchida — "Lavozim yoki kompaniyani qidiring...", ish beruvchida — "Ish va ishchilar izlash" (4.0)
  await expect(field).toHaveAttribute("placeholder", /^(Lavozim yoki kompaniyani qidiring\.\.\.|Ish va ishchilar izlash)$/);
  await field.fill(text);
  await field.press("Enter");
  const dialog = page.getByRole("dialog");
  await expect(dialog.locator("[data-ai-you]")).toHaveText(`Siz: ${text}`);
  await expect(dialog.locator("[data-ai-reply]")).toHaveCount(1);
  await expect(dialog.locator("[data-ai-reply]")).not.toHaveClass(/type-caret/, { timeout: 20_000 });
  return dialog;
}

/** Javobda aynan `n` ta topilgani aytilgan, ko'rsatilgan kartochkalarning hammasi so'ralgan kasb (va joy) bo'yicha */
async function expectFound(dialog: Locator, n: number, prof: string, place?: string, card: string | RegExp = prof) {
  expect(n, `bazada "${prof}" bo'lishi kerak`).toBeGreaterThan(0);
  // javob yozilgan tilda bo'lishi mumkin ("повар нужен" → ruscha): son o'zi tekshiriladi
  await expect(dialog.locator("[data-ai-reply]")).toContainText(new RegExp(`(^|\\D)${n}(\\D|$)`));
  await expect(dialog.getByText("Tushundim:")).toContainText(prof);
  const cards = dialog.locator("article");
  await expect(cards).toHaveCount(Math.min(n, 10));
  await expect(cards.filter({ hasText: card })).toHaveCount(Math.min(n, 10));
  if (place) await expect(cards.filter({ hasText: place })).toHaveCount(Math.min(n, 10));
}

test.describe("ish izlovchi: sarlavhadagi qidiruvdan oddiy so'zlar bilan", () => {
  test.beforeEach(async ({ context }) => {
    await asGuest(context);
    await asMode(context, "worker");
  });

  test("bitta so'z, joy bilan, «kerak» bilan — topilgani bazadagiga teng", async ({ page }) => {
    let d = await search(page, "oshpaz");
    await expectFound(d, await jobsInDb("Oshpaz"), "Oshpaz");

    d = await search(page, "Chilonzorda oshpaz");
    await expectFound(d, await jobsInDb("Oshpaz", { district: "Chilonzor tumani" }), "Oshpaz", "Chilonzor");
    await expect(d.locator("[data-ai-relaxed]")).toHaveCount(0);

    d = await search(page, "haydovchi kerak");
    // "Taksi haydovchisi" alohida kasb — "haydovchi kerak" deganda aynan haydovchilar
    await expectFound(d, await jobsInDb("Haydovchi"), "Haydovchi", undefined, /Haydovchi kerak —/);

    d = await search(page, "Samarqandda sotuvchi");
    await expectFound(d, await jobsInDb("Sotuvchi", { region: "samarkand" }), "Sotuvchi", "Samarqand");
  });

  test("«kunlik ish» — faqat kunlik haqli ishlar, hammasi", async ({ page }) => {
    const d = await search(page, "kunlik ish");
    const n = await jobsInDb(null, { daily: true });
    expect(n).toBe(25);
    await expect(d.locator("[data-ai-reply]")).toContainText(`${n} ta `);
    await expect(d.locator("article")).toHaveCount(10);
  });

  test("imlo xatosi bilan ham topadi: «oshpz», «kasir»", async ({ page }) => {
    let d = await search(page, "oshpz");
    await expectFound(d, await jobsInDb("Oshpaz"), "Oshpaz");
    await expect(d.getByText("Kasbni aniqlay olmadim")).toHaveCount(0);

    d = await search(page, "kasir kerak");
    await expectFound(d, await jobsInDb("Kassir"), "Kassir");
  });

  test("ruscha va kirillcha yozilsa ham: «повар», «ошпаз»", async ({ page }) => {
    const n = await jobsInDb("Oshpaz");
    await expectFound(await search(page, "повар нужен"), n, "Oshpaz");
    await expectFound(await search(page, "ошпаз керак"), n, "Oshpaz");
  });

  test("«enaga» — Enaga kasbi (sinonimi o'xshash boshqa kasb emas)", async ({ page }) => {
    await expectFound(await search(page, "enaga"), await jobsInDb("Enaga"), "Enaga");
  });

  test("so'ralgan tumanda yo'q — kengaytirib topadi va buni ochiq aytadi", async ({ page }) => {
    expect(await jobsInDb("Kassir", { region: "tashkent_city" })).toBe(0);
    const d = await search(page, "Yunusobodda kassir");
    const notes = d.locator("[data-ai-relaxed]");
    await expect(notes).toContainText("Yunusobod tumanida hozircha yo'q");
    await expect(notes).toContainText("butun O'zbekiston bo'yicha ko'rsatildi");
    await expectFound(d, await jobsInDb("Kassir"), "Kassir");
  });
});

test.describe("ish beruvchi: o'sha maydon ishchilarni qidiradi", () => {
  test.beforeEach(async ({ context }) => {
    await loginAs(context, BOSS);
    await asMode(context, "employer");
  });

  test("kasb, joy, tajriba — topilgani bazadagiga teng", async ({ page }) => {
    await expectFound(await search(page, "oshpaz kerak"), await workersInDb("Oshpaz"), "Oshpaz");
    await expectFound(await search(page, "Toshkentda sotuvchi kerak"), await workersInDb("Sotuvchi", { region: "tashkent_city" }), "Sotuvchi", "Toshkent");
    const d = await search(page, "Chilonzorda sotuvchi");
    await expectFound(d, await workersInDb("Sotuvchi", { district: "Chilonzor tumani" }), "Sotuvchi", "Chilonzor");
    await expect(d.locator("[data-ai-relaxed]")).toHaveCount(0);
    await expectFound(await search(page, "tajribali haydovchi"), await workersInDb("Haydovchi", { experienced: true }), "Haydovchi");
  });

  test("«enaga kerak» va imlo xatosi «elektirk»", async ({ page }) => {
    await expectFound(await search(page, "enaga kerak"), await workersInDb("Enaga"), "Enaga");
    await expectFound(await search(page, "elektirk kerak"), await workersInDb("Elektrik"), "Elektrik");
  });

  test("so'ralgan viloyatda yo'q — kengaytirib, ochiq aytib ko'rsatadi; telefon raqami ochiq emas", async ({ page }) => {
    expect(await workersInDb("Tikuvchi", { region: "fergana" })).toBe(0);
    const d = await search(page, "Farg'onada tikuvchi");
    await expect(d.locator("[data-ai-relaxed]")).toContainText("Farg'onada hozircha yo'q — butun O'zbekiston bo'yicha ko'rsatildi");
    await expectFound(d, await workersInDb("Tikuvchi"), "Tikuvchi");
    // raqamlar ro'yxatda ochiq emas (standart: faqat ariza bergan ish beruvchiga)
    expect((await d.locator("article").allInnerTexts()).join("\n")).not.toMatch(/\+?998\s?90\s?222/);
  });
});
