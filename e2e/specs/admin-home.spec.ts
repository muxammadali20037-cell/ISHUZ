import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { USERS, asGuest, loginAs, sql } from "../support";

/**
 * D6 · admin → "Bosh sahifa": oynalar matni, tartibi, ko'rinishi, rasmi va lupa tugmasi admin panelda sozlanadi;
 * saqlangach saytda darhol (kesh yangilanadi) ko'rinadi, har o'zgarish audit jurnaliga yoziladi.
 */

const STORAGE = path.join(__dirname, "../.stack/storage");

async function chooseFile(page: Page, button: Locator, file: { name: string; mimeType: string; buffer: Buffer }) {
  await expect(async () => {
    const chooser = page.waitForEvent("filechooser", { timeout: 2000 }).catch(() => null);
    await button.click();
    const c = await chooser;
    if (!c) throw new Error("fayl tanlash oynasi ochilmadi");
    await c.setFiles(file);
  }).toPass({ timeout: 15_000 });
}

const windowsOf = (page: Page) => page.getByRole("region", { name: "Tezkor bo'limlar" }).getByRole("link");

test.beforeEach(async () => {
  await sql(
    `insert into public.admin_users (profile_id, role, permissions, is_active) values ($1, 'super_admin', '{}', true)
     on conflict (profile_id) do update set is_active = true, role = 'super_admin'`,
    [USERS.workerB],
  );
});
test.afterEach(async ({ page }) => {
  // sayt keshi faqat admin amali bilan yangilanadi — boshqa spec'lar standart bosh sahifani kutadi
  const [s] = await sql<{ on: boolean }>("select value = 'true'::jsonb as on from public.app_settings where key = 'ai_search_button'");
  if (s && !s.on && (await page.url()).includes("/admin")) {
    await page.goto("/admin/home");
    const sw = page.getByRole("switch", { name: "«O'zingizga mosini toping» lupa tugmasi" });
    await sw.click();
    await expect(sw).toHaveAttribute("aria-checked", "true");
  }
  await sql("delete from public.admin_users where profile_id = $1", [USERS.workerB]);
});

