import { afterEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => { throw new Error("tarmoq kutilmagan"); } }));
vi.mock("@/lib/security/events", () => ({ logSecurityEvent: vi.fn(async () => null) }));

const { finalizeVacancyPhoto, isVerifiedPhotoPath, reencodePhoto } = await import("./photo-finalize");

const A = "7e2e0000-0000-4000-8000-000000000001";
const B = "7e2e0000-0000-4000-8000-000000000002";
const HASH = "ab".repeat(32);

async function jpegWithExif(width: number, height: number, orientation = 1) {
  return sharp({ create: { width, height, channels: 3, background: { r: 200, g: 120, b: 40 } } })
    .jpeg()
    .withExif({ IFD0: { Artist: "Ali Valiyev", Copyright: "maxfiy", ImageDescription: "uy manzili" } })
    .withMetadata({ orientation })
    .toBuffer();
}

describe("reencodePhoto", () => {
  it("EXIF va boshqa metama'lumotlarni olib tashlaydi, WebP qiladi, o'lchamni 1600 px gacha kichraytiradi", async () => {
    const src = await jpegWithExif(3000, 2000);
    const before = await sharp(src).metadata();
    expect(before.exif).toBeDefined();
    const out = await reencodePhoto(src, "image/jpeg");
    expect(out).not.toBeNull();
    const meta = await sharp(out!).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.exif).toBeUndefined();
    expect(meta.icc).toBeUndefined();
    expect(meta.xmp).toBeUndefined();
    expect(Math.max(meta.width!, meta.height!)).toBe(1600);
    expect(out!.includes(Buffer.from("Ali Valiyev"))).toBe(false);
  });

  it("EXIF yo'nalishini qo'llaydi (telefon surati yonboshlab qolmaydi)", async () => {
    const out = await reencodePhoto(await jpegWithExif(800, 400, 6), "image/jpeg");
    const meta = await sharp(out!).metadata();
    expect([meta.width, meta.height]).toEqual([400, 800]);
    expect(meta.orientation).toBeUndefined();
  });

  it("kichik rasmni kattalashtirmaydi", async () => {
    const png = await sharp({ create: { width: 300, height: 200, channels: 4, background: "#0a0" } }).png().toBuffer();
    const meta = await sharp((await reencodePhoto(png, "image/png"))!).metadata();
    expect([meta.width, meta.height]).toEqual([300, 200]);
  });

  it("mazmuni kengaytmaga mos kelmasa — rad", async () => {
    const png = await sharp({ create: { width: 10, height: 10, channels: 3, background: "#fff" } }).png().toBuffer();
    expect(await reencodePhoto(png, "image/jpeg")).toBeNull();
    expect(await reencodePhoto(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>"), "image/png")).toBeNull();
  });

  it("sarlavhasi to'g'ri, lekin buzilgan fayl — rad (dekoder xatosi tashqariga chiqmaydi)", async () => {
    const broken = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(2000, 7)]);
    expect(await reencodePhoto(broken, "image/jpeg")).toBeNull();
  });

  it("bo'sh yoki 5 MB dan katta fayl — rad", async () => {
    expect(await reencodePhoto(Buffer.alloc(0), "image/jpeg")).toBeNull();
    const big = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(5 * 1024 * 1024)]);
    expect(await reencodePhoto(big, "image/jpeg")).toBeNull();
  });

  it("kichik fayl ichidagi ulkan rasm (piksel bombasi) — rad", async () => {
    const bomb = await sharp({ create: { width: 9000, height: 5000, channels: 3, background: "#000" } }).png({ compressionLevel: 9 }).toBuffer();
    expect(bomb.length).toBeLessThan(5 * 1024 * 1024);
    expect(await reencodePhoto(bomb, "image/png")).toBeNull();
  }, 20_000);
});

describe("isVerifiedPhotoPath", () => {
  it("faqat o'z papkasidagi v-<sha256>.webp", () => {
    expect(isVerifiedPhotoPath(A, `${A}/v-${HASH}.webp`)).toBe(true);
    expect(isVerifiedPhotoPath(B, `${A}/v-${HASH}.webp`)).toBe(false);
    expect(isVerifiedPhotoPath(A, `${A}/v-${HASH}.png`)).toBe(false);
    expect(isVerifiedPhotoPath(A, `${A}/v-${HASH.slice(2)}.webp`)).toBe(false);
    expect(isVerifiedPhotoPath(A, `${A}/0b000000-0000-4000-8000-000000000001.jpg`)).toBe(false);
    expect(isVerifiedPhotoPath(A, `${A}/../${B}/v-${HASH}.webp`)).toBe(false);
  });
});

describe("finalizeVacancyPhoto (tarmoqsiz holatlar)", () => {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  afterEach(() => {
    if (key === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = key;
  });

  it("tekshirilgan yo'l o'zgarmaydi (qayta ishlanmaydi)", async () => {
    expect(await finalizeVacancyPhoto(A, `${A}/v-${HASH}.webp`)).toEqual({ ok: true, path: `${A}/v-${HASH}.webp` });
  });

  it("boshqa foydalanuvchi papkasi yoki noma'lum nom — rad", async () => {
    expect(await finalizeVacancyPhoto(A, `${B}/0b000000-0000-4000-8000-000000000001.jpg`)).toEqual({ ok: false, error: "photo_invalid" });
    expect(await finalizeVacancyPhoto(A, `${A}/rasm.gif`)).toEqual({ ok: false, error: "photo_invalid" });
    expect(await finalizeVacancyPhoto(A, `${A}/v-${HASH}.webp/../x.jpg`)).toEqual({ ok: false, error: "photo_invalid" });
  });

  it("service kaliti bo'lmasa — 'tekshirib bo'lmadi', xom yo'l qabul qilinmaydi", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect(await finalizeVacancyPhoto(A, `${A}/0b000000-0000-4000-8000-000000000001.jpg`)).toEqual({ ok: false, error: "photo_unavailable" });
  });
});
