import { expect, test, type Locator, type Page } from "@playwright/test";
import { USERS, loginAs, sql } from "../support";

/**
 * C8.8 · arizalar, takliflar, chat, bildirishnomalar — ikki rol bilan oxirigacha:
 * ishchi ariza yuboradi → ish beruvchi kabinetdan ko'radi, holatni o'zgartiradi, yozadi → ishchi bildirishnoma oladi va javob beradi;
 * ish beruvchi to'g'ridan-to'g'ri taklif yuboradi → ishchi qabul qiladi → ish beruvchiga xabar.
 */

async function setup() {
  await sql("delete from public.vacancies where owner_profile_id = $1", [USERS.employer]);
  await sql("delete from public.job_offers where employer_profile_id = $1", [USERS.employer]);
  await sql("delete from public.worker_profiles where profile_id = $1", [USERS.workerB]);
  await sql("delete from public.notifications where profile_id = any($1)", [[USERS.employer, USERS.workerB]]);
  // oddiy "Ish e'loni berish" oqimi qoldiradigan holat: ish beruvchi profili ("O'zim uchun") va faol rol
  await sql(
    `insert into public.employer_profiles (profile_id, employer_type, display_name, onboarding_completed_at)
     values ($1, 'person', 'Dilnoza opa', now()) on conflict (profile_id) do nothing`,
    [USERS.employer],
  );
  await sql("update public.profiles set active_role = coalesce(active_role, 'employer') where id = $1", [USERS.employer]);
  const [n] = await sql<{ id: string }>("select id from public.profession_nodes where name_uz = 'Buxgalter' and selectable limit 1");
  const [r] = await sql<{ id: string }>("select id from public.regions where slug = 'tashkent_city'");
  const [v] = await sql<{ id: string; slug: string }>(
    `insert into public.vacancies (owner_profile_id, title, region_id, description, status, profession_node_id, salary_negotiable, published_at, expires_at)
     values ($1, 'Buxgalter', $2, 'Kichik do''konga buxgalter kerak, haftasiga 5 kun', 'active', $3, true, now(), now() + interval '10 days')
     returning id, slug`,
    [USERS.employer, r!.id, n!.id],
  );
  // oddiy oqimdagi kabi familiyasiz ishchi ("Botir"): faqat ism so'raladi
  await sql("update public.profiles set last_name = '' where id = $1", [USERS.workerB]);
  const [w] = await sql<{ id: string }>(
    `insert into public.worker_profiles (profile_id, headline, about, region_id, profession_node_id, experience_level, onboarding_completed_at)
     values ($1, 'Buxgalter', 'Buxgalteriya, 1C, soliq hisobotlari', $2, $3, '3_5y', now()) returning id`,
    [USERS.workerB, r!.id, n!.id],
  );
  return { vacancy: v!, workerId: w!.id };
}

const hex = (rgb: string) => `#${(rgb.match(/\d+/g) ?? []).slice(0, 3).map((x) => Number(x).toString(16).padStart(2, "0")).join("")}`;

