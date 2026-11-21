import { expect, test, type Page } from "@playwright/test";
import { USERS, asGuest, asMode, loginAs, sql, stack } from "../support";

/**
 * Birinchi kirgandagi tanishtiruv (ega, 2026-11-19: "1-chi kirganlarga tugmalar vazifasini tushuntirsin, o'sha tilda"):
 * tugmalar navbat bilan yoritiladi, yonida nomi va vazifasi; har panel uchun bir marta; "Kerak emas" / "O'tkazib yuborish"
 * ham eslab qolinadi; ekranda yo'q tugma (mehmonda "Xabarlar", qo'ng'iroqcha) o'tkazib yuboriladi; ?tour=1 — qayta.
 */

const card = (page: Page) => page.locator("[data-tour-card]");

/** Hamma qadamni "Keyingi" bilan o'tadi; har qadamda yoritilgan joy haqiqatan o'sha tugma ustida ekanini tekshiradi */
async function walk(page: Page): Promise<string[]> {
  // yoritish halqasi bir tugmadan ikkinchisiga suriladi — o'lchashda harakat bo'lmasin
  await page.emulateMedia({ reducedMotion: "reduce" });
  const codes: string[] = [];
  for (let n = 0; n < 20; n++) {
    await expect(card(page)).toBeVisible();
    await page.waitForTimeout(150);
    const code = (await card(page).getAttribute("data-tour-card"))!;
    codes.push(code);
    const spot = page.locator("[data-tour-spot]");
    if (await spot.count()) {
      const target = (await spot.getAttribute("data-tour-spot"))!;
      const el = page.locator(`[data-tour="${target}"]`).filter({ visible: true }).first();
      const [a, b] = [await spot.boundingBox(), await el.boundingBox()];
      expect(a && b, code).toBeTruthy();
      // yoritish tugmani o'z ichiga oladi
      expect(a!.x).toBeLessThanOrEqual(b!.x + 1);
      expect(a!.y).toBeLessThanOrEqual(b!.y + 1);
      expect(a!.x + a!.width).toBeGreaterThanOrEqual(b!.x + b!.width - 1);
      expect(a!.y + a!.height).toBeGreaterThanOrEqual(b!.y + b!.height - 1);
      // karta ekranda to'liq
      const c = (await card(page).boundingBox())!;
      const vp = page.viewportSize()!;
      expect(c.y).toBeGreaterThanOrEqual(0);
      expect(c.y + c.height).toBeLessThanOrEqual(vp.height);
    }
    const next = card(page).locator("[data-tour-next]");
    const label = (await next.textContent())?.trim();
    await next.click();
    if (label === "Tayyor") break;
  }
  await expect(card(page)).toHaveCount(0);
  return codes;
}

const tourCookie = async (page: Page) => (await page.context().cookies()).find((c) => c.name === "ib_tour")?.value ?? "";

