import { expect, test, type Page, type Route } from "@playwright/test";
import { USERS, asGuest, asMode, sql } from "../support";

/**
 * AI HR yordamchi — suhbat oynasi (/ai sahifasi va bosh sahifadagi oyna bitta komponent):
 *  - haqiqiy server (stendda AI kaliti yo'q — lug'at javobi): salomlashuv qidiruvsiz, so'rov → javob matni + bazadagi kartalar,
 *    tavsiya savollar bosiladi, foydalanuvchi tilida javob;
 *  - AI javobi (oqim) — server javobi almashtirilgan holda: uzun matn, nusxa olish, kontekst (oldingi savol-javob yuboriladi);
 *  - xatolar: limit (429) → "Qayta urinish"; javob o'rtasida uzilsa — yarim javob qoladi; javobni to'xtatish;
 *  - ovoz: mikrofon holatlari, ruxsat berilmagani, javobni o'qib berish va to'xtatish, qurilmada ovoz yo'qligi.
 */

const DAILY = "Yuk tashuvchi (AI suhbat)";

const main = (page: Page) => page.getByRole("main");
const field = (page: Page) => main(page).getByLabel("Nima qidiryapsiz?");
const replies = (page: Page) => main(page).locator("[data-ai-reply]");

async function say(page: Page, text: string) {
  await field(page).fill(text);
  await main(page).getByRole("button", { name: "Topish" }).click();
}

const ndjson = (events: unknown[]) => events.map((e) => JSON.stringify(e)).join("\n") + "\n";
const fulfill = (route: Route, events: unknown[]) => route.fulfill({ status: 200, contentType: "application/x-ndjson; charset=utf-8", body: ndjson(events) });

async function open(page: Page, context: import("@playwright/test").BrowserContext) {
  await asGuest(context);
  await asMode(context, "worker");
  await page.goto("/ai");
  await expect(field(page)).toBeVisible();
  // skriptlar yuklangan: "Ovoz bilan javob" kaliti faqat brauzerda paydo bo'ladi
  await expect(main(page).getByRole("switch", { name: "Ovoz bilan javob" })).toBeVisible();
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
  await expect(replies(page).last()).toContainText("Men Ish topdim AI yordamchisiman");
  await expect(main(page).locator("article")).toHaveCount(0);
  await expect(main(page).getByText(/^Tushundim:/)).toHaveCount(0);
  // AI ulanmagan: faqat qidiruv misollari taklif qilinadi (bajarib bo'lmaydigan "rezyume yozib ber" yo'q)
  const chips = main(page).locator("[data-ai-suggestions]").getByRole("button");
  await expect(chips).toHaveText(["Kunlik ish bormi?", "Tajribasiz ishlar", "Uydan ishlash"]);

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
  await expect(main(page).getByText(/Men AI yordamchiman/)).toBeVisible();
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
  await expect(replies(page).last()).toContainText("AI yordamchisiman");
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
  await expect(main(page).locator("form[data-voice]")).toHaveAttribute("data-voice", "processing");
  // javob kutilayotganda yuborish tugmasi o'rnida — to'xtatish
  await expect(main(page).getByRole("button", { name: "Topish" })).toHaveCount(0);
  await main(page).getByRole("button", { name: "Javobni to'xtatish" }).click();
  await expect(main(page).getByText("To'xtatildi")).toBeVisible();
  await expect(main(page).locator("form[data-voice]")).toHaveAttribute("data-voice", "idle");
  release();
  await page.unroute("**/api/assistant");
  await say(page, "Salom");
  await expect(replies(page).last()).toContainText("AI yordamchisiman");
});

