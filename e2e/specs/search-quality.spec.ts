import { expect, test, type Page } from "@playwright/test";
import { USERS, asGuest, asMode, homeSearch, sql } from "../support";

/**
 * Qidiruv sifati (ega, 2026-11-22: "foydalanuvchi «ish kerak», «voditel», «oshpaz», «работа» deb yozsa ham mazmunan mos
 * natijalarni topishi kerak"; "mavjud bo'lmagan ish o'rinlari ko'rsatilmasin"):
 *  - umumiy so'rov ("ish kerak", "работа") — "Kasbingiz qanday?" savolida birinchi tugma "Hamma ishlar" (yoki "любая" deb
 *    yozish) → hamma ishlar;
 *  - ruscha/translit/kirill kasb nomi ("voditel") — aniq kasb;
 *  - butun soha so'zi ("kuryer") — sohaning hamma vakansiyalari (piyoda, posilka, oziq-ovqat kuryerlari alohida kasblar);
 *  - hech narsa yo'q — "Hozir shu kasblarda ish bor" (haqiqiy, sanalgan e'lonlar) va bitta bosishda o'sha qidiruv.
 * Ma'lumot — shu test e'lonlari (sarlavhada TAG); boshqa e'lonlarga tayanmaydi.
 */
test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

const TAG = "SQ1";
const box = (page: Page) => page.locator("form[data-hydrated] #start-chat-text");
const lastAi = (page: Page) => page.locator("[data-guided-ai]").last();
async function settled(page: Page) {
  await expect(page.locator("[data-guided-ai='thinking'], [data-guided-ai='searching']")).toHaveCount(0, { timeout: 20_000 });
}
async function send(page: Page, text: string) {
  await box(page).fill(text);
  await box(page).press("Enter");
  await settled(page);
}
/** bosh ekrandagi qidiruv qatoridan — hudud: "Butun O'zbekiston" (2026-11-23, C varianti) */
async function search(page: Page, text: string) {
  await homeSearch(page, text);
  await settled(page);
}
/** savol-javobdan keyin (hudud qatorda tanlangan) — "Mavjud e'lonlarni ko'rish" */
async function see(page: Page) {
  await expect(lastAi(page)).toHaveAttribute("data-guided-ai", "next");
  await expect(lastAi(page).locator("[data-guided-summary]")).toContainText("Butun O'zbekiston");
  await box(page).blur();
  await lastAi(page).locator("[data-guided-next-to='see']").click();
  await settled(page);
}

const VACANCIES: [title: string, node: string][] = [
  [`Oshpaz yordamchisi (${TAG})`, "Oshpaz"],
  [`Haydovchi, B toifa (${TAG})`, "Haydovchi"],
  [`Posilka kuryeri (${TAG})`, "Posilka yetkazib beruvchi kuryer"],
  [`Oziq-ovqat kuryeri (${TAG})`, "Oziq-ovqat mahsulotlari kuryeri"],
];

test.beforeEach(async () => {
  // boshqa testlarning e'lonlari natijani chalkashtirmasin: shu ish beruvchining e'lonlari — faqat bizniki
  await sql("delete from public.vacancies where owner_profile_id = $1", [USERS.employer]);
  for (const [title, node] of VACANCIES) {
    await sql(
      `insert into public.vacancies (owner_profile_id, title, region_id, category_id, description, status, profession_node_id, salary_from, salary_type, published_at, expires_at)
       select $1, $2, r.id, n.category_id, 'Sinov e''loni: ' || $2, 'active', n.id, 5000000, 'monthly', now(), now() + interval '10 days'
       from public.regions r, lateral (select id, category_id from public.profession_nodes where name_uz = $3 and selectable order by depth limit 1) n
       where r.slug = 'tashkent_city'`,
      [USERS.employer, title, node],
    );
  }
});
test.afterEach(async () => {
  await sql("delete from public.vacancies where owner_profile_id = $1", [USERS.employer]);
});