test("mehmon ish izlovchi: salom → rol → pastki menyu → til, kirish → yakun; bir marta", async ({ page, context }) => {
  await asGuest(context);
  await asMode(context, "worker");
  await context.clearCookies({ name: "ib_tour" });
  await page.goto("/");
  await expect(card(page)).toHaveAttribute("data-tour-card", "W1");
  await expect(card(page)).toContainText("Assalomu alaykum!");
  await expect(card(page).getByRole("button", { name: "Kerak emas" })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveAttribute("aria-modal", "true");
  // o'zbekcha ovoz bor (ega yozdirgan): ovozni o'chirish tugmasi; "Boshlash"dan keyin navbatdagi qadam ovozi yuklanadi
  await expect(card(page).getByRole("button", { name: "Ovozni o'chirish" })).toBeVisible();
  const voice = page.waitForResponse((r) => r.url().endsWith("/tour/uz/U1.mp3"));
  const codes = await walk(page);
  expect([200, 206]).toContain((await voice).status());
  // mehmonda "Xabarlar" va qo'ng'iroqcha yo'q — o'tkazib yuboriladi; 2026-11-20 dan pastki menyu 5 ta bo'lim — "Bosh sahifa",
  // "Ish beruvchilar", "Sohalar" va alohida "Yordamchi" belgisi yo'q (ularning qadamlari ham)
  expect(codes).toEqual(["W1", "U1", "W7", "W6", "U2", "U3", "U6"]);
  expect(await tourCookie(page)).toContain("w");
  await page.reload();
  await page.waitForTimeout(1500);
  await expect(card(page)).toHaveCount(0);
});

test("mehmon ish beruvchi: «E'lon» (+) ham tushuntiriladi; «Kerak emas» — eslab qolinadi; ?tour=1 — qayta", async ({ page, context }) => {
  await asGuest(context);
  await asMode(context, "employer");
  await context.clearCookies({ name: "ib_tour" });
  await page.goto("/");
  await expect(card(page)).toHaveAttribute("data-tour-card", "E1");
  await card(page).getByRole("button", { name: "Kerak emas" }).click();
  await expect(card(page)).toHaveCount(0);
  expect(await tourCookie(page)).toBe("e");
  await page.reload();
  await page.waitForTimeout(1500);
  await expect(card(page)).toHaveCount(0);

  await page.goto("/?tour=1");
  const codes = await walk(page);
  // 2026-11-20: "Boshqaruv", markaziy "E'lon" va "Yordamchi" o'rnida — umumiy 5 ta bo'lim (E'lonlarim, Ishchilar, Profil bor)
  expect(codes).toEqual(["E1", "U1", "E7", "E3", "E6", "U2", "U3", "U6"]);
});

test("kirgan ish beruvchi: rol tanlash va «Kirish» yo'q — xabarlar va qo'ng'iroqcha bor; Escape — o'tkazib yuboradi", async ({ page, context }) => {
  await sql(
    `insert into public.employer_profiles (profile_id, employer_type, display_name, onboarding_completed_at)
     values ($1, 'person', 'Dilnoza opa', now()) on conflict (profile_id) do update set onboarding_completed_at = now()`,
    [USERS.employer],
  );
  await loginAs(context, USERS.employer);
  await asMode(context, "employer");
  await context.clearCookies({ name: "ib_tour" });
  // kirgan foydalanuvchi: "/" — chat; tanishtiruv shu asosiy ekranda
  await page.goto("/");
  await page.waitForURL(/\/chat$/);
  await expect(card(page)).toHaveAttribute("data-tour-card", "E1");
  await card(page).locator("[data-tour-next]").click();
  // 2026-11-21: ikkinchi qadam — "Chat" bo'limi (yordamchi)
  await expect(card(page)).toHaveAttribute("data-tour-card", "E7");
  await card(page).getByRole("button", { name: "Orqaga" }).waitFor();
  await page.keyboard.press("Escape");
  await expect(card(page)).toHaveCount(0);
  expect(await tourCookie(page)).toBe("e");

  await page.goto("/chat?tour=1");
  const codes = await walk(page);
  expect(codes).toEqual(["E1", "E7", "E3", "E6", "U2", "U4", "U5", "U6"]);
});

test("rus tilida — matnlar ruscha", async ({ page, context }) => {
  await asGuest(context);
  await asMode(context, "worker");
  await context.clearCookies({ name: "ib_tour" });
  await context.addCookies([{ name: "ishuz_locale", value: "ru", domain: new URL(stack.app).hostname, path: "/" }]);
  await page.goto("/");
  await expect(card(page)).toContainText("Здравствуйте!");
  // ruscha ovoz hali yo'q — tugma ham, so'rov ham yo'q
  await expect(card(page).getByRole("button", { name: /звук/ })).toHaveCount(0);
  await card(page).getByRole("button", { name: "Начать" }).click();
  await expect(card(page)).toContainText("Роль");
});