test("ovozli javob: yoqilsa javob o'qib beriladi (tilga mos ovoz), to'xtatiladi; qurilmada ovoz bo'lmasa — aytiladi; tanlov eslab qolinadi", async ({ page, context }) => {
  await context.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>;
    w.__spoken = [];
    w.__cancelled = 0;
    w.__voices = [
      { lang: "uz-UZ", name: "Madina" },
      { lang: "ru-RU", name: "Svetlana" },
    ];
    w.SpeechSynthesisUtterance = class {
      text: string;
      lang = "";
      voice: unknown = null;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(text: string) {
        this.text = text;
      }
    };
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: {
        getVoices: () => w.__voices,
        speak: (u: { text: string; lang: string }) => (w.__spoken as unknown[]).push({ text: u.text, lang: u.lang }),
        cancel: () => void (w.__cancelled = (w.__cancelled as number) + 1),
        addEventListener: () => {},
        removeEventListener: () => {},
      },
    });
  });
  const spoken = () => page.evaluate(() => (window as unknown as { __spoken: Array<{ text: string; lang: string }> }).__spoken);
  await open(page, context);
  const toggle = main(page).getByRole("switch", { name: "Ovoz bilan javob" });
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  // o'chiq: javob o'qilmaydi
  await say(page, "Salom");
  await expect(replies(page).last()).toContainText("AI yordamchisiman");
  expect(await spoken()).toEqual([]);

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await say(page, "Rahmat");
  await expect.poll(async () => (await spoken()).length).toBe(1);
  expect((await spoken())[0]).toMatchObject({ lang: "uz-UZ", text: expect.stringMatching(/^(Arzimaydi|Marhamat)/) });
  await expect(main(page).getByText("Javobni o'qib beryapman…")).toBeVisible();
  await expect(main(page).locator("form[data-voice]")).toHaveAttribute("data-voice", "speaking");
  await main(page).getByRole("button", { name: "Ovozni to'xtatish" }).click();
  await expect(main(page).getByText("Javobni o'qib beryapman…")).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { __cancelled: number }).__cancelled)).toBeGreaterThan(0);

  // ruscha javob — ruscha ovoz bilan; har bir javobni qo'lda ham tinglash mumkin
  await say(page, "спасибо");
  await expect.poll(async () => (await spoken()).length).toBe(2);
  expect((await spoken())[1]!.lang).toBe("ru-RU");
  await main(page).getByRole("button", { name: "O'qib berish" }).click();
  await expect.poll(async () => (await spoken()).length).toBe(3);

  // qurilmada shu til uchun ovoz yo'q — boshqa til ovozi bilan buzib o'qilmaydi, foydalanuvchiga aytiladi
  await page.evaluate(() => ((window as unknown as { __voices: unknown[] }).__voices = [{ lang: "en-US", name: "English" }]));
  await say(page, "Salom");
  await expect(main(page).getByText("Bu qurilmada shu til uchun ovoz yo'q — javob matnda")).toBeVisible();
  expect(await spoken()).toHaveLength(3);

  await page.reload();
  await expect(main(page).getByRole("switch", { name: "Ovoz bilan javob" })).toHaveAttribute("aria-checked", "true");
});

test("mikrofon: tinglash holati aniq ko'rinadi va to'xtatiladi; ruxsat berilmasa — tushunarli xabar, matn bilan yozish ishlaydi", async ({ page, context }) => {
  await context.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>;
    w.__micMode = "listen";
    class FakeRecognition {
      lang = "";
      interimResults = false;
      continuous = false;
      maxAlternatives = 1;
      onresult: ((e: unknown) => void) | null = null;
      onerror: ((e: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      start() {
        if (w.__micMode === "denied") {
          setTimeout(() => {
            this.onerror?.({ error: "not-allowed" });
            this.onend?.();
          }, 30);
          return;
        }
        // gapirilayotgan matn jonli ko'rinadi (hali yakuniy emas)
        setTimeout(() => this.onresult?.({ resultIndex: 0, results: { length: 1, 0: Object.assign([{ transcript: "kunlik" }], { isFinal: false }) } }), 30);
      }
      stop() {
        this.onresult?.({ resultIndex: 0, results: { length: 1, 0: Object.assign([{ transcript: "kunlik ish bormi" }], { isFinal: true }) } });
        this.onend?.();
      }
      abort() {}
    }
    Object.assign(window, { SpeechRecognition: FakeRecognition, webkitSpeechRecognition: FakeRecognition });
  });
  await open(page, context);
  const form = main(page).locator("form[data-voice]");
  await main(page).getByRole("button", { name: "Ovoz bilan aytish" }).click();
  await expect(form).toHaveAttribute("data-voice", "listening");
  await expect(main(page).getByText("Gapiring — eshityapman… Ovoz saqlanmaydi.")).toBeVisible();
  await expect(field(page)).toHaveValue("kunlik");
  const stop = main(page).getByRole("button", { name: "To'xtatish", exact: true });
  await expect(stop).toHaveAttribute("aria-pressed", "true");
  await stop.click();
  await expect(form).toHaveAttribute("data-voice", "idle");
  await expect(field(page)).toHaveValue("kunlik ish bormi");
  // o'zi yuborilmaydi — foydalanuvchi yuboradi
  await expect(replies(page)).toHaveCount(0);
  await main(page).getByRole("button", { name: "Topish" }).click();
  await expect(main(page).getByText("Siz: kunlik ish bormi")).toBeVisible();
  await expect(main(page).locator("article")).toHaveCount(1);

  await page.evaluate(() => ((window as unknown as { __micMode: string }).__micMode = "denied"));
  await main(page).getByRole("button", { name: "Ovoz bilan aytish" }).click();
  await expect(main(page).getByText("Mikrofonga ruxsat yo'q. Brauzer sozlamalarida ruxsat bering yoki yozib yuboring.")).toBeVisible();
  await expect(form).toHaveAttribute("data-voice", "error");
  await say(page, "Salom");
  await expect(replies(page).last()).toContainText("AI yordamchisiman");
});
