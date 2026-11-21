import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { USERS, asGuest, asMode, loginAs, sql, stack } from "../support";

/**
 * "Ish topdim" hikoyalari (0079; ega, 2026-11-14: "rasmlar, videolar — xuddi Instagramdagidek, Ish topdimning o'zi joylaydi"):
 * admin rasm/video joylaydi → bosh sahifa tepasida doiracha → bosilsa to'liq ekranda, reklama tugmasi bilan;
 * kimga ko'rinishi (hammaga / ish beruvchilarga); niqoblangan "video" rad etiladi; o'chirish — saytdan darhol yo'qoladi.
 */

const STORAGE = path.join(__dirname, "../.stack/storage");
const phone = () => ({ baseURL: stack.app, viewport: { width: 390, height: 844 } });
const WEBM = fs.readFileSync(path.join(__dirname, "../fixtures/story.webm"));

async function image() {
  return sharp({ create: { width: 1080, height: 1920, channels: 3, background: { r: 15, g: 118, b: 110 } } })
    .jpeg()
    .withExif({ IFD0: { Artist: "admin uyi" } })
    .toBuffer();
}

async function asAdmin(context: BrowserContext) {
  await sql(
    `insert into public.admin_users (profile_id, role, permissions, is_active) values ($1, 'super_admin', '{}', true)
     on conflict (profile_id) do update set is_active = true, role = 'super_admin'`,
    [USERS.workerB],
  );
  await loginAs(context, USERS.workerB, "aal2");
}

async function publish(page: Page, opts: { file: { name: string; mimeType: string; buffer: Buffer }; title: string; cta?: [string, string]; audience?: string }) {
  await page.goto("/admin/hikoyalar");
  const form = page.locator("[data-story-form]");
  await expect(form).toBeVisible();
  await form.locator("[data-story-file]").setInputFiles(opts.file);
  await form.locator("[data-story-title]").fill(opts.title);
  if (opts.cta) {
    await form.locator("[data-story-cta-label]").fill(opts.cta[0]);
    await form.locator("[data-story-cta-url]").fill(opts.cta[1]);
  }
  if (opts.audience) await form.getByLabel("Kimga ko'rinadi").selectOption({ label: opts.audience });
  await form.locator("[data-story-submit]").click();
}

/** Admin ro'yxatidan o'chirish — sayt keshi ham yangilanadi (boshqa spec'lar bosh sahifani hikoyasiz kutadi) */
async function removeAll(page: Page) {
  page.on("dialog", (d) => void d.accept());
  await page.goto("/admin/hikoyalar");
  for (let i = 0; i < 10; i++) {
    const rows = page.locator("[data-story-row]");
    if ((await rows.count()) === 0) break;
    const n = await rows.count();
    await rows.first().locator("[data-story-delete]").click();
    await expect(rows).toHaveCount(n - 1);
  }
}

/**
 * 2026-11-21 kechqurun (ega: "chat juda sodda bo'lsin, ortiqcha narsa kerakmas"): bosh sahifa chatida hikoyalar yo'q —
 * ular ish beruvchi panelida (/employer) ko'rinadi
 */
async function employerPage(browser: import("@playwright/test").Browser) {
  await sql(
    `insert into public.employer_profiles (profile_id, employer_type, display_name, onboarding_completed_at)
     values ($1, 'person', 'Dilnoza opa', now()) on conflict (profile_id) do nothing`,
    [USERS.employer],
  );
  const ctx = await browser.newContext(phone());
  await loginAs(ctx, USERS.employer);
  await asMode(ctx, "employer");
  return { ctx, page: await ctx.newPage() };
}

test.afterEach(async () => {
  await sql("delete from public.admin_users where profile_id = $1", [USERS.workerB]);
});

