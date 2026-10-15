import { expect, test } from "@playwright/test";
import { USERS, asGuest, asMode, loginAs, sql } from "../support";

/**
 * G · ish topish va ishchi topish oson:
 *  G1 — "Ish topish"ni bosgan zahoti e'lonlar: "Barcha ish e'lonlari · N ta" (bir bosishda natijalar) va eng yangilari;
 *  G2 — tezkor ariza: profil to'ldirmasdan (ism va telefon bilan), kirgach ariza oynasi o'zi ochiladi;
 *  G3 — natija kartasida raqam yo'q bo'lsa kulrang izoh emas, "Ariza yuborish" / "Bog'lanish";
 *  G4 — ishchi e'lonida raqam yashirin bo'lsa — shu yerning o'zida "Telefon raqamini so'rash".
 */

const FRESH = "7e2e0000-0000-4000-8000-0000000000e2";

async function seedVacancies() {
  await sql("delete from public.vacancies where owner_profile_id = $1", [USERS.employer]);
  await sql(
    `insert into public.employer_profiles (profile_id, employer_type, display_name, onboarding_completed_at)
     values ($1, 'person', 'Dilnoza opa', now()) on conflict (profile_id) do nothing`,
    [USERS.employer],
  );
  // e'lon egasi raqamini ko'rsatmaydi — kartada "Ariza yuborish"
  await sql("update public.profile_contacts set phone_visibility = 'applicants' where profile_id = $1", [USERS.employer]);
  await sql(
    `insert into public.vacancies (owner_profile_id, title, region_id, district_id, description, status, profession_node_id, salary_from, salary_type, published_at, expires_at)
     select $1, t.title, r.id, d.id, 'Sinov e''loni: ' || t.title || ', 9 dan 18 gacha', 'active', n.id, t.salary, 'monthly', now() - t.age, now() + interval '10 days'
     from (values ('Kassir — supermarket', 3500000, interval '3 hours', 'Kassir'), ('Oshpaz — milliy taomlar', 6000000, interval '2 hours', 'Oshpaz'),
                  ('Sotuvchi — kiyim do''koni', 4000000, interval '1 hour', 'Sotuvchi'), ('Buxgalter — kichik firma', 5000000, interval '4 hours', 'Buxgalter')) t(title, salary, age, prof)
     join public.regions r on r.slug = 'tashkent_city'
     join public.districts d on d.region_id = r.id and d.name_uz = 'Chilonzor tumani'
     left join lateral (select id from public.profession_nodes where name_uz = t.prof and selectable limit 1) n on true`,
    [USERS.employer],
  );
}

async function freshUser() {
  await sql(
    `insert into auth.users (id, phone, phone_confirmed_at, raw_user_meta_data) values ($1, '+998907770002', now(), '{"first_name":"Jasur"}')
     on conflict (id) do nothing`,
    [FRESH],
  );
  await sql("delete from public.applications where worker_id in (select id from public.worker_profiles where profile_id = $1)", [FRESH]);
  await sql("delete from public.worker_profiles where profile_id = $1", [FRESH]);
  await sql("delete from public.rate_limits where key like $1", [`%${FRESH}%`]);
}

test.beforeEach(async () => {
  await seedVacancies();
});
test.afterEach(async () => {
  await sql("delete from public.vacancies where owner_profile_id = $1", [USERS.employer]);
  await sql("delete from public.contact_requests where requester_profile_id = $1", [USERS.employer]);
  await sql("delete from public.worker_profiles where profile_id = any($1)", [[FRESH, USERS.workerB]]);
});


