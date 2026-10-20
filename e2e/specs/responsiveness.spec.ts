import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { USERS, asGuest, asMode, formReady, loginAs, next, pickProfession, pickWholeRegion, sql } from "../support";

// E: e'lon berish va qidiruv — shu rejimda (rejim tanlanmasa, avval tasdiq so'raladi)
test.beforeEach(async ({ context }) => {
  await asMode(context, "worker");
});

/**
 * C7 · qotish va javobsiz qolishlar (qabul #26–#29). Har test o'lchovni e2e/.stack/responsiveness/<nom>.json ga yozadi
 * (docs/PERFORMANCE_BASELINE.md uchun "avval/keyin").
 */

const OUT = path.join(__dirname, "../.stack/responsiveness");
function record(name: string, data: unknown) {
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, `${name}.json`), JSON.stringify(data, null, 2));
}

async function throttle(page: Page, rate = 4) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate });
  return cdp;
}

/** View Transition'lar: boshlanish va tugash vaqti (shu oraliqda sahifa bosishni qabul qilmaydi) */
async function watchTransitions(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __vt: number[] };
    w.__vt = [];
    const orig = document.startViewTransition?.bind(document);
    if (!orig) return;
    document.startViewTransition = ((arg: Parameters<typeof orig>[0]) => {
      const t0 = performance.now();
      const vt = orig(arg);
      vt.finished.finally(() => w.__vt.push(Math.round(performance.now() - t0)));
      return vt;
    }) as typeof document.startViewTransition;
  });
}

test("navigatsiya: sahifa almashganda bosish bloklangan vaqt (View Transition)", async ({ page, context }) => {
  await asGuest(context);
  await watchTransitions(page);
  await throttle(page);
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  const lost: number[] = [];
  for (const [from, to] of [
    ["main a[href='/search?mode=jobs']", /mode=jobs/],
    ["header a[href='/']", (u: URL) => u.pathname === "/"],
  ] as const) {
    const t0 = Date.now();
    await page.locator(from).first().click();
    await page.waitForURL(to);
    // URL almashgan zahoti yangi sahifadagi birinchi havolaga bosishga urinish: qachon qabul qilinadi?
    const target = page.locator("main a[href], main button").first();
    await target.waitFor();
    const tClickable = Date.now();
    await target.click({ trial: true, timeout: 5000 });
    lost.push(Date.now() - tClickable);
    void t0;
  }
  const vt = await page.evaluate(() => (window as unknown as { __vt: number[] }).__vt);
  record("navigation", { viewTransitionsMs: vt, blockedAfterUrlChangeMs: lost });
  // maqsad: sahifa almashganda bosish 150 ms dan ortiq bloklanmasin (4× sekin CPU)
  expect(Math.max(0, ...vt)).toBeLessThanOrEqual(150);
});

test("natijalar ro'yxati: oxirgi karta qancha vaqtda to'liq ko'rinadi", async ({ page, context }) => {
  await asGuest(context);
  // ro'yxat to'lsin: bitta ish beruvchi uchun 6 ta e'lon
  await sql("delete from public.vacancies where owner_profile_id = $1", [USERS.employer]);
  const [n] = await sql<{ id: string; category_id: string }>("select id, category_id from public.profession_nodes where name_uz = 'Buxgalter' and selectable limit 1");
  const [r] = await sql<{ id: string }>("select id from public.regions where slug = 'tashkent_city'");
  for (let i = 0; i < 6; i++) {
    await sql(
      `insert into public.vacancies (owner_profile_id, title, region_id, description, status, profession_node_id, salary_negotiable, published_at, expires_at)
       values ($1, $2, $3, 'Sinov e''loni: kichik do''konga buxgalter kerak', 'active', $4, true, now(), now() + interval '10 days')`,
      [USERS.employer, `Buxgalter ${i + 1}`, r!.id, n!.id],
    );
  }
  await throttle(page);
  await page.goto(`/search?mode=jobs&p=${n!.id}&region=all`);
  const t = await page.evaluate(async () => {
    const items = Array.from(document.querySelectorAll("ul.pop-list > *, main ul > li"));
    const anims = items.flatMap((el) => el.getAnimations());
    // Ro'yxat ko'ringan paytdan (birinchi karta animatsiyasi boshlanishi) oxirgi karta to'liq ko'ringungacha —
    // animatsiya jadvali bo'yicha: eng kech tugash − eng erta boshlanish. Zinapoyali kechikish yoki uzun animatsiya
    // shu yerda ko'rinadi (sun'iy 600 ms'lik animatsiya — ~600 ms). Sahifa yuklangach birinchi kadrgacha bo'lgan
    // kutish (sekin CI'da gidratsiya) ro'yxat animatsiyasiga kirmaydi: u eski va yangi build'da bir xil (8× CPU'da
    // eng ko'pi 157/158 ms) va natijaga tasodifiy ±60 ms qo'shardi.
    await Promise.all(anims.map((a) => a.ready.catch(() => null)));
    const started = anims.filter((a) => a.startTime != null);
    if (!started.length) return { items: items.length, settleMs: 0 }; // animatsiya allaqachon tugagan
    const starts = started.map((a) => Number(a.startTime));
    const ends = started.map((a) => Number(a.startTime) + Number(a.effect?.getComputedTiming().endTime ?? 0));
    return { items: items.length, settleMs: Math.round(Math.max(...ends) - Math.min(...starts)) };
  });
  record("results", t);
  await sql("delete from public.vacancies where owner_profile_id = $1", [USERS.employer]);
  expect(t.items).toBeGreaterThanOrEqual(6);
  // maqsad: natijalar 200 ms ichida to'liq ko'rinsin
  expect(t.settleMs).toBeLessThanOrEqual(200);
});

