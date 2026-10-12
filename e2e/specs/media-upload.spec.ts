import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { USERS, loginAs, sql } from "../support";

/**
 * D2 · F-06 qolgan qismi: profil rasmi va kompaniya logotipi — karantin → serverda qayta kodlash (EXIF yo'q) →
 * o'zgarmas <egasi>/v-<sha256>.webp. Rasm bo'lmagan fayl rad etiladi, mavjud rasm o'zgarmaydi.
 */

const STORAGE = path.join(__dirname, "../.stack/storage");
const dir = (bucket: string, owner: string) => path.join(STORAGE, bucket, owner);
const files = (bucket: string, owner: string) => (fs.existsSync(dir(bucket, owner)) ? fs.readdirSync(dir(bucket, owner)) : []);
const VERIFIED = /\/v-[0-9a-f]{64}\.webp$/;

const photoWithExif = () =>
  sharp({ create: { width: 1800, height: 1200, channels: 3, background: { r: 40, g: 160, b: 90 } } })
    .jpeg()
    .withExif({ IFD0: { Artist: "Botir uy manzili", Copyright: "maxfiy" } })
    .toBuffer();

/** Foydalanuvchi kabi: tugma bosiladi → fayl tanlash oynasi; sahifa hali "jonlanmagan" bo'lsa (hydration), urinish takrorlanadi */
async function chooseFile(page: Page, button: Locator, file: { name: string; mimeType: string; buffer: Buffer }) {
  await expect(async () => {
    const chooser = page.waitForEvent("filechooser", { timeout: 2000 });
    await button.click();
    await (await chooser).setFiles(file);
  }).toPass({ timeout: 15_000 });
}

async function workerReady() {
  const [n] = await sql<{ id: string }>("select id from public.profession_nodes where name_uz = 'Buxgalter' and selectable limit 1");
  const [r] = await sql<{ id: string }>("select id from public.regions where slug = 'tashkent_city'");
  await sql("delete from public.worker_profiles where profile_id = $1", [USERS.workerB]);
  await sql(
    `insert into public.worker_profiles (profile_id, headline, region_id, profession_node_id, experience_level, onboarding_completed_at)
     values ($1, 'Buxgalter', $2, $3, '3_5y', now())`,
    [USERS.workerB, r!.id, n!.id],
  );
  await sql("update public.profiles set avatar_url = null where id = $1", [USERS.workerB]);
  for (const b of ["avatars", "media-uploads"]) fs.rmSync(b === "avatars" ? dir(b, USERS.workerB) : path.join(STORAGE, b, "avatar", USERS.workerB), { recursive: true, force: true });
}

test.afterEach(async () => {
  await sql("delete from public.worker_profiles where profile_id = $1", [USERS.workerB]);
  await sql("update public.profiles set avatar_url = null where id = $1", [USERS.workerB]);
});

test("profil rasmi: EXIF'siz WebP, tekshirilgan nom; xom fayl karantindan o'chadi; soxta rasm rad, eski rasm joyida", async ({ page, context }) => {
  await workerReady();
  await loginAs(context, USERS.workerB);
  await page.goto("/profile/edit");
  const upload = page.getByRole("button", { name: /^Rasm(ni almashtirish| yuklash)$/ });

  await chooseFile(page, upload, { name: "men.jpg", mimeType: "image/jpeg", buffer: await photoWithExif() });
  await expect(page.getByText("Yuklandi", { exact: true }).first()).toBeVisible({ timeout: 15_000 });
  const [p] = await sql<{ avatar_url: string }>("select avatar_url from public.profiles where id = $1", [USERS.workerB]);
  expect(p!.avatar_url).toMatch(VERIFIED);
  expect(p!.avatar_url).toContain(`/avatars/${USERS.workerB}/v-`);
  const stored = files("avatars", USERS.workerB);
  expect(stored).toHaveLength(1);
  const bytes = fs.readFileSync(path.join(dir("avatars", USERS.workerB), stored[0]!));
  const meta = await sharp(bytes).metadata();
  expect(meta.format).toBe("webp");
  expect(meta.exif).toBeUndefined();
  expect(Math.max(meta.width!, meta.height!)).toBe(640);
  expect(bytes.includes(Buffer.from("Botir uy manzili"))).toBe(false);
  expect(files("media-uploads", `avatar/${USERS.workerB}`)).toEqual([]);

  // rasm emas (nomi .jpg) — tushunarli xato, profil rasmi o'zgarmaydi
  await chooseFile(page, upload, { name: "virus.jpg", mimeType: "image/jpeg", buffer: Buffer.from("<html><script>alert(1)</script></html>") });
  await expect(page.getByText("Rasmni o'qib bo'lmadi yoki u surat emas").first()).toBeVisible({ timeout: 15_000 });
  const [after] = await sql<{ avatar_url: string }>("select avatar_url from public.profiles where id = $1", [USERS.workerB]);
  expect(after!.avatar_url).toBe(p!.avatar_url);
  expect(files("avatars", USERS.workerB)).toEqual(stored);
  expect(files("media-uploads", `avatar/${USERS.workerB}`)).toEqual([]);
});

test.describe("kompaniya logotipi", () => {
  let companyId = "";
  test.beforeEach(async () => {
    await sql("delete from public.companies where created_by = $1 and name = 'Logo Test MChJ'", [USERS.employer]);
    const [c] = await sql<{ id: string }>("insert into public.companies (name, created_by) values ('Logo Test MChJ', $1) returning id", [USERS.employer]);
    companyId = c!.id;
    await sql("insert into public.company_members (company_id, profile_id, role) values ($1, $2, 'owner') on conflict do nothing", [companyId, USERS.employer]);
    await sql(
      `insert into public.employer_profiles (profile_id, employer_type, display_name, company_id, onboarding_completed_at)
       values ($1, 'company', 'Logo Test MChJ', $2, now())
       on conflict (profile_id) do update set employer_type = 'company', company_id = excluded.company_id`,
      [USERS.employer, companyId],
    );
    await sql("update public.profiles set active_role = 'employer' where id = $1", [USERS.employer]);
  });
  test.afterEach(async () => {
    // keyingi spec'lar "O'zim uchun" ish beruvchini kutadi
    await sql("update public.employer_profiles set employer_type = 'person', company_id = null, display_name = 'Dilnoza opa' where profile_id = $1", [USERS.employer]);
    await sql("delete from public.companies where id = $1", [companyId]);
    fs.rmSync(dir("company-logos", companyId), { recursive: true, force: true });
  });

  test("logotip: shaffof PNG → EXIF'siz WebP (≤512 px), tekshirilgan nom", async ({ page, context }) => {
    await loginAs(context, USERS.employer);
    await page.goto("/company/settings");
    const png = await sharp({ create: { width: 1000, height: 1000, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();
    await chooseFile(page, page.getByRole("button", { name: /^(Logotip yuklash|Almashtirish)$/ }), { name: "logo.png", mimeType: "image/png", buffer: png });
    await expect(page.getByText("Logotip yangilandi").first()).toBeVisible({ timeout: 15_000 });
    const [c] = await sql<{ logo_url: string }>("select logo_url from public.companies where id = $1", [companyId]);
    expect(c!.logo_url).toMatch(VERIFIED);
    const stored = files("company-logos", companyId);
    expect(stored).toHaveLength(1);
    const meta = await sharp(fs.readFileSync(path.join(dir("company-logos", companyId), stored[0]!))).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.width).toBe(512);
    expect(files("media-uploads", `logo/${companyId}`)).toEqual([]);
  });
});
