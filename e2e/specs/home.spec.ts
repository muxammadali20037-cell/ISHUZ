import { expect, test } from "@playwright/test";
import { USERS, asGuest, asMode, loginAs, sql } from "../support";

/**
 * Bosh sahifa va navigatsiya. 2026-11-21 (ega: "kirgan zahoti chat"): bosh sahifa — chat (guided-chat.spec.ts); reklama
 * sahifasidagi qidiruv qatori va "Bo'limlar" tez yo'llari olib tashlandi — ularning testlari ham. Telegram kanal — kirgandan keyin
 * chiqadigan oynada (channel-prompt.spec).
 */

test("qidiruv sahifasi: qidiruv qatori → kompaniya nomi bo'yicha natija (matn kasbga aylanmasa ham)", async ({ page, context }) => {
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
    // 2026-11-21: bosh sahifa — chat; matnli qidiruv natijasi sahifasi o'z joyida
    await page.goto("/search?mode=jobs&q=Sarbon");
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

// 2026-11-20 (ega: "kirgandan keyin chatga kirsin"): kirgan foydalanuvchining "/" sahifasi — asosiy ekran (/chat);
// avvalgi kirgan bosh sahifa (qidiruv, "E'lonlarim", "Yangi ishlar", "Bo'limlar") endi ochilmaydi — uning ikki testi o'rniga
// simple-app.spec.ts ("kirgan foydalanuvchi: «/» → chat") tekshiradi. Mehmon bosh sahifasi testlari — shu faylda.

test("navigatsiya: mehmonda brend nomi va 'Kirish' ko'rinadi; faol bo'lim belgilanadi", async ({ page, context }) => {
  await asGuest(context);
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("/");
  await expect(page.getByRole("banner").getByText("topdim")).toBeVisible();
  await expect(page.getByRole("banner").getByRole("link", { name: "Kirish" })).toBeVisible();
  // 2026-11-21 (ega, master prompt): hamma uchun bir xil 3 ta bo'lim — Qidiruv · E'lonlarim · Profil
  const nav = page.getByRole("navigation", { name: "Asosiy bo'limlar" }).last();
  const TABS = ["Qidiruv", "E'lonlarim", "Profil"];
  await expect(nav.getByRole("link")).toHaveText(TABS);
  // bosh sahifa — chat, ya'ni "Qidiruv" bo'limi
  await expect(nav.locator("a[aria-current='page']")).toHaveCount(1);
  await expect(nav.getByRole("link", { name: "Qidiruv" })).toHaveAttribute("aria-current", "page");
  await nav.getByRole("link", { name: "Profil" }).click();
  await page.waitForURL(/\/cabinet$/);
  await expect(nav.getByRole("link", { name: "Profil" })).toHaveAttribute("aria-current", "page");
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

test("bosh ekran (ega, 2026-11-23 — C varianti): sarlavha, qidiruv qatori, uchta tugma, tezkor bo'limlar; 320–1280 px da sig'adi", async ({ page, context }) => {
  await asGuest(context);
  for (const mode of [null, "worker", "employer"] as const) {
    if (mode) await asMode(context, mode);
    else await context.clearCookies({ name: "ib_mode" });
    for (const width of [320, 360, 390, 412, 1280]) {
      const at = `${mode} ${width}px`;
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/");
      const main = page.locator("main [data-start-chat]");
      const h1 = main.locator("h1");
      await expect(h1).toHaveText("Ishingiz shu yerdan boshlanadi!");
      // oqim bilan kelgan kontent ko'rinadigan bo'lgach o'lchanadi (avval yashirin nusxada turadi)
      await expect(main.locator("[data-guided-starts]")).toBeVisible();
      expect(await h1.evaluate((el) => el.scrollWidth <= el.clientWidth + 1), at).toBe(true);
      // tartib: sarlavha → qidiruv qatori → uchta tugma → tezkor bo'limlar
      const box = async (sel: string) => (await main.locator(sel).boundingBox())!;
      const [hb, sb, ab, qb] = [await box("h1"), await box("form[data-home-search]"), await box("[data-guided-starts]"), await box("[data-home-quick]")];
      expect(sb.y, at).toBeGreaterThan(hb.y + hb.height - 1);
      expect(ab.y, at).toBeGreaterThan(sb.y + sb.height - 1);
      expect(qb.y, at).toBeGreaterThan(ab.y + ab.height - 1);
      await expect(main.locator("[data-guided-start]")).toHaveText(["Ish qidiryapman", "Ishchi qidiryapman", "E'lon berish"]);
      // qidiruv maydonidagi ko'rsatma (ega, 2026-11-23: "Yozing, o'zingizga mosini toping" — sig'sin): kesilmaydi, maydon ichida
      const hint = main.locator("[data-home-hint]");
      await expect(hint).toHaveText("Yozing, o'zingizga mosini toping");
      const fit = await hint.evaluate((el) => {
        const f = el.closest("[data-home-field]")!.getBoundingClientRect();
        const r = el.getBoundingClientRect();
        return el.scrollWidth <= el.clientWidth + 1 && r.bottom <= f.bottom + 1 && r.right <= f.right + 1;
      });
      expect(fit, at).toBe(true);
      // pastdagi yozish maydoni bosh ekranda yo'q — uning o'rnida qidiruv qatori (ikkita matn maydoni bo'lmasin)
      await expect(page.locator("#start-chat-text")).toBeHidden();
      // uchta tugma yonma-yon: so'z o'rtasidan bo'linmaydi ("qidiryapma-n" emas), 320 px da ham
      const broken = await main.locator("[data-guided-start]").evaluateAll((els) =>
        els.flatMap((el) => {
          const node = Array.from(el.childNodes).find((n) => n.nodeType === Node.TEXT_NODE && n.textContent!.trim());
          if (!node) return [];
          const text = node.textContent!;
          const out: string[] = [];
          for (const m of text.matchAll(/\S+/g)) {
            const r = document.createRange();
            r.setStart(node, m.index!);
            r.setEnd(node, m.index! + m[0].length);
            if (new Set(Array.from(r.getClientRects()).map((x) => Math.round(x.top))).size > 1) out.push(m[0]);
          }
          return out;
        }),
      );
      expect(broken, at).toEqual([]);
      // ortiqcha narsalar yo'q: misollar, hikoyalar, kanal qatori
      await expect(main.locator("[data-guided-example], [data-stories], [data-channel-row], [data-chat-choice]")).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), at).toBeLessThanOrEqual(0);
    }
  }
});

test("Telegram kanal: chatda qator yo'q — kirgandan keyin oyna chiqadi (channel-prompt.spec)", async ({ page, context }) => {
  await asGuest(context);
  await asMode(context, "worker");
  await page.goto("/");
  await expect(page.locator("main [data-start-chat]")).toBeVisible();
  await expect(page.locator("main [data-channel-row]")).toHaveCount(0);
});
