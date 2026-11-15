import { expect, test, type Page, type Route } from "@playwright/test";
import { USERS, asGuest, asMode, sql } from "../support";

/**
 * AI HR yordamchi — suhbat oynasi (/ai sahifasi va bosh sahifadagi oyna bitta komponent):
 *  - haqiqiy server (stendda AI kaliti yo'q — lug'at javobi): salomlashuv qidiruvsiz, so'rov → javob matni + bazadagi kartalar,
 *    tavsiya savollar bosiladi, foydalanuvchi tilida javob;
 *  - AI javobi (oqim) — server javobi almashtirilgan holda: uzun matn, nusxa olish, kontekst (oldingi savol-javob yuboriladi);
 *  - xatolar: limit (429) → "Qayta urinish"; javob o'rtasida uzilsa — yarim javob qoladi; javobni to'xtatish;
 *  - ovoz yo'q (ega, 2026-11-15: "kerak emas"): brauzer qo'llasa ham mikrofon va "O'qib berish" chiqmaydi.
 */

// Bir nechta testda server javobi almashtiriladi (page.route). Ilovaning service worker'i sahifani boshqaruvga olgach,
// Playwright so'rovni ushlamay qolishi mumkin (vaqtga bog'liq — to'liq to'plamda bir marta haqiqiy serverga o'tib ketdi),
// shuning uchun bu faylda service worker o'chirilgan. Suhbatning o'zi service worker'ga bog'liq emas (POST keshlanmaydi).
test.use({ serviceWorkers: "block" });

const DAILY = "Yuk tashuvchi (AI suhbat)";

const main = (page: Page) => page.getByRole("main");
const field = (page: Page) => main(page).getByLabel("Nima qidiryapsiz?");
const replies = (page: Page) => main(page).locator("[data-ai-reply]");

async function say(page: Page, text: string) {
  await field(page).fill(text);
  await main(page).getByRole("button", { name: "Topish", exact: true }).click();
}

const ndjson = (events: unknown[]) => events.map((e) => JSON.stringify(e)).join("\n") + "\n";
const fulfill = (route: Route, events: unknown[]) => route.fulfill({ status: 200, contentType: "application/x-ndjson; charset=utf-8", body: ndjson(events) });

async function open(page: Page, context: import("@playwright/test").BrowserContext) {
  await asGuest(context);
  await asMode(context, "worker");
  await page.goto("/ai");
  await expect(field(page)).toBeVisible();
  // skriptlar yuklangan (yozish maydoni ishlaydi)
  await expect(page.locator("form[data-state][data-hydrated]")).toHaveCount(1);
}

test.beforeEach(async () => {
  await sql("delete from public.vacancies where owner_profile_id = $1", [USERS.employer]);
  await sql(
    `insert into public.employer_profiles (profile_id, employer_type, display_name, onboarding_completed_at)
     values ($1, 'person', 'Dilnoza opa', now()) on conflict (profile_id) do nothing`,
    [USERS.employer],
  );
  await sql(
    `insert into public.vacancies (owner_profile_id, title, region_id, profession_node_id, description, status, salary_from, salary_type, published_at, expires_at)
     select $1, t.title, r.id, n.id, 'Sinov e''loni: ish vaqti 9 dan 18 gacha, tushlik bilan.', 'active', t.pay, t.kind::public.salary_type, now(), now() + interval '10 days'
     from public.regions r
     cross join (select id from public.profession_nodes where name_uz = 'Buxgalter' and selectable order by depth limit 1) n
     cross join (values ($2, 250000, 'daily'), ('Buxgalter (AI suhbat)', 6000000, 'monthly')) as t(title, pay, kind)
     where r.slug = 'tashkent_city'`,
    [USERS.employer, DAILY],
  );
});
test.afterAll(async () => {
  await sql("delete from public.vacancies where owner_profile_id = $1", [USERS.employer]);
});