test("admin: oyna matni, ko'rinishi va rasmi; lupa tugmasini o'chirish — saytda darhol; audit yoziladi", async ({ page, context, browser }) => {
  test.setTimeout(120_000);
  const [{ started }] = (await sql<{ started: string }>("select now()::text as started")) as [{ started: string }];
  await loginAs(context, USERS.workerB, "aal2");
  await page.goto("/admin/home");
  await expect(page.getByRole("heading", { level: 1, name: "Bosh sahifa" })).toBeVisible();
  const first = page.getByRole("listitem", { name: "1-oyna" });
  const third = page.getByRole("listitem", { name: "3-oyna" });
  await expect(page.getByRole("listitem", { name: /-oyna$/ })).toHaveCount(3);
  // bo'sh maydonda — saytda ko'rinadigan standart matn (har tilda o'zi), "Standart matn" emas
  await expect(first.getByRole("textbox", { name: "Sarlavha (O'zbek)" })).toHaveAttribute("placeholder", "Endi xodim topish oson");
  await expect(first.getByRole("textbox", { name: "Sarlavha (Русский)" })).toHaveAttribute("placeholder", "Найти сотрудника теперь просто");
  // telefonda pastki yopishqoq panel — faqat "Saqlash", ekranni yopmaydi
  const bar = page.getByRole("button", { name: "Saqlash" }).locator("xpath=ancestor::div[contains(@class,'sticky')][1]");
  await expect(bar).toBeVisible();
  expect((await bar.boundingBox())!.height).toBeLessThan(80);

  // 1-oyna sarlavhasi (o'zbekcha), 3-oyna o'chiriladi, 2-oynaga rasm
  await first.getByRole("textbox", { name: "Sarlavha (O'zbek)" }).fill("Ishchi kerakmi? Shu yerda toping");
  await third.getByRole("switch", { name: "Ko'rsatilsin" }).click();
  const second = page.getByRole("listitem", { name: "2-oyna" });
  const photo = await sharp({ create: { width: 2400, height: 1350, channels: 3, background: { r: 20, g: 90, b: 200 } } })
    .jpeg()
    .withExif({ IFD0: { Artist: "Admin uy manzili" } })
    .toBuffer();
  await chooseFile(page, second.getByRole("button", { name: "Rasm yuklash" }), { name: "banner.jpg", mimeType: "image/jpeg", buffer: photo });
  const preview = second.locator("img");
  await expect(preview).toHaveAttribute("src", /\/site-media\/windows\/v-[0-9a-f]{64}\.webp$/, { timeout: 15_000 });
  const file = (await preview.getAttribute("src"))!.split("/site-media/")[1]!;
  const meta = await sharp(fs.readFileSync(path.join(STORAGE, "site-media", file))).metadata();
  expect(meta.format).toBe("webp");
  expect(meta.exif).toBeUndefined();
  expect(meta.width).toBe(1280);

  // rasm bo'lmagan fayl — tushunarli xato, oldingi rasm joyida
  await chooseFile(page, second.getByRole("button", { name: "Rasmni almashtirish" }), { name: "x.jpg", mimeType: "image/jpeg", buffer: Buffer.from("<script>alert(1)</script>") });
  await expect(page.getByText("Rasmni o'qib bo'lmadi yoki u surat emas").first()).toBeVisible();
  await expect(preview).toHaveAttribute("src", new RegExp(file.replace(/[.]/g, "\\.")));

  await page.getByRole("button", { name: "Saqlash" }).click();
  await expect(page.getByText("Bosh sahifa yangilandi").first()).toBeVisible();

  // sayt (mehmon, alohida kontekst): yangi sarlavha, 2 ta oyna, 2-oynada yuklangan rasm
  const guestCtx = await browser.newContext({ baseURL: page.url().replace(/\/admin.*$/, ""), viewport: { width: 390, height: 844 } });
  const guest = await guestCtx.newPage();
  await asGuest(guestCtx);
  await guest.goto("/");
  await expect(windowsOf(guest)).toHaveCount(2);
  await expect(windowsOf(guest).nth(0)).toContainText("Ishchi kerakmi? Shu yerda toping");
  await expect(windowsOf(guest).nth(1).locator("img")).toHaveAttribute("src", new RegExp(file.replace(/[.]/g, "\\.")));
  await expect(guest.getByRole("button", { name: "O'zingizga mosini toping" })).toBeVisible();

  // lupa tugmasi o'chiriladi — saytda yo'qoladi
  const aiSwitch = page.getByRole("switch", { name: "«O'zingizga mosini toping» lupa tugmasi" });
  await aiSwitch.click();
  await expect(aiSwitch).toHaveAttribute("aria-checked", "false");
  await guest.reload();
  await expect(guest.getByRole("button", { name: "O'zingizga mosini toping" })).toHaveCount(0);

  const logs = await sql<{ target_id: string }>(
    "select target_id from public.audit_logs where actor_id = $1 and action = 'settings.update' and target_id in ('home_banners', 'ai_search_button') and created_at >= $2::timestamptz order by id",
    [USERS.workerB, started],
  );
  expect(logs.map((l) => l.target_id)).toEqual(["home_banners", "ai_search_button"]);

  // lupa tugmasi qayta yoqiladi, oynalar standartga qaytariladi
  await aiSwitch.click();
  await expect(aiSwitch).toHaveAttribute("aria-checked", "true");
  await guest.reload();
  await expect(guest.getByRole("button", { name: "O'zingizga mosini toping" })).toBeVisible();
  await page.getByRole("button", { name: "Standartga qaytarish" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Standartga qaytarish" }).click();
  await expect(page.getByRole("listitem", { name: /-oyna$/ })).toHaveCount(3);
  await guest.reload();
  await expect(windowsOf(guest)).toHaveCount(3);
  await expect(windowsOf(guest).nth(0)).toContainText("Endi xodim topish oson");
  await guestCtx.close();
});

test("admin bo'lmagan foydalanuvchi bosh sahifa sozlamalarini ocha olmaydi", async ({ page, context }) => {
  await sql("delete from public.admin_users where profile_id = $1", [USERS.workerB]);
  await loginAs(context, USERS.workerB, "aal2");
  const res = await page.goto("/admin/home");
  expect(res?.status() === 404 || page.url().includes("/auth") || (await page.getByText("Ruxsat yo'q").count()) > 0 || !page.url().includes("/admin/home")).toBe(true);
  await expect(page.getByRole("button", { name: "Saqlash" })).toHaveCount(0);
});
