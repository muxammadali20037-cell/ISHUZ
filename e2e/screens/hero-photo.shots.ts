import fs from "node:fs";
import path from "node:path";
import { expect, test, type Browser, type BrowserContext } from "@playwright/test";
import { USERS, asMode, loginAs, sql, stack } from "../support";
import { DEMO, cleanDemo, seedDemo } from "./demo-seed";

/**
 * Bosh ekran foni suratlari (namuna): admin orqali uchala joyga bitta surat yuklanadi, ekranlar olinadi, keyin olib tashlanadi.
 * Faqat lokal stendda; surat repoga qo'shilmaydi:
 *   HERO_PHOTO=/yo'l/surat.jpg npx playwright test -c e2e/screens/shots.config.ts e2e/screens/hero-photo.shots.ts
 */
const OUT = path.join(__dirname, "../../docs/screenshots/premium-2026-10");
const PHOTO = process.env.HERO_PHOTO ?? "";
const host = new URL(stack.app).hostname;

test.afterAll(async () => {
  await cleanDemo();
  await sql("delete from public.admin_users where profile_id = $1", [USERS.workerB]);
});

async function ctx(browser: Browser, width: number, setup: (c: BrowserContext) => Promise<void>) {
  const c = await browser.newContext({ baseURL: stack.app, viewport: { width, height: width < 768 ? 844 : 900 }, storageState: { cookies: [], origins: [] } });
  await c.addCookies([
    { name: "ishuz_locale", value: "uz", domain: host, path: "/" },
    { name: "ib_intro", value: "1", domain: host, path: "/" },
  ]);
  await setup(c);
  return c;
}

test("bosh ekran foni: surat bilan", async ({ browser, page, context }) => {
  test.skip(!PHOTO || !fs.existsSync(PHOTO), "HERO_PHOTO berilmagan");
  test.setTimeout(240_000);
  await seedDemo();
  await sql(
    `insert into public.admin_users (profile_id, role, permissions, is_active) values ($1, 'super_admin', '{}', true)
     on conflict (profile_id) do update set is_active = true, role = 'super_admin'`,
    [USERS.workerB],
  );
  await loginAs(context, USERS.workerB, "aal2");
  await page.goto("/admin/entry");
  const buffer = fs.readFileSync(PHOTO);
  const slots = ["hero_seeker", "hero_employer", "hero_guest"] as const;
  for (const s of slots) {
    const slot = page.getByTestId(`entry-slot-${s}`);
    await expect(async () => {
      const chooser = page.waitForEvent("filechooser", { timeout: 2000 }).catch(() => null);
      await slot.getByRole("button", { name: /Rasm yuklash|Almashtirish/ }).click();
      const c = await chooser;
      if (!c) throw new Error("fayl tanlash oynasi ochilmadi");
      await c.setFiles({ name: "hero.jpg", mimeType: "image/jpeg", buffer });
    }).toPass({ timeout: 15_000 });
    await expect(slot.locator("img")).toHaveAttribute("src", /\/site-media\/entry\//, { timeout: 15_000 });
  }

  const shot = async (p: import("@playwright/test").Page, name: string, width: number) => {
    await p.waitForLoadState("networkidle").catch(() => undefined);
    await p.waitForTimeout(700);
    await p.screenshot({ path: path.join(OUT, `photo-${name}-${width}.jpg`), type: "jpeg", quality: 74 });
  };
  for (const width of [390, 1440]) {
    const w = await ctx(browser, width, async (c) => {
      await loginAs(c, DEMO.worker);
      await asMode(c, "worker");
    });
    const p = await w.newPage();
    await p.goto("/");
    await shot(p, "2-seeker-home", width);
    await w.close();
    const e = await ctx(browser, width, async (c) => {
      await loginAs(c, DEMO.employer);
      await asMode(c, "employer");
    });
    const q = await e.newPage();
    await q.goto("/");
    await shot(q, "4-employer-home", width);
    await e.close();
    const g = await ctx(browser, width, async () => undefined);
    const gp = await g.newPage();
    await gp.goto("/");
    await shot(gp, "1-guest-home", width);
    await g.close();
  }

  // namuna olib tashlanadi — stend avvalgi holatga qaytadi
  for (const s of slots) await page.getByTestId(`entry-slot-${s}`).getByRole("button", { name: "O'rnatilgan tasvirga qaytish" }).click();
});