test("suhbat: salomlashuv qidiruvsiz; tavsiya savoli bosiladi → javob matni va bazadagi kartalar; ruscha yozsa — ruscha", async ({ page, context }) => {
  await open(page, context);
  await say(page, "Salom");
  await expect(main(page).getByText("Siz: Salom")).toBeVisible();
  await expect(replies(page).last()).toContainText("Men Ish topdim yordamchisiman");
  await expect(main(page).locator("article")).toHaveCount(0);
  await expect(main(page).getByText(/^Tushundim:/)).toHaveCount(0);
  // AI ulanmagan: AI'siz bajariladigan narsalar taklif qilinadi — qidiruv misollari va bozor statistikasi (bazadan)
  const chips = main(page).locator("[data-ai-suggestions]").getByRole("button");
  await expect(chips).toHaveText(["Kunlik ish bormi?", "Tajribasiz ishlar", "Oshpaz maoshi qancha?"]);

  await chips.first().click();
  await expect(main(page).getByText("Siz: Kunlik ish bormi?")).toBeVisible();
  await expect(replies(page).last()).toContainText("1 ta");
  await expect(main(page).getByText(/^Tushundim:/).last()).toContainText("Kunlik ishlar");
  const cards = main(page).locator("article");
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toContainText(DAILY);
  // oldingi javobning tavsiyalari yo'qoladi; natija bor — toraytirish tugmalari
  await expect(main(page).locator("[data-ai-suggestions]")).toHaveCount(0);
  await expect(main(page).getByRole("button", { name: "Qo'shish: Tajribasiz" })).toBeVisible();

  await say(page, "ищу работу бухгалтером в Ташкенте");
  await expect(replies(page).last()).toContainText(/объявлен/);
  await expect(main(page).locator("article").first()).toBeVisible();

  // suhbat shu tabda saqlanadi: sahifa yangilansa javoblar joyida
  await page.reload();
  await expect(replies(page)).toHaveCount(3);
  await main(page).getByRole("button", { name: "Yangi suhbat" }).click();
  await expect(replies(page)).toHaveCount(0);
  // ish maydoni (2026-11): bo'sh suhbat — salomlashuv va "Bugungi ishlar"
  await expect(main(page).locator("[data-ai-welcome]")).toBeVisible();
});

test("AI javobi (oqim): uzun matn qatorlari bilan, nusxa olish, tavsiya; keyingi xabarda oldingi savol-javob kontekst sifatida yuboriladi", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await open(page, context);
  const cv = "Mana qisqa rezyume matni:\n\n1. Oshpaz, 3 yil tajriba — milliy taomlar.\n2. Katta oshxonada smena boshlig'i bo'lib ishlaganman.\n3. Sanitariya daftarchasi bor.\n\nIsh beruvchi ko'radigan e'longa shu matnni qo'ysangiz bo'ladi. Qaysi tumanda ishlashni xohlaysiz?";
  const bodies: Array<{ messages: Array<{ role: string; text: string }>; role: string }> = [];
  await page.route("**/api/assistant", async (route) => {
    bodies.push(route.request().postDataJSON());
    const second = bodies.length > 1;
    await fulfill(route, [
      { type: "status", stage: "thinking" },
      ...(second ? ["Chilonzor bo'yicha ", "qarab chiqdim."] : [cv.slice(0, 40), cv.slice(40, 150), cv.slice(150)]).map((delta) => ({ type: "text", delta })),
      { type: "suggestions", items: ["Suhbatga qanday tayyorlanay?"] },
      { type: "done", source: "ai", lang: "uz" },
    ]);
  });
  await say(page, "rezyume yozishga yordam bering, oshpazman");
  const reply = replies(page).last();
  await expect(reply).toHaveText(cv);
  // qatorlar saqlanadi (ro'yxat bir qatorga yopishib qolmaydi)
  expect(await reply.evaluate((el) => getComputedStyle(el).whiteSpace)).toBe("pre-wrap");
  await expect(main(page).getByText("Sun'iy intellekt tahlil qildi")).toBeVisible();
  await expect(main(page).getByText(/^Tushundim:/)).toHaveCount(0);
  await main(page).getByRole("button", { name: "Nusxa olish" }).click();
  await expect(main(page).getByRole("button", { name: "Nusxa olindi" })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(cv);
  await expect(main(page).locator("[data-ai-suggestions]").getByRole("button")).toHaveText(["Suhbatga qanday tayyorlanay?"]);
  // AI tuzib bergan matn bilan keyingi qadam: o'zi haqida e'lon berish
  await expect(main(page).locator("[data-ai-reply-actions]").getByRole("link", { name: "O'zim haqimda e'lon berish" })).toHaveAttribute("href", "/post/worker");

  await say(page, "Chilonzorda");
  await expect(replies(page).last()).toHaveText("Chilonzor bo'yicha qarab chiqdim.");
  expect(bodies[0]).toEqual({ messages: [{ role: "user", text: "rezyume yozishga yordam bering, oshpazman" }], role: "seeker" });
  expect(bodies[1]!.messages).toEqual([
    { role: "user", text: "rezyume yozishga yordam bering, oshpazman" },
    { role: "assistant", text: cv },
    { role: "user", text: "Chilonzorda" },
  ]);
});