test("«ish kerak» — «Kasbingiz qanday?» da birinchi «Hamma ishlar» → hamma ishlar", async ({ page, context }) => {
  await asGuest(context);
  await page.goto("/");
  await search(page, "ish kerak");
  await expect(lastAi(page)).toHaveAttribute("data-guided-ai", "ask-profession");
  const any = lastAi(page).locator("[data-guided-prof='any']");
  await expect(lastAi(page).locator("[data-guided-prof]").first()).toHaveAttribute("data-guided-prof", "any");
  await expect(any).toHaveText("Hamma ishlar");
  await any.click();
  await settled(page);
  await see(page);
  await expect(lastAi(page)).toHaveAttribute("data-guided-ai", "results");
  await expect(lastAi(page).locator("[data-guided-summary]")).toContainText("Butun O'zbekiston");
  await expect(lastAi(page)).toContainText(TAG);
});

test("«работа» — savolga «любая» deb yozsa ham hamma ishlar", async ({ page, context }) => {
  await asGuest(context);
  await page.goto("/");
  await search(page, "работа");
  await expect(lastAi(page)).toHaveAttribute("data-guided-ai", "ask-profession");
  await send(page, "любая");
  await see(page);
  await expect(lastAi(page)).toHaveAttribute("data-guided-ai", "results");
  await expect(lastAi(page)).toContainText(TAG);
});

test("«voditel» (ruscha, lotinda) — Haydovchi", async ({ page, context }) => {
  await asGuest(context);
  await asMode(context, "worker");
  await page.goto("/chat");
  // kasb va hudud (qatorda) ma'lum — savolsiz natija
  await search(page, "voditel");
  await expect(lastAi(page)).toHaveAttribute("data-guided-ai", "results");
  await expect(lastAi(page).locator("[data-guided-summary]")).toContainText("Haydovchi");
  await expect(lastAi(page)).toContainText(`Haydovchi, B toifa (${TAG})`);
  await expect(lastAi(page)).not.toContainText("Oshpaz yordamchisi");
});

test("«kuryer» — butun soha: posilka va oziq-ovqat kuryerlari ikkalasi ham (alohida kasblar)", async ({ page, context }) => {
  await asGuest(context);
  await asMode(context, "worker");
  await page.goto("/chat");
  await search(page, "kuryer");
  const res = lastAi(page);
  await expect(res).toHaveAttribute("data-guided-ai", "results");
  await expect(res.locator("[data-guided-summary]")).toContainText("Kuryer va yetkazib berish");
  await expect(res).toContainText(`Posilka kuryeri (${TAG})`);
  await expect(res).toContainText(`Oziq-ovqat kuryeri (${TAG})`);
  await expect(res).not.toContainText("Haydovchi, B toifa");
});

test("hech narsa yo'q — haqiqiy e'loni bor kasblar taklif qilinadi (soni bilan) va bitta bosishda qidiriladi", async ({ page, context }) => {
  await asGuest(context);
  await asMode(context, "worker");
  await page.goto("/chat");
  await search(page, "Toshkentda kosmonavt ishi kerak");
  // tushunilmagan kasb — bir marta aniqlashtiriladi; o'sha so'z bilan qidiriladi
  await expect(lastAi(page)).toHaveAttribute("data-guided-ai", "ask-profession");
  await send(page, "kosmonavt");
  if ((await lastAi(page).getAttribute("data-guided-ai")) === "next") {
    await lastAi(page).locator("[data-guided-next-to='see']").click();
    await settled(page);
  }
  await expect(lastAi(page)).toHaveAttribute("data-guided-ai", "none");
  const sug = lastAi(page).locator("[data-guided-suggested]");
  await expect(sug).toContainText("Hozir shu kasblarda ish bor:");
  const oshpaz = sug.locator("[data-guided-suggest]").filter({ hasText: "Oshpaz" });
  await expect(oshpaz).toHaveCount(1);
  // soni — haqiqiy (shu testda bitta oshpaz e'loni; boshqa testlarniki qo'shilishi mumkin — kamida 1)
  expect(Number(await oshpaz.locator("span").last().innerText())).toBeGreaterThanOrEqual(1);
  await oshpaz.click();
  await settled(page);
  await expect(lastAi(page)).toHaveAttribute("data-guided-ai", "results");
  await expect(lastAi(page)).toContainText(`Oshpaz yordamchisi (${TAG})`);
});
