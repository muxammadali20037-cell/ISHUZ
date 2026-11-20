import { expect, test } from "@playwright/test";
import { USERS, asGuest, asMode, loginAs, sql } from "../support";

/**
 * R-C / 2026-10 redizayn · bosh sahifa: birinchi ekranda qidiruv va haqiqiy e'lonlar. Har bir yo'l aytgan joyini ochadi:
 * qidiruv qatori → natijalar; tez filtr (Kunlik, Talabalar uchun) va "Filtrlar" → natijalar; "Barcha kasblar" → kasb tanlash;
 * e'lon berish → forma.
 */
const PATHS = [
  // 3.0 (2026-11-13): "O'zim haqimda e'lon berish" bosh sahifada yo'q — pastki menyudagi "E'lon" (navigatsiya testi)
  // 2026-11-17 (ega): tez yo'llar — "Bo'limlar" qatorlarida (nomi + ostida izoh; shuning uchun nomning boshi bo'yicha)
  { mode: "worker", name: /^Kunlik ish /, url: /\/search\?mode=jobs&region=all&pay=daily$/, heading: /Kunlik ishlar/ },
  // 2026-11-17 (ega): "Tajribasiz ish" → "Tajriba talab qilinmaydigan ishlar"
  { mode: "worker", name: /^Tajriba talab qilinmaydigan ishlar /, url: /\/search\?mode=jobs&region=all&noexp=1&any=1$/, heading: /Ish e'lonlari/ },
  { mode: "worker", name: /^Filtrlar bilan qidirish$/, url: /\/search\?mode=jobs&region=all&any=1$/, heading: /Ish e'lonlari/ },
  // 2026-11-17: bitta katta tugma — yordamchi bilan joylash (avvalgi ikki tugma o'rnida)
  { mode: "employer", name: /^Vakansiya joylash$/, url: /\/post\/vacancy\?ai=1$/, heading: /Qanday xodim kerak/ },
  { mode: "employer", name: /^Tajribali/, url: /\/search\?mode=workers&region=all&exp=1&any=1$/, heading: /Ishchilar: Barcha kasblar/ },
] as const;

for (const p of PATHS) {
  test(`bosh sahifa (${p.mode}) → "${p.name.source}" kutilgan sahifani ochadi`, async ({ page, context }) => {
    await asGuest(context);
    await asMode(context, p.mode);
    await page.goto("/");
    // ro'yxat bo'sh bo'lsa (toza baza) "O'zim haqimda e'lon berish" bo'sh holatda ham turadi — birinchi ko'rinadiganini bosamiz
    const link = page.getByRole("main").getByRole("link", { name: p.name }).first();
    await expect(link).toBeVisible();
    await link.click();
    await page.waitForURL(p.url);
    await expect(page.getByRole("heading", { level: 1 }).or(page.getByRole("heading", { level: 2 })).first()).toContainText(p.heading);
  });
}

test("bosh sahifa: qidiruv qatori → kompaniya nomi bo'yicha natija (matn kasbga aylanmasa ham)", async ({ page, context }) => {
  await sql("delete from public.vacancies where owner_profile_id = $1", [USERS.employer]);
  const [co] = await sql<{ id: string }>(
    `insert into public.companies (name, slug, verification_status) values ('Sarbon Savdo', 'sarbon-savdo-e2e', 'verified')
     on conflict (slug) do update set name = excluded.name returning id`,
  );
  await sql(
    `insert into public.vacancies (owner_profile_id, company_id, title, region_id, description, status, salary_from, salary_type, experience_min_months, published_at, expires_at)
     select $1, $2, 'Kassir', r.id, 'Do''konga kassir kerak, 9 dan 18 gacha', 'active', 4000000, 'monthly', 0, now(), now() + interval '10 days'
     from public.regions r where r.slug = 'tashkent_city'`,
    [USERS.employer, co!.id],
  );
  try {
    await asGuest(context);
    await page.goto("/");
    await page.getByRole("searchbox", { name: "Kasb yoki lavozim" }).fill("Sarbon");
    await page.getByRole("search", { name: "Ish qidirish" }).getByRole("button", { name: "Qidirish", exact: true }).click();
    await page.waitForURL(/\/search\?mode=jobs&q=Sarbon/);
    const card = page.locator("main article").filter({ hasText: "Kassir" });
    await expect(card).toHaveCount(1);
    // kompaniya va haqiqiy "tasdiqlangan" belgisi; maosh davri bilan
    await expect(card.getByText("Sarbon Savdo")).toBeVisible();
    await expect(card.getByRole("img", { name: "Tasdiqlangan kompaniya" })).toBeVisible();
    await expect(card).toContainText("so'm/oy");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("«Sarbon»");
  } finally {
    await sql("delete from public.vacancies where owner_profile_id = $1", [USERS.employer]);
    await sql("delete from public.companies where slug = 'sarbon-savdo-e2e'");
  }
});

test("bosh sahifa (2.0): bitta h1 va bitta qidiruv maydoni birinchi ekranda; tez yo'llar — bo'limlarda; fon surati, nol raqamlar va plitkalar yo'q", async ({ page, context }) => {
  await asGuest(context);
  await asMode(context, "worker");
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Qanday ish qidiryapsiz?");
  // bitta qidiruv: yozilgan matn yordamchiga ketadi. 5.0 (2026-11-16, "ko'k-oq"): hero blokida (telefon va kompyuterda bir
  // xil); sarlavhada qidiruv yo'q (2026-11-15 dagi sarlavhadagi qidiruv o'rniga)
  const search = page.getByRole("search", { name: "O'zingizga mos ishni qidiring..." });
  await expect(search).toHaveCount(1);
  await expect(page.locator("header").getByRole("searchbox")).toHaveCount(0);
  await expect(page.locator("[data-home='seeker-v2']").getByRole("searchbox")).toBeVisible();
  const box = (await search.boundingBox())!;
  expect(box.y + box.height).toBeLessThan(560);
  // qidiruv ostida "+ E'lon joylash" — ingichka (44–48 px), och ko'k (ega, 2026-11-17: "juda katta bo'lib ketgan")
  const post = page.locator("[data-home='seeker-v2'] [data-home-post]");
  await expect(post).toHaveText("E'lon joylash");
  // bosilsa — yordamchi (e'lon joylash rejimi)
  await expect(post).toHaveAttribute("href", "/ai/post");
  const postH = (await post.boundingBox())!.height;
  expect(postH).toBeGreaterThanOrEqual(44);
  expect(postH).toBeLessThanOrEqual(48);
  // sarlavha orqasidagi ko'k nur va salomlashuvdagi 👋 yo'q
  expect(await page.locator("[data-home='seeker-v2']").evaluate((el) => getComputedStyle(el).backgroundImage)).toBe("none");
  await expect(page.locator("[data-home='seeker-v2']")).not.toContainText("👋");
  // qidiruv tugmasi — "Izlash" (ega, 2026-11-17; avval "Topish")
  await expect(search.getByRole("button", { name: "Izlash" })).toBeVisible();
  // tez yo'llar plitkalari yo'q (2026-11-17, ega) — ular "Bo'limlar" ro'yxatida, bitta ustunda; mehmon ham ko'radi
  // (shaxsiy bo'limlarsiz: arizalar, xabarlar, profil — kirgandan keyin)
  await expect(page.getByRole("navigation", { name: "Tez qidiruv" })).toHaveCount(0);
  const menu = page.locator("[data-home-menu]");
  await expect(menu).toBeVisible();
  expect(await menu.locator("[data-menu-item]").evaluateAll((els) => els.map((e) => e.getAttribute("data-menu-item")))).toEqual([
    "masters", "ai", "daily", "remote", "noexp", "near",
  ]);
  await expect(menu.locator('[data-menu-item="daily"]')).toHaveAttribute("href", /pay=daily/);
  await expect(menu.locator("[data-role-switch]")).toHaveCount(0);
  // olib tashlanganlar: fon surati, "Faol vakansiyalar 0" kabi raqamlar, 8 ta plitka, ko'p bo'limli yon panel
  await expect(page.locator("main .hero-surface")).toHaveCount(0);
  await expect(page.locator("[data-home='seeker-v2'] img")).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Xizmatlar" })).toHaveCount(0);
  await expect(page.getByText("Faol vakansiyalar")).toHaveCount(0);
  await expect(page.locator("#home-feed")).toBeVisible();
});

// 2026-11-20 (ega: "kirgandan keyin chatga kirsin"): kirgan foydalanuvchining "/" sahifasi — asosiy ekran (/chat);
// avvalgi kirgan bosh sahifa (qidiruv, "E'lonlarim", "Yangi ishlar", "Bo'limlar") endi ochilmaydi — uning ikki testi o'rniga
// simple-app.spec.ts ("kirgan foydalanuvchi: «/» → chat") tekshiradi. Mehmon bosh sahifasi testlari — shu faylda.

test("navigatsiya: mehmonda brend nomi va 'Kirish' ko'rinadi; faol bo'lim belgilanadi", async ({ page, context }) => {
  await asGuest(context);
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("/");
  await expect(page.getByRole("banner").getByText("topdim")).toBeVisible();
  await expect(page.getByRole("banner").getByRole("link", { name: "Kirish" })).toBeVisible();
  // 2026-11-20 (ega): hamma uchun bir xil 5 ta bo'lim — Ishchilar · Ishlar · Izlash/E'lon · E'lonlarim · Profil
  const nav = page.getByRole("navigation", { name: "Asosiy bo'limlar" }).last();
  const TABS = ["Ishchilar", "Ishlar", "Izlash/E'lon", "E'lonlarim", "Profil"];
  await expect(nav.getByRole("link")).toHaveText(TABS);
  // mehmon bosh sahifasi bo'limlardan biri emas — hech biri belgilanmagan
  await expect(nav.locator("a[aria-current='page']")).toHaveCount(0);
  await nav.getByRole("link", { name: "Ishlar" }).click();
  await page.waitForURL(/\/jobs$/);
  await expect(nav.getByRole("link", { name: "Ishlar" })).toHaveAttribute("aria-current", "page");
  await expect(nav.locator("a[aria-current='page']")).toHaveCount(1);
  // 360 px da yozuvlar sig'adi (kesilmaydi)
  for (const name of TABS) {
    const label = nav.getByRole("link", { name }).locator("span").first();
    expect(await label.evaluate((el) => el.scrollWidth <= el.clientWidth + 1), name).toBe(true);
  }
});

test("navigatsiya: kirgan foydalanuvchida 360 px da sarlavha sig'adi (gorizontal siljish yo'q)", async ({ page, context }) => {
  await loginAs(context, USERS.workerA);
  for (const width of [360, 390]) {
    await page.setViewportSize({ width, height: 780 });
    await page.goto("/");
    await page.waitForURL(/\/chat$/);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `${width}px`).toBeLessThanOrEqual(0);
    // 2026-11-20: xabarlar — sarlavhada (pastki menyuda 5 ta asosiy bo'lim, "Xabarlar" yo'q)
    await expect(page.getByRole("banner").getByRole("link", { name: "Xabarlar" })).toBeVisible();
    await expect(page.locator("nav.bottom-nav").getByRole("link", { name: "Xabarlar" })).toHaveCount(0);
    await expect(page.getByRole("banner").getByRole("link", { name: "Bildirishnomalar" })).toBeVisible();
  }
});

test("bosh sahifa kartalari: 360–1440 px da matn karta chetidan chiqmaydi (ikkala rejimda va rejim tanlanmaganda)", async ({ page, context }) => {
  await asGuest(context);
  const bad: string[] = [];
  const modes: ("worker" | "employer" | null)[] = [null, "worker", "employer"];
  for (const [mode, width] of modes.flatMap((m) => [360, 768, 1024, 1440].map((w) => [m, w] as const))) {
    await asGuest(context);
    if (mode) await asMode(context, mode);
    else await context.clearCookies({ name: "ib_mode" });
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const over = await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLElement>("main ul > li > a, main ul > li > section, main ul > li a, main section button"))
        .filter((el) => el.scrollWidth > el.clientWidth + 1)
        .map((el) => `${(el.textContent ?? "").trim().slice(0, 30)} (+${el.scrollWidth - el.clientWidth}px)`),
    );
    bad.push(...over.map((o) => `${mode ?? "rejimsiz"} ${width}px: ${o}`));
  }
  expect(bad).toEqual([]);
});