async function isPrimary(page: Page, el: Locator) {
  const [bg, primary] = await Promise.all([el.evaluate((e) => getComputedStyle(e).backgroundColor), page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--primary").trim())]);
  return hex(bg) === primary;
}

test.afterEach(async () => {
  await sql("delete from public.vacancies where owner_profile_id = $1", [USERS.employer]);
  await sql("delete from public.job_offers where employer_profile_id = $1", [USERS.employer]);
  await sql("delete from public.worker_profiles where profile_id = $1", [USERS.workerB]);
  await sql("update public.profiles set last_name = 'Boboyev' where id = $1", [USERS.workerB]);
});

test("ariza: ishchi yuboradi → ish beruvchi kabinetdan ochadi, holatni o'zgartiradi, yozadi → ishchi bildirishnoma oladi va javob beradi", async ({ page, context }) => {
  test.setTimeout(120_000);
  const { vacancy } = await setup();

  // ishchi: ariza
  await loginAs(context, USERS.workerB);
  await page.goto(`/jobs/${vacancy.slug}`);
  await page.getByRole("button", { name: "Ariza yuborish" }).last().click();
  await page.getByRole("dialog").getByRole("button", { name: "Ariza yuborish" }).click();
  await expect(page.getByRole("dialog").getByText("Ariza yuborildi").first()).toBeVisible();
  await page.getByRole("link", { name: "Arizani ko'rish" }).click();
  await expect(page).toHaveURL(/\/applications\/[0-9a-f-]{36}$/);

  // ish beruvchi: kabinetdagi vakansiya kartasida arizalar soni va havola (asosiy keyingi amal)
  await context.clearCookies();
  await loginAs(context, USERS.employer);
  await page.goto("/cabinet");
  const apps = page.getByRole("link", { name: /Arizalar: 1 ta/ });
  await expect(apps).toBeVisible();
  await expect(apps).toContainText("1 ta yangi");
  await apps.click();
  await expect(page).toHaveURL(new RegExp(`/employer/vacancies/${vacancy.id}/applications$`));
  await page.getByRole("link", { name: /Botir/ }).first().click();
  await expect(page).toHaveURL(new RegExp(`/employer/vacancies/${vacancy.id}/applications/[0-9a-f-]{36}$`));

  // moslik sabablari nomzod haqida (ishchiga murojaat emas)
  const main = page.getByRole("main");
  await expect(main.getByText("Kasbi aynan mos")).toBeVisible();
  await expect(main.getByText(/Kasbingiz|sizga mos/)).toHaveCount(0);
  // mobil: "Yozish" va kontakt holat blokidan keyin, moslik/tarixdan oldin
  const write = main.getByRole("link", { name: "Yozish" });
  const matchHeading = main.getByRole("heading", { name: "Moslik" });
  expect((await write.boundingBox())!.y).toBeLessThan((await matchHeading.boundingBox())!.y);

  await main.getByRole("button", { name: "Tanlovga olish" }).click();
  await expect.poll(async () => (await sql<{ status: string }>("select status from public.applications where vacancy_id = $1", [vacancy.id]))[0]?.status).toBe("shortlisted");

  await write.click();
  await expect(page).toHaveURL(/\/messages\/[0-9a-f-]{36}$/);
  const conversationUrl = page.url();
  const box = page.getByPlaceholder("Xabar yozing...");
  await box.fill("Assalomu alaykum! Ertaga 10:00 da suhbatga kela olasizmi?");
  await box.press("Enter");
  await expect(box).toHaveValue("");
  await expect(page.locator("span", { hasText: "Ertaga 10:00 da suhbatga kela olasizmi?" })).toBeVisible();

  // ish beruvchi bildirishnomasi: "Botir ." emas, foiz emas
  await page.goto("/notifications");
  await expect(page.getByText("Botir ariza yubordi · Juda mos")).toBeVisible();
  await expect(page.getByRole("main").getByText(/Botir \.|\d+% mos/)).toHaveCount(0);

  // ishchi: bildirishnomalar (holat — ogohlantirish rangida emas), chat javobi
  await context.clearCookies();
  await loginAs(context, USERS.workerB);
  await page.goto("/notifications");
  await expect(page.getByText("Ariza holati: Tanlovda")).toBeVisible();
  await expect(page.getByRole("main").locator(".bg-warning-soft")).toHaveCount(0);
  await page.getByText("Ertaga 10:00 da suhbatga kela olasizmi?").first().click();
  await expect(page).toHaveURL(conversationUrl);
  const reply = page.getByPlaceholder("Xabar yozing...");
  await reply.fill("Ha, kela olaman. Rahmat!");
  await reply.press("Enter");
  await expect(reply).toHaveValue("");
  await expect(page.locator("span", { hasText: "Ha, kela olaman. Rahmat!" })).toBeVisible();

  // ish beruvchi javobni ko'radi
  await context.clearCookies();
  await loginAs(context, USERS.employer);
  await page.goto(conversationUrl);
  await expect(page.locator("span", { hasText: "Ha, kela olaman. Rahmat!" })).toBeVisible();
});

test("taklif: ish beruvchi yuboradi → ishchi qabul qiladi (asosiy rang tugma) → ish beruvchiga bildirishnoma", async ({ page, context }) => {
  test.setTimeout(120_000);
  const { workerId } = await setup();
  await loginAs(context, USERS.employer);
  await page.goto(`/workers/${workerId}`);
  await page.getByRole("button", { name: "Taklif yuborish" }).first().click();
  await page.getByRole("dialog").getByRole("button", { name: "Taklif yuborish" }).click();
  await expect(page.getByText("Taklif yuborildi")).toBeVisible();

  await context.clearCookies();
  await loginAs(context, USERS.workerB);
  await page.goto("/offers");
  await page.locator("main a[href^='/offers/']").first().click();
  const accept = page.getByRole("main").getByRole("button", { name: "Qabul qilish" });
  // qabul qilish — asosiy amal: tasdiqlash oynasidagi bilan bir xil asosiy rang (avval sahifada yashil, oynada ko'k edi)
  expect(await isPrimary(page, accept)).toBe(true);
  await accept.click();
  await page.getByRole("alertdialog").or(page.getByRole("dialog")).getByRole("button", { name: "Qabul qilish" }).click();
  await expect(page.getByText("Siz taklifni qabul qildingiz")).toBeVisible();
  const call = page.getByRole("link", { name: "Qo'ng'iroq qilish" });
  await expect(call).toBeVisible();
  expect(await isPrimary(page, call)).toBe(true);

  await context.clearCookies();
  await loginAs(context, USERS.employer);
  await page.goto("/notifications");
  await expect(page.getByText("Taklif qabul qilindi")).toBeVisible();
  await expect(page.getByText("Botir · Buxgalter")).toBeVisible(); // familiyasiz — "Botir ·", ortiqcha bo'shliq/nuqta yo'q
});

test("chat bo'sh holati rolga mos: ish beruvchiga 'arizani oching', ishchiga 'ishlarni ko'rish'", async ({ page, context }) => {
  await setup();
  await loginAs(context, USERS.employer);
  await page.goto("/messages");
  await expect(page.getByText("Hozircha suhbatlar yo'q")).toBeVisible();
  await expect(page.getByText(/arizasini oching/)).toBeVisible();
  await expect(page.getByRole("main").getByRole("link", { name: "Kelgan arizalar" })).toHaveAttribute("href", "/employer/applications");

  await context.clearCookies();
  await loginAs(context, USERS.workerB);
  await page.goto("/messages");
  await expect(page.getByRole("main").getByRole("link", { name: "Ishlarni ko'rish" })).toBeVisible();
});

test("desktop: ariza sahifasida amallar o'ng ustunda, sahifa boshida", async ({ page, context }) => {
  const { vacancy, workerId } = await setup();
  const [app] = await sql<{ id: string }>("insert into public.applications (vacancy_id, worker_id, cover_message) values ($1, $2, 'Assalomu alaykum!') returning id", [vacancy.id, workerId]);
  await page.setViewportSize({ width: 1280, height: 900 });
  await loginAs(context, USERS.employer);
  await page.goto(`/employer/vacancies/${vacancy.id}/applications/${app!.id}`);
  const main = page.getByRole("main");
  const write = (await main.getByRole("link", { name: "Yozish" }).boundingBox())!;
  const timeline = (await main.getByRole("heading", { name: "Holat tarixi" }).boundingBox())!;
  // o'ng ustun (chap ustundagi tafsilotlardan o'ngda) va sahifa boshida — mobil tartib desktop'ga ta'sir qilmagan
  expect(write.x).toBeGreaterThan(timeline.x + 250);
  expect(write.y).toBeLessThan(450);
});
