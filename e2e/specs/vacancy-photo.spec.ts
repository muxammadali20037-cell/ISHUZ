import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { expect, test, type Page } from "@playwright/test";
import { USERS, asMode, formReady, loginAs, next, pickProfession, pickWholeRegion, sql } from "../support";

// E: e'lon berish va qidiruv — shu rejimda (rejim tanlanmasa, avval tasdiq so'raladi)
test.beforeEach(async ({ context }) => {
  await asMode(context, "employer");
});

/** F-06: ish joyi surati karantin → serverda qayta kodlash (EXIF yo'q) → o'zgarmas v-<sha256>.webp → e'lon */

const STORAGE = path.join(__dirname, "../.stack/storage");
const files = (bucket: string) => {
  const dir = path.join(STORAGE, bucket, USERS.employer);
  return fs.existsSync(dir) ? fs.readdirSync(dir) : [];
};

async function photoWithGps() {
  return sharp({ create: { width: 2400, height: 1800, channels: 3, background: { r: 30, g: 140, b: 200 } } })
    .jpeg()
    .withExif({ IFD0: { Artist: "Dilnoza uy manzili", Copyright: "maxfiy" } })
    .toBuffer();
}

async function openPhotoStep(page: Page) {
  await page.goto("/post/vacancy");
  await pickProfession(page, "Buxgalter", "Buxgalter");
  await next(page);
  await pickWholeRegion(page);
  await next(page);
  await page.getByRole("radio", { name: "O'zim uchun" }).click();
  await page.locator("#org").fill("Dilnoza opa");
  await page.locator("#desc").fill("Kichik do'konga buxgalter kerak, haftasiga 3 kun, tushlik bepul");
  await page.getByText("Kelishiladi", { exact: true }).first().click();
  await page.getByRole("button", { name: /Qo'shimcha ma'lumot/ }).click();
}

test.beforeEach(async () => {
  await sql("delete from public.vacancies where owner_profile_id = $1", [USERS.employer]);
  for (const b of ["vacancy-uploads", "vacancy-photos"]) fs.rmSync(path.join(STORAGE, b, USERS.employer), { recursive: true, force: true });
});

test("surat tekshirilib, metama'lumotsiz nusxa e'longa yoziladi; xom fayl karantindan o'chadi", async ({ page, context }) => {
  await loginAs(context, USERS.employer);
  await openPhotoStep(page);

  await page.locator('input[type="file"]').setInputFiles({ name: "dokon.jpg", mimeType: "image/jpeg", buffer: await photoWithGps() });
  const img = page.getByRole("img", { name: "Ish joyi surati" });
  await expect(img).toBeVisible({ timeout: 20_000 });
  await expect(img).toHaveAttribute("src", new RegExp(`/vacancy-photos/${USERS.employer}/v-[0-9a-f]{64}\\.webp$`));

  // karantinda hech narsa qolmadi; ommaviy bucket'da faqat tekshirilgan nusxa
  expect(files("vacancy-uploads")).toEqual([]);
  const pub = files("vacancy-photos");
  expect(pub).toHaveLength(1);
  expect(pub[0]).toMatch(/^v-[0-9a-f]{64}\.webp$/);
  const stored = fs.readFileSync(path.join(STORAGE, "vacancy-photos", USERS.employer, pub[0]!));
  const meta = await sharp(stored).metadata();
  expect(meta.format).toBe("webp");
  expect(meta.exif).toBeUndefined();
  expect(Math.max(meta.width!, meta.height!)).toBe(1600);
  expect(stored.includes(Buffer.from("Dilnoza uy manzili"))).toBe(false);

  await next(page);
  await page.getByRole("button", { name: /E'lonni joylash|O'zgarishlarni saqlash/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: /joylandi|saqlandi/i })).toBeVisible({ timeout: 30_000 });
  const [v] = await sql<{ photo_path: string }>("select photo_path from public.vacancies where owner_profile_id = $1", [USERS.employer]);
  expect(v!.photo_path).toBe(`${USERS.employer}/${pub[0]}`);
});

test("rasm emas (kengaytmasi .jpg) — tushunarli xato, e'longa hech narsa yozilmaydi", async ({ page, context }) => {
  await loginAs(context, USERS.employer);
  await openPhotoStep(page);

  await page.locator('input[type="file"]').setInputFiles({ name: "rasm.jpg", mimeType: "image/jpeg", buffer: Buffer.from("<html><script>alert(1)</script></html>") });
  await expect(page.getByRole("alert").filter({ hasText: "Rasmni o'qib bo'lmadi" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("img", { name: "Ish joyi surati" })).toHaveCount(0);
  expect(files("vacancy-photos")).toEqual([]);
  expect(files("vacancy-uploads")).toEqual([]); // rad etilgan xom fayl ham karantinda qolmaydi
});

/** Rasmsiz e'lon joylab, unga 0058 dan oldingi usuldagi (xom) rasm yo'lini yozish — mavjud ma'lumot taqlidi */
async function legacyVacancy(page: Page, withFile: boolean) {
  await openPhotoStep(page);
  await next(page);
  await page.getByRole("button", { name: /E'lonni joylash/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: /joylandi|saqlandi/i })).toBeVisible({ timeout: 30_000 });
  const legacy = `${USERS.employer}/0b000000-0000-4000-8000-0000000000aa.jpg`;
  if (withFile) {
    fs.mkdirSync(path.join(STORAGE, "vacancy-photos", USERS.employer), { recursive: true });
    fs.writeFileSync(path.join(STORAGE, "vacancy-photos", legacy), await photoWithGps());
  }
  const [v] = await sql<{ id: string }>("update public.vacancies set photo_path = $2 where owner_profile_id = $1 returning id", [USERS.employer, legacy]);
  return { id: v!.id, legacy };
}

async function editDescription(page: Page, id: string, text: string) {
  await page.goto(`/post/vacancy?edit=${id}&step=3`);
  await formReady(page);
  await page.locator("#desc").fill(text);
  await next(page);
  await page.getByRole("button", { name: /O'zgarishlarni saqlash|E'lonni joylash/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: /joylandi|saqlandi/i })).toBeVisible({ timeout: 30_000 });
}

test("eski e'lon: xom rasm tahrirda bir marta tekshirilgan nusxaga o'tadi", async ({ page, context }) => {
  await loginAs(context, USERS.employer);
  const { id } = await legacyVacancy(page, true);
  await editDescription(page, id, "Kichik do'konga buxgalter kerak, haftasiga 4 kun, tushlik bepul");
  const [v] = await sql<{ photo_path: string; description: string }>("select photo_path, description from public.vacancies where id = $1", [id]);
  expect(v!.description).toContain("4 kun");
  expect(v!.photo_path).toMatch(new RegExp(`^${USERS.employer}/v-[0-9a-f]{64}\\.webp$`));
  expect(fs.existsSync(path.join(STORAGE, "vacancy-photos", v!.photo_path))).toBe(true);
});

test("eski e'lon: rasm faylini o'qib bo'lmasa ham tahrir saqlanadi, rasm yo'li o'zgarmaydi", async ({ page, context }) => {
  await loginAs(context, USERS.employer);
  const { id, legacy } = await legacyVacancy(page, false);
  await editDescription(page, id, "Kichik do'konga buxgalter kerak, haftasiga 5 kun, tushlik bepul");
  const [v] = await sql<{ photo_path: string; description: string }>("select photo_path, description from public.vacancies where id = $1", [id]);
  expect(v!.description).toContain("5 kun");
  expect(v!.photo_path).toBe(legacy);
});