test("kasb qidiruvi: so'rov kutilayotganda matn qisqartirilsa — aylanuvchi belgi qotib qolmaydi", async ({ page, context }) => {
  await sql("delete from public.worker_profiles where profile_id = $1", [USERS.workerB]); // bo'sh forma
  await loginAs(context, USERS.workerB);
  await page.route("**/api/professions/search**", async (route) => {
    await new Promise((r) => setTimeout(r, 1500));
    await route.continue();
  });
  await page.goto("/post/worker");
  await formReady(page);
  const input = page.getByLabel("Kasb yoki sohani qidiring");
  await input.fill("bux");
  await page.waitForTimeout(400); // 250 ms kechikishdan keyin so'rov jo'natildi, javob hali kelmagan
  await input.fill("b");
  await page.waitForTimeout(2500);
  const spinning = await page.locator("svg.animate-spin").count();
  record("picker-spinner", { spinnersAfter2_5s: spinning });
  expect(spinning).toBe(0);
});

test("e'lon joylash: internet uzilsa — tushunarli xato, tugma qayta ishlaydi, javoblar joyida", async ({ page, context }) => {
  await sql("delete from public.worker_profiles where profile_id = $1", [USERS.workerB]);
  await loginAs(context, USERS.workerB);
  await page.goto("/post/worker");
  await pickProfession(page, "Buxgalter", "Buxgalter");
  await next(page);
  await pickWholeRegion(page);
  await next(page);
  await page.locator("#about").fill("Buxgalteriya hisobi, soliq hisobotlari, 1C bilan 5 yil ishlaganman");
  await page.getByRole("radio", { name: "3 yildan ko'p" }).click();
  await next(page);
  // server action so'rovi tarmoqda uziladi
  await page.route("**/post/worker**", (route) => (route.request().method() === "POST" ? route.abort("internetdisconnected") : route.continue()));
  const publish = page.getByRole("button", { name: /E'lonni joylash/ });
  await publish.click();
  const err = page.getByRole("alert").filter({ hasText: /internet|aloqa|tarmoq/i });
  const errorPage = page.getByRole("heading", { name: "Nimadir xato ketdi" });
  await expect(err.or(errorPage)).toBeVisible({ timeout: 15_000 });
  const state = { inlineError: await err.count(), errorBoundary: await errorPage.count(), publishEnabled: await publish.isEnabled().catch(() => false) };
  record("publish-offline", state);
  expect(state).toEqual({ inlineError: 1, errorBoundary: 0, publishEnabled: true });
  // internet qaytdi — o'sha tugma bilan joylanadi
  await page.unroute("**/post/worker**");
  await publish.click();
  await expect(page.getByRole("heading", { level: 1, name: /joylandi|saqlandi/i })).toBeVisible({ timeout: 30_000 });
  const [c] = await sql<{ n: string }>("select count(*) as n from public.worker_profiles where profile_id = $1", [USERS.workerB]);
  expect(Number(c!.n)).toBe(1);
});

test("20 marta sahifa almashtirish: tinglovchi va DOM tugunlari to'xtovsiz o'smaydi", async ({ page, context }) => {
  await asGuest(context);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Performance.enable");
  const metric = async () => {
    await page.evaluate(() => new Promise((r) => setTimeout(r, 300)));
    await cdp.send("HeapProfiler.collectGarbage");
    const { metrics } = await cdp.send("Performance.getMetrics");
    const get = (n: string) => metrics.find((m) => m.name === n)?.value ?? 0;
    return { listeners: get("JSEventListeners"), nodes: get("Nodes") };
  };
  // bosh sahifa bo'limlari oqim bilan keladi (ro'yxat, kasblar, qo'shimcha) — o'lchov faqat to'liq chizilgan sahifada
  // (aks holda 1-o'lchov yarim sahifada olinib, keyingilar "o'sgan" ko'rinadi)
  const homeReady = async () => {
    await expect(page.locator("#home-feed")).toBeVisible();
    await expect(page.locator("main aside a[href^='/ai-alerts']")).toBeVisible();
    await expect(page.locator("main .skeleton-shimmer")).toHaveCount(0);
  };
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await homeReady();
  const samples: { round: number; listeners: number; nodes: number }[] = [];
  for (let i = 1; i <= 20; i++) {
    await page.locator("main a[data-track='direction_select'][href='/search?mode=jobs']").click();
    await page.waitForURL(/\/search/);
    await page.locator("header a[href='/']").first().click(); // logotip
    await page.waitForURL((u) => new URL(u).pathname === "/");
    if (i === 1 || i === 10 || i === 20) {
      await homeReady();
      samples.push({ round: i, ...(await metric()) });
    }
  }
  record("navigation-leaks", samples);
  const [a, b, c] = samples;
  // 1-dan 20-gacha: tinglovchilar 25% dan, DOM tugunlari 50% dan ortiq o'smasin
  expect(c!.listeners).toBeLessThanOrEqual(a!.listeners * 1.25);
  expect(c!.nodes).toBeLessThanOrEqual(a!.nodes * 1.5);
  // 10-dan 20-gacha deyarli o'zgarmaydi (to'xtovsiz o'sish yo'q)
  expect(c!.listeners).toBeLessThanOrEqual(b!.listeners * 1.1);
  expect(c!.nodes).toBeLessThanOrEqual(b!.nodes * 1.1);
});

/** Bosish/yozish kechikishi (INP qoidasi bo'yicha: faqat haqiqiy o'zaro ta'sirlar) — CPU 4× sekin */
async function watchInteractions(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __ev: { name: string; d: number }[] };
    w.__ev = [];
    new PerformanceObserver((l) =>
      l.getEntries().forEach((e) => {
        const ev = e as PerformanceEventTiming & { interactionId?: number };
        if (ev.interactionId) {
          const t = ev.target as HTMLElement | null;
          w.__ev.push({ name: ev.name, d: Math.round(ev.duration), on: t ? `${t.tagName}:${(t.textContent ?? "").trim().slice(0, 24)}` : "", proc: Math.round(ev.processingEnd - ev.processingStart) } as never);
        }
      }),
    ).observe({ type: "event", buffered: true, durationThreshold: 16 } as PerformanceObserverInit);
  });
}