test("bosh qism (ega, 2026-11-17): sarlavha telefonda bitta qatorda; tashqi karta yo'q («oyna ustida oyna» emas)", async ({ page, context }) => {
  await asGuest(context);
  for (const [mode, sel, text] of [["worker", "seeker-v2", "Qanday ish qidiryapsiz?"], ["employer", "employer-v2", "Qanday xodim kerak?"]] as const) {
    await asMode(context, mode);
    for (const width of [320, 360, 390, 412]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/");
      const h1 = page.locator(`[data-home='${sel}'] h1`);
      await expect(h1).toHaveText(text);
      // bitta qator: balandlik ≈ bitta qator balandligi
      const [h, lh] = await h1.evaluate((el) => [el.getBoundingClientRect().height, parseFloat(getComputedStyle(el).lineHeight)]);
      expect(h, `${mode} ${width}px`).toBeLessThan(lh * 1.5);
      expect(await h1.evaluate((el) => el.scrollWidth <= el.clientWidth + 1), `${mode} ${width}px`).toBe(true);
      // tashqi oq karta yo'q: chegara, fon va soya yo'q
      const box = await page.locator(`[data-home='${sel}']`).evaluate((el) => {
        const cs = getComputedStyle(el);
        return { border: cs.borderTopWidth, bg: cs.backgroundColor, shadow: cs.boxShadow };
      });
      expect(box, `${mode} ${width}px`).toEqual({ border: "0px", bg: "rgba(0, 0, 0, 0)", shadow: "none" });
    }
  }
});

test("Telegram kanal qatori: bosh sahifada obuna havolasi (SOCIAL_TELEGRAM_URL)", async ({ page, context }) => {
  await asMode(context, "worker");
  await page.goto("/");
  const row = page.locator("[data-home-menu] [data-channel-row]");
  await expect(row).toBeVisible();
  await expect(row).toHaveAttribute("href", "https://t.me/ish_topdim_uz");
  await expect(row).toHaveAttribute("target", "_blank");
  await expect(row).toContainText("Telegram kanalimizga obuna bo'ling");
  await expect(row).toContainText("Har kuni yangi ishlar — @ish_topdim_uz");
});