test("xatolar: limit → tushunarli xabar va 'Qayta urinish'; javob o'rtasida uzilsa — kelgan qismi qoladi", async ({ page, context }) => {
  await open(page, context);
  let mode: "limit" | "cut" = "limit";
  await page.route("**/api/assistant", async (route) => {
    if (mode === "limit") return route.fulfill({ status: 429, contentType: "application/json", body: JSON.stringify({ error: "rate_limited" }) });
    return fulfill(route, [
      { type: "text", delta: "Hozir bazadan qarayman." },
      { type: "error", code: "timeout" },
    ]);
  });
  await say(page, "oshpaz kerak");
  await expect(main(page).getByRole("alert")).toContainText("So'rovlar soni vaqtincha cheklangan");
  mode = "cut";
  await main(page).getByRole("button", { name: "Qayta urinish" }).click();
  await expect(replies(page).last()).toHaveText("Hozir bazadan qarayman.");
  await expect(main(page).getByRole("alert")).toHaveText("Javob cho'zilib ketdi. Qayta urinib ko'ring.");
  // xatodan keyin ham yozish mumkin
  await page.unroute("**/api/assistant");
  await say(page, "Salom");
  await expect(replies(page).last()).toContainText("Ish topdim yordamchisiman");
});

test("javobni to'xtatish: kutish holati ko'rinadi, 'To'xtatish' bosilsa — suhbat davom etadi", async ({ page, context }) => {
  await open(page, context);
  let release: () => void = () => {};
  await page.route("**/api/assistant", async (route) => {
    await new Promise<void>((r) => (release = r));
    await route.abort().catch(() => undefined);
  });
  await say(page, "oshpaz kerak");
  await expect(main(page).getByRole("status")).toContainText("So'zlaringizni tushunmoqdaman");
  await expect(main(page).locator("form[data-state]")).toHaveAttribute("data-state", "processing");
  // javob kutilayotganda yuborish tugmasi o'rnida — to'xtatish
  await expect(main(page).getByRole("button", { name: "Topish" })).toHaveCount(0);
  await main(page).getByRole("button", { name: "Javobni to'xtatish" }).click();
  await expect(main(page).getByText("To'xtatildi").last()).toBeVisible();
  await expect(main(page).locator("form[data-state]")).toHaveAttribute("data-state", "idle");
  release();
  await page.unroute("**/api/assistant");
  await say(page, "Salom");
  await expect(replies(page).last()).toContainText("Ish topdim yordamchisiman");
});

test("ovoz yo'q: brauzer ovozni qo'llasa ham — mikrofon, «Ovoz bilan javob», «O'qib berish» ko'rinmaydi; hech narsa o'qib berilmaydi", async ({ page, context }) => {
  await context.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>;
    w.__spoken = [];
    w.SpeechSynthesisUtterance = class {
      text: string;
      constructor(text: string) {
        this.text = text;
      }
    };
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: {
        getVoices: () => [{ lang: "uz-UZ", name: "Madina" }],
        speak: (u: { text: string }) => (w.__spoken as unknown[]).push(u.text),
        cancel: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
      },
    });
    class FakeRecognition {
      start() {}
      stop() {}
      abort() {}
    }
    Object.assign(window, { SpeechRecognition: FakeRecognition, webkitSpeechRecognition: FakeRecognition });
  });
  await open(page, context);
  await expect(page.getByRole("switch")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Ovoz bilan|Gapirib/ })).toHaveCount(0);
  await say(page, "Salom");
  await expect(replies(page).last()).toContainText("Ish topdim yordamchisiman");
  await expect(main(page).getByRole("button", { name: "O'qib berish" })).toHaveCount(0);
  // menyuda ham ovoz tanlovi yo'q
  await page.locator("[data-ai-menu]").click();
  await expect(page.getByRole("menuitem", { name: /Ovoz/ })).toHaveCount(0);
  await page.keyboard.press("Escape");
  expect(await page.evaluate(() => (window as unknown as { __spoken: unknown[] }).__spoken)).toEqual([]);
});