test("G1: 'Ish topish' — darhol 'Barcha ish e'lonlari · N ta' va yangilari; bir bosishda natijalar", async ({ page, context }) => {
  await asGuest(context);
  await asMode(context, "worker");
  // R-B: pastki menyuda "Ishlar" — bosh sahifa (u yerdagi ro'yxat — home.spec); qidiruv boshi to'g'ridan-to'g'ri
  await page.goto("/search?mode=jobs");
  const all = page.getByRole("link", { name: /^Barcha ish e'lonlari/ });
  await expect(all).toContainText("4 ta · Butun O'zbekiston");
  // eng yangisi birinchi, 3 tasi
  const newest = page.getByRole("region", { name: "Yangi ish e'lonlari" }).getByRole("listitem");
  await expect(newest).toHaveCount(3);
  await expect(newest.first()).toContainText("Sotuvchi — kiyim do'koni");
  // kasb tanlash pastda qoladi
  await expect(page.getByText("Qaysi kasb bo'yicha ish qidiryapsiz?")).toBeVisible();

  await all.click();
  await page.waitForURL((u) => u.searchParams.get("any") === "1" && u.searchParams.get("region") === "all");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ish e'lonlari: Barcha kasblar · Butun O'zbekiston");
  await expect(page.locator("main article")).toHaveCount(4);

  // yangi e'lon bosilsa — o'sha e'lon
  await page.goBack();
  await page.getByRole("region", { name: "Yangi ish e'lonlari" }).getByRole("listitem").first().getByRole("link").click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sotuvchi — kiyim do'koni");
});

test("G1: eslab qolingan tuman bo'yicha; ish beruvchida — 'Barcha ishchilar'", async ({ page, context }) => {
  await asGuest(context);
  await asMode(context, "worker");
  const [d] = await sql<{ id: string }>("select d.id from public.districts d join public.regions r on r.id = d.region_id where r.slug = 'tashkent_city' and d.name_uz = 'Yunusobod tumani'");
  await context.addCookies([{ name: "ib_place", value: `tashkent_city~${d!.id}`, domain: "localhost", path: "/" }]);
  await page.goto("/search?mode=jobs");
  // Yunusobodda e'lon yo'q — tugma ko'rsatilmaydi (adashtirmaydi), kasb tanlash qoladi
  await expect(page.getByRole("link", { name: /^Barcha ish e'lonlari/ })).toHaveCount(0);
  await expect(page.getByText("Qaysi kasb bo'yicha ish qidiryapsiz?")).toBeVisible();

  const [c] = await sql<{ id: string }>("select d.id from public.districts d join public.regions r on r.id = d.region_id where r.slug = 'tashkent_city' and d.name_uz = 'Chilonzor tumani'");
  await context.addCookies([{ name: "ib_place", value: `tashkent_city~${c!.id}`, domain: "localhost", path: "/" }]);
  await page.goto("/search?mode=jobs");
  await expect(page.getByRole("link", { name: /^Barcha ish e'lonlari/ })).toContainText("4 ta · Toshkent shahri · Chilonzor tumani");

  await sql("delete from public.worker_profiles where profile_id = $1", [USERS.workerB]);
  const [n] = await sql<{ id: string }>("select id from public.profession_nodes where name_uz = 'Buxgalter' and selectable limit 1");
  const [r] = await sql<{ id: string }>("select id from public.regions where slug = 'tashkent_city'");
  await sql(
    `insert into public.worker_profiles (profile_id, headline, about, region_id, profession_node_id, experience_level, onboarding_completed_at)
     values ($1, 'Buxgalter', 'Buxgalteriya, 1C, soliq hisobotlari', $2, $3, '3_5y', now())`,
    [USERS.workerB, r!.id, n!.id],
  );
  await asMode(context, "employer");
  await context.clearCookies({ name: "ib_place" });
  await page.goto("/search?mode=workers");
  // soni — boshqa spec'lar qoldirgan ochiq profillar ham bo'lishi mumkin; eng yangisi — hozir qo'shilgan
  await expect(page.getByRole("link", { name: /^Barcha ishchilar/ })).toContainText(/\d+ ta · Butun O'zbekiston/);
  await expect(page.getByRole("region", { name: "Yangi ishchilar" }).getByRole("listitem").first()).toContainText("Buxgalter");
});

test("G2+G3: kartada 'Ariza yuborish' → kirish → ariza oynasi o'zi ochiladi → profilsiz ariza → arizani ko'rish", async ({ page, context }) => {
  test.setTimeout(90_000);
  await freshUser();
  await asGuest(context);
  await asMode(context, "worker");
  await page.goto("/search?mode=jobs&any=1&region=all");
  const card = page.locator("main article").filter({ hasText: "Kassir — supermarket" });
  // raqam yo'q — kulrang izoh emas, aniq amal
  await expect(card.getByText("Raqam ko'rsatilmagan")).toHaveCount(0);
  await card.getByRole("link", { name: "Ariza yuborish" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Kassir — supermarket" })).toBeVisible();
  // mehmon: ariza → kirish, qaytish manzili ariza oynasi bilan
  await page.getByRole("button", { name: "Ariza yuborish" }).last().click();
  await page.waitForURL(/\/auth\?next=/);
  const next = new URL(page.url()).searchParams.get("next")!;
  expect(next).toMatch(/^\/jobs\/[^?]+\?apply=1$/);

  await loginAs(context, FRESH);
  await page.goto(next);
  const dialog = page.getByRole("dialog", { name: "Ariza yuborish" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(/Profil to'ldirish shart emas/)).toBeVisible();
  // profil yo'q — "profilim bilan tanishing" emas, "men bilan bog'laning"
  await expect(dialog.getByRole("textbox")).toHaveValue("Assalomu alaykum! «Kassir — supermarket» vakansiyasiga qiziqyapman. Iltimos, men bilan bog'laning.");
  await dialog.getByRole("button", { name: "Ariza yuborish" }).click();
  await expect(page.getByRole("dialog").getByText("Ariza yuborildi").first()).toBeVisible();
  await expect(page.getByRole("dialog").getByRole("link", { name: /Profilingizni 1 daqiqada to'ldiring/ })).toHaveAttribute("href", "/post/worker");
  await page.getByRole("link", { name: "Arizani ko'rish" }).click();
  await page.waitForURL(/\/applications\/[0-9a-f-]{36}$/);
  await expect(page.getByText("Yuborildi").first()).toBeVisible();

  // yopiq profil: qidiruvda ko'rinmaydi, ariza bazada
  const [w] = await sql<{ is_public: boolean; done: boolean }>("select is_public, onboarding_completed_at is not null as done from public.worker_profiles where profile_id = $1", [FRESH]);
  expect(w).toEqual({ is_public: false, done: false });
  const [a] = await sql<{ n: number }>(
    "select count(*)::int as n from public.applications a join public.vacancies v on v.id = a.vacancy_id where v.title = 'Kassir — supermarket' and a.worker_id = (select id from public.worker_profiles where profile_id = $1)",
    [FRESH],
  );
  expect(a!.n).toBe(1);
  // qayta ochilganda — "Ariza yuborilgan" (qayta yuborish tugmasi emas), ?apply=1 bo'lsa ham oyna ochilmaydi
  await page.goto(next);
  await expect(page.getByRole("link", { name: "Ariza yuborilgan" }).last()).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // ish beruvchi arizani ism bilan ko'radi (0064: to'liq bo'lmagan profil ariza orqali ko'rinadi)
  await loginAs(context, USERS.employer);
  await asMode(context, "employer");
  await page.goto("/employer/applications");
  await expect(page.getByText("Jasur").first()).toBeVisible();
});

test("G3+G4: ishchi kartasida 'Bog'lanish' → e'lon sahifasida bir bosishda raqam so'rovi", async ({ page, context }) => {
  await sql("delete from public.worker_profiles where profile_id = $1", [USERS.workerB]);
  const [n] = await sql<{ id: string }>("select id from public.profession_nodes where name_uz = 'Buxgalter' and selectable limit 1");
  const [r] = await sql<{ id: string }>("select id from public.regions where slug = 'tashkent_city'");
  await sql(
    `insert into public.worker_profiles (profile_id, headline, about, region_id, profession_node_id, experience_level, onboarding_completed_at)
     values ($1, 'Buxgalter', 'Buxgalteriya, 1C, soliq hisobotlari', $2, $3, '3_5y', now())`,
    [USERS.workerB, r!.id, n!.id],
  );
  await sql("update public.profile_contacts set phone_visibility = 'on_request' where profile_id = $1", [USERS.workerB]);
  await sql("delete from public.contact_requests where requester_profile_id = $1", [USERS.employer]);
  await loginAs(context, USERS.employer);
  await asMode(context, "employer");
  await page.goto(`/search?mode=workers&p=${n!.id}&region=all`);
  const card = page.locator("main article").first();
  await card.getByRole("link", { name: "Bog'lanish" }).click();
  await page.waitForURL(/\/listing\/[0-9a-f-]{36}#contact$/);
  const contact = page.locator("#contact");
  await contact.getByRole("button", { name: "Telefon raqamini so'rash" }).click();
  await expect(contact.getByText("So'rov yuborildi — javobini kutyapmiz")).toBeVisible();
  const [q] = await sql<{ status: string }>("select status from public.contact_requests where requester_profile_id = $1 and owner_profile_id = $2", [USERS.employer, USERS.workerB]);
  expect(q!.status).toBe("pending");
  // qayta ochilganda ham holat saqlanadi
  await page.reload();
  await expect(page.locator("#contact").getByText("So'rov yuborildi — javobini kutyapmiz")).toBeVisible();
  // egasi raqamni umuman yashirgan — so'rash tugmasi yo'q (so'rov baribir rad etilardi)
  await sql("update public.profile_contacts set phone_visibility = 'nobody' where profile_id = $1", [USERS.workerB]);
  await sql("delete from public.contact_requests where requester_profile_id = $1", [USERS.employer]);
  await page.reload();
  await expect(page.locator("#contact").getByText("Telefon raqam ariza yoki taklif qabul qilingandan keyin ochiladi.")).toBeVisible();
  await expect(page.locator("#contact").getByRole("button", { name: "Telefon raqamini so'rash" })).toHaveCount(0);
  await sql("update public.profile_contacts set phone_visibility = 'applicants' where profile_id = $1", [USERS.workerB]);
});
