import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";

vi.mock("server-only", () => ({}));
const events = vi.hoisted(() => ({ log: vi.fn(async () => null) }));
vi.mock("@/lib/security/events", () => ({ logSecurityEvent: events.log }));

/** Xotiradagi Storage: bucket → (yo'l → baytlar) */
const store = vi.hoisted(() => ({ files: new Map<string, Map<string, Buffer>>() }));
const bucket = (b: string) => {
  if (!store.files.has(b)) store.files.set(b, new Map());
  return store.files.get(b)!;
};
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    storage: {
      from: (b: string) => ({
        download: async (p: string) => {
          const f = bucket(b).get(p);
          return f ? { data: new Blob([new Uint8Array(f)]), error: null } : { data: null, error: { message: "not found" } };
        },
        upload: async (p: string, body: Buffer) => {
          bucket(b).set(p, Buffer.from(body));
          return { data: { path: p }, error: null };
        },
        remove: async (paths: string[]) => {
          const gone = paths.filter((p) => bucket(b).delete(p));
          return { data: gone.map((name) => ({ name })), error: null };
        },
        list: async (folder: string) => ({
          data: [...bucket(b).keys()].filter((k) => k.startsWith(`${folder}/`)).map((k) => ({ name: k.slice(folder.length + 1) })),
          error: null,
        }),
      }),
    },
  }),
}));

const { finalizeMedia, pruneMedia } = await import("./finalize");
const { isLegacyMediaPath, isRawMediaPath, isVerifiedMediaPath, legacyMediaPath, rawMediaPath } = await import("./paths");

const U = "7e2e0000-0000-4000-8000-000000000001";
const OTHER = "7e2e0000-0000-4000-8000-000000000002";
const C = "c0000000-0000-4000-8000-0000000000aa";
const ID = "11111111-2222-4333-8444-555555555555";

const jpegWithExif = (w: number, h: number) =>
  sharp({ create: { width: w, height: h, channels: 3, background: { r: 200, g: 120, b: 40 } } })
    .jpeg()
    .withExif({ IFD0: { Artist: "Ali Valiyev uy manzili", Copyright: "maxfiy" } })
    .toBuffer();

describe("media yo'llari", () => {
  it("karantin: faqat <tur>/<egasi>/<uuid>.<jpg|png|webp>", () => {
    expect(rawMediaPath("avatar", U, "jpg", ID)).toBe(`avatar/${U}/${ID}.jpg`);
    expect(isRawMediaPath("avatar", U, `avatar/${U}/${ID}.jpg`)).toBe(true);
    expect(isRawMediaPath("avatar", U, `avatar/${OTHER}/${ID}.jpg`)).toBe(false);
    expect(isRawMediaPath("avatar", U, `logo/${U}/${ID}.jpg`)).toBe(false);
    expect(isRawMediaPath("avatar", U, `avatar/${U}/${ID}.svg`)).toBe(false);
    expect(isRawMediaPath("avatar", U, `avatar/${U}/../${ID}.jpg`)).toBe(false);
    expect(isRawMediaPath("logo", C, `logo/${C}/${ID}.png`)).toBe(true);
    expect(isRawMediaPath("logo", "not-a-uuid", `logo/not-a-uuid/${ID}.png`)).toBe(false);
  });

  it("eski nom va tekshirilgan nom", () => {
    expect(legacyMediaPath("avatar", U, "png")).toBe(`${U}/avatar.png`);
    expect(isLegacyMediaPath("avatar", U, `${U}/avatar.png`)).toBe(true);
    expect(isLegacyMediaPath("avatar", U, `${OTHER}/avatar.png`)).toBe(false);
    expect(isLegacyMediaPath("logo", C, `${C}/logo.webp`)).toBe(true);
    expect(isLegacyMediaPath("logo", C, `${C}/avatar.webp`)).toBe(false);
    expect(isVerifiedMediaPath(U, `${U}/v-${"ab".repeat(32)}.webp`)).toBe(true);
    expect(isVerifiedMediaPath(U, `${U}/v-${"ab".repeat(32)}.jpg`)).toBe(false);
    expect(isVerifiedMediaPath(U, `${OTHER}/v-${"ab".repeat(32)}.webp`)).toBe(false);
  });
});