test("bosish va yozish: vizual javob kechikishi (CPU 4×)", async ({ page, context }) => {
  await sql("delete from public.worker_profiles where profile_id = $1", [USERS.workerB]);
  await loginAs(context, USERS.workerB);
  await watchInteractions(page);
  await page.goto("/post/worker");
  await formReady(page);
  await throttle(page);
  const input = page.getByLabel("Kasb yoki sohani qidiring");
  await input.click();
  await input.pressSequentially("Buxgalter", { delay: 120 });
  await page.getByRole("button").filter({ hasText: "Tanlash" }).first().waitFor();
  await page.getByRole("button").filter({ hasText: "Tanlash" }).first().click();
  await page.getByRole("button", { name: /^Davom etish/ }).click();
  await page.getByRole("radio", { name: /^Butun (viloyat|shahar)/ }).or(page.getByRole("button", { name: /^Toshkent shahri/ })).first().waitFor();
  await page.waitForTimeout(500);
  const ev = await page.evaluate(() => (window as unknown as { __ev: { name: string; d: number }[] }).__ev);
  const keys = ev.filter((e) => /key|input|beforeinput/.test(e.name)).map((e) => e.d);
  const taps = ev.filter((e) => /pointer|click/.test(e.name)).map((e) => e.d);
  const result = { keyMaxMs: Math.max(0, ...keys), tapMaxMs: Math.max(0, ...taps), samples: ev.length, slowest: [...ev].sort((a, b) => b.d - a.d).slice(0, 4) };
  record("interaction-latency", result);
  // maqsad (lab, 4× sekin CPU): har bosish/harf 200 ms ichida keyingi kadrga chiqadi — raqam yoziladi (PERFORMANCE_BASELINE).
  // Test chegarasi 300 ms: CI mashinalari tezligi o'zgaruvchan; 500 ms+ dagi qotish (masalan, o'tish animatsiyasi) baribir ushlanadi.
  expect(result.keyMaxMs).toBeLessThanOrEqual(300);
  expect(result.tapMaxMs).toBeLessThanOrEqual(300);
});