test("admin rasm joylaydi → ish beruvchi paneli tepasida doiracha (chatda yo'q) → to'liq ekranda, reklama tugmasi ishlaydi; ko'rilgani eslanadi", async ({ page, context, browser }) => {
  test.setTimeout(120_000);
  await asAdmin(context);
  try {
    await publish(page, { file: { name: "aksiya.jpg", mimeType: "image/jpeg", buffer: await image() }, title: "Aksiya E2E", cta: ["Vakansiya joylash", "/post/vacancy"] });
    await expect(page.getByText("Hikoya joylandi")).toBeVisible();
    const row = page.locator("[data-story-row]").filter({ hasText: "Aksiya E2E" });
    await expect(row.locator("[data-story-status]")).toHaveAttribute("data-story-status", "live");
    const [db] = await sql<{ media_path: string; media_kind: string; audience: string; cta_url: string; ends_at: string | null }>(
      "select media_path, media_kind, audience, cta_url, ends_at::text from public.stories where title = 'Aksiya E2E'",
    );
    expect(db).toMatchObject({ media_kind: "image", audience: "all", cta_url: "/post/vacancy" });
    expect(db!.media_path).toMatch(/^site-media\/stories\/v-[0-9a-f]{64}\.webp$/);
    expect(db!.ends_at).not.toBeNull(); // standart — 7 kun
    // server qayta kodlagan: WebP, metama'lumotsiz (EXIF'dagi "admin uyi" yo'q)
    const stored = fs.readFileSync(path.join(STORAGE, db!.media_path));
    expect((await sharp(stored).metadata()).format).toBe("webp");
    expect(stored.includes(Buffer.from("admin uyi"))).toBe(false);

    // mehmon bosh sahifasi (chat) — hikoyalar yo'q
    const guestCtx = await browser.newContext(phone());
    await asGuest(guestCtx);
    const g = await guestCtx.newPage();
    await g.goto("/");
    await expect(g.locator("main h1").first()).toBeVisible();
    await expect(g.locator("[data-stories]")).toHaveCount(0);
    await guestCtx.close();

    // ish beruvchi paneli tepasida ("hammaga" deb belgilangan)
    const { ctx: empCtx, page: guest } = await employerPage(browser);
    await guest.goto("/employer");
    const circle = guest.locator("[data-stories] [data-story]").filter({ hasText: "Aksiya E2E" });
    await expect(circle).toBeVisible();
    await expect(circle).not.toHaveAttribute("data-story-seen");
    await circle.click();
    const viewer = guest.getByRole("dialog", { name: "Aksiya E2E" });
    await expect(viewer).toBeVisible();
    await expect(viewer.getByText("Ish topdim", { exact: true })).toBeVisible();
    // pauza tugmasi va klaviatura: Esc — yopadi, fokus doirachaga qaytadi
    await viewer.locator("[data-story-pause]").click();
    await expect(viewer.getByRole("button", { name: "Davom ettirish" })).toBeVisible();
    await guest.keyboard.press("Escape");
    await expect(viewer).toBeHidden();
    await expect(circle).toBeFocused();
    await expect(circle).toHaveAttribute("data-story-seen", "");
    // reklama tugmasi — sayt ichidagi sahifaga
    await circle.click();
    await guest.getByRole("dialog", { name: "Aksiya E2E" }).getByRole("link", { name: "Vakansiya joylash" }).click();
    await guest.waitForURL(/\/post\/vacancy/);
    // qayta kirganda — ko'rilgan (kulrang halqa)
    await guest.goto("/employer");
    await expect(guest.locator("[data-stories] [data-story]").filter({ hasText: "Aksiya E2E" })).toHaveAttribute("data-story-seen", "");
    await empCtx.close();
  } finally {
    await removeAll(page);
  }
  // o'chirilgach — saytda darhol yo'q
  const { ctx: after, page: p2 } = await employerPage(browser);
  await p2.goto("/employer");
  await expect(p2.locator("main h1").first()).toBeVisible();
  await expect(p2.locator("[data-stories]")).toHaveCount(0);
  await after.close();
});

test("video (imzolangan havola bilan to'g'ridan-to'g'ri) faqat ish beruvchilarga; niqoblangan fayl rad etiladi va o'chiriladi", async ({ page, context, browser }) => {
  test.setTimeout(120_000);
  await asAdmin(context);
  try {
    // HTML "video" deb yuklansa — server boshidagi baytlardan rad etadi, fayl o'chiriladi, yozuv yo'q
    await publish(page, { file: { name: "fake.mp4", mimeType: "video/mp4", buffer: Buffer.from("<html><script>alert(1)</script></html>") }, title: "Soxta video" });
    await expect(page.getByText("Fayl video emas yoki buzilgan")).toBeVisible();
    expect(await sql("select 1 from public.stories where title = 'Soxta video'")).toHaveLength(0);
    const videos = path.join(STORAGE, "story-videos/v");
    expect(fs.existsSync(videos) ? fs.readdirSync(videos).filter((f) => f.endsWith(".mp4")) : []).toHaveLength(0);

    await publish(page, { file: { name: "yangilik.webm", mimeType: "video/webm", buffer: WEBM }, title: "Video E2E", audience: "Ish beruvchilarga" });
    await expect(page.getByText("Hikoya joylandi")).toBeVisible();
    const [db] = await sql<{ media_path: string; media_kind: string; poster_path: string | null; audience: string }>(
      "select media_path, media_kind, poster_path, audience from public.stories where title = 'Video E2E'",
    );
    expect(db).toMatchObject({ media_kind: "video", audience: "employer" });
    expect(db!.media_path).toMatch(/^story-videos\/v\/[0-9a-f-]{36}\.webm$/);
    expect(fs.readFileSync(path.join(STORAGE, db!.media_path)).equals(WEBM)).toBe(true);
    // muqova brauzerda videodan olingan va server qayta kodlagan
    expect(db!.poster_path).toMatch(/^site-media\/stories\/v-[0-9a-f]{64}\.webp$/);

    // ish izlovchi va rejimsiz mehmon ko'rmaydi; ish beruvchi ko'radi va video ochiladi
    const seekerCtx = await browser.newContext(phone());
    const seeker = await seekerCtx.newPage();
    await asGuest(seekerCtx);
    await asMode(seekerCtx, "worker");
    await seeker.goto("/");
    await expect(seeker.locator("main h1").first()).toBeVisible();
    await expect(seeker.locator("[data-story]").filter({ hasText: "Video E2E" })).toHaveCount(0);
    await seekerCtx.close();

    const { ctx: empCtx, page: emp } = await employerPage(browser);
    await emp.goto("/employer");
    const circle = emp.locator("[data-stories] [data-story]").filter({ hasText: "Video E2E" });
    await expect(circle).toBeVisible();
    await circle.click();
    const viewer = emp.getByRole("dialog", { name: "Video E2E" });
    await expect(viewer.locator("video")).toHaveAttribute("src", /story-videos\/v\/.+\.webm$/);
    await expect(viewer.locator("[data-story-mute]")).toBeVisible();
    await viewer.locator("[data-story-close]").click();
    await expect(viewer).toBeHidden();
    await empCtx.close();
  } finally {
    await removeAll(page);
  }
  // video fayli ham o'chirilgan
  const videos = path.join(STORAGE, "story-videos/v");
  expect(fs.existsSync(videos) ? fs.readdirSync(videos) : []).toHaveLength(0);
});