describe("finalizeMedia", () => {
  beforeEach(() => {
    store.files.clear();
    events.log.mockClear();
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test";
  });
  afterEach(() => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  it("profil rasmi: karantindan → EXIF'siz WebP (≤640 px), mazmun xeshi nomi, xom fayl o'chadi", async () => {
    const raw = `avatar/${U}/${ID}.jpg`;
    bucket("media-uploads").set(raw, await jpegWithExif(2000, 1500));
    const r = await finalizeMedia("avatar", U, raw, U);
    expect(r.ok).toBe(true);
    const path = (r as { path: string }).path;
    expect(isVerifiedMediaPath(U, path)).toBe(true);
    const out = bucket("avatars").get(path)!;
    const meta = await sharp(out).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.exif).toBeUndefined();
    expect(Math.max(meta.width!, meta.height!)).toBe(640);
    expect(out.includes(Buffer.from("Ali Valiyev"))).toBe(false);
    expect(bucket("media-uploads").has(raw)).toBe(false);
  });

  it("logotip: eski nomdan (0059 dan oldingi yuklash) ham qayta kodlanadi, ≤512 px", async () => {
    const legacy = `${C}/logo.png`;
    bucket("company-logos").set(legacy, await sharp({ create: { width: 1200, height: 1200, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer());
    const r = await finalizeMedia("logo", C, legacy, U);
    expect(r.ok).toBe(true);
    const meta = await sharp(bucket("company-logos").get((r as { path: string }).path)!).metadata();
    expect(meta.width).toBe(512);
    expect(meta.hasAlpha).toBe(true);
    expect(bucket("company-logos").has(legacy)).toBe(false);
  });

  it("rasm emas (.jpg nomli matn / SVG) — rad etiladi, xom fayl o'chadi, xavfsizlik hodisasi yoziladi", async () => {
    const raw = `avatar/${U}/${ID}.jpg`;
    bucket("media-uploads").set(raw, Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>"));
    expect(await finalizeMedia("avatar", U, raw, U)).toEqual({ ok: false, error: "media_invalid" });
    expect(bucket("media-uploads").has(raw)).toBe(false);
    expect([...bucket("avatars").keys()]).toEqual([]);
    expect(events.log).toHaveBeenCalledWith(expect.objectContaining({ type: "upload.content_rejected", reason: "avatar_upload" }));
  });

  it("begona egasi yo'li va noto'g'ri nom — fayl o'qilmaydi", async () => {
    bucket("media-uploads").set(`avatar/${OTHER}/${ID}.jpg`, await jpegWithExif(100, 100));
    expect(await finalizeMedia("avatar", U, `avatar/${OTHER}/${ID}.jpg`, U)).toEqual({ ok: false, error: "media_invalid" });
    expect(await finalizeMedia("avatar", U, `${U}/photo.jpg`, U)).toEqual({ ok: false, error: "media_invalid" });
    expect(bucket("media-uploads").has(`avatar/${OTHER}/${ID}.jpg`)).toBe(true);
  });

  it("tekshirilgan yo'l o'zgarmaydi; server kaliti yo'q — media_unavailable", async () => {
    const v = `${U}/v-${"cd".repeat(32)}.webp`;
    expect(await finalizeMedia("avatar", U, v, U)).toEqual({ ok: true, path: v });
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect(await finalizeMedia("avatar", U, `avatar/${U}/${ID}.jpg`, U)).toEqual({ ok: false, error: "media_unavailable" });
  });

  it("pruneMedia: egasi papkasida faqat yangi rasm qoladi", async () => {
    const keep = `${U}/v-${"ab".repeat(32)}.webp`;
    for (const p of [keep, `${U}/v-${"cd".repeat(32)}.webp`, `${U}/avatar.jpg`, `${OTHER}/avatar.jpg`]) bucket("avatars").set(p, Buffer.from("x"));
    await pruneMedia("avatar", U, keep);
    expect([...bucket("avatars").keys()].sort()).toEqual([`${OTHER}/avatar.jpg`, keep].sort());
    await pruneMedia("avatar", U, null);
    expect([...bucket("avatars").keys()]).toEqual([`${OTHER}/avatar.jpg`]);
  });
});
