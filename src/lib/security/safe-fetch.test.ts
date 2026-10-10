import { afterEach, describe, expect, it, vi } from "vitest";
import { ContentMismatchError, fetchTrustedImage, FetchRejectedError } from "./safe-fetch";

const STORAGE = "https://ref.supabase.co/storage/v1/object/public/";
const isTrusted = (u: string) => u.startsWith(STORAGE) || /^https:\/\/t\.me\//.test(u);
const opts = { isTrusted, maxBytes: 64, types: new Set(["image/png", "image/jpeg"]) };
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);

function respond(status: number, headers: Record<string, string> = {}, body?: BodyInit) {
  return new Response(status >= 300 && status < 400 ? null : body ?? null, { status, headers });
}

afterEach(() => vi.unstubAllGlobals());

describe("fetchTrustedImage (SSRF)", () => {
  it("ishonchsiz manzil — so'rov yuborilmaydi", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    for (const url of ["http://169.254.169.254/latest/meta-data/", "http://localhost:5432/", "https://evil.example/x.png", "file:///etc/passwd"]) {
      await expect(fetchTrustedImage(url, opts)).rejects.toThrow("image_untrusted");
    }
    expect(fetch).not.toHaveBeenCalled();
  });

  it("ishonchli manzildan ichki tarmoqqa yo'naltirish — to'xtatiladi, ichki manzilga so'rov ketmaydi", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(respond(302, { location: "http://169.254.169.254/latest/meta-data/iam" }));
    vi.stubGlobal("fetch", fetch);
    await expect(fetchTrustedImage(`${STORAGE}avatars/u/a.png`, opts)).rejects.toThrow("image_untrusted");
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0]![1]).toMatchObject({ redirect: "manual" });
  });

  it("ishonchli zanjir ichidagi yo'naltirish — kuzatiladi; cheksiz zanjir — to'xtaydi", async () => {
    const ok = vi.fn()
      .mockResolvedValueOnce(respond(301, { location: "/storage/v1/object/public/avatars/u/b.png" }))
      .mockResolvedValueOnce(respond(200, { "content-type": "image/png" }, PNG));
    vi.stubGlobal("fetch", ok);
    const img = await fetchTrustedImage(`${STORAGE}avatars/u/a.png`, opts);
    expect(img.mimeType).toBe("image/png");
    expect(ok.mock.calls[1]![0]).toBe(`${STORAGE}avatars/u/b.png`);

    const loop = vi.fn().mockImplementation(async () => respond(302, { location: `${STORAGE}avatars/u/a.png` }));
    vi.stubGlobal("fetch", loop);
    await expect(fetchTrustedImage(`${STORAGE}avatars/u/a.png`, opts)).rejects.toThrow("image_redirects");
    expect(loop).toHaveBeenCalledTimes(4);
  });

  it("hajm: Content-Length yoki oqim chegaradan oshsa — rad", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(respond(200, { "content-type": "image/png", "content-length": "1000000" }, PNG)));
    await expect(fetchTrustedImage(`${STORAGE}a.png`, opts)).rejects.toThrow("image_too_large");
    const big = new Uint8Array(200);
    big.set(PNG);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(respond(200, { "content-type": "image/png" }, big)));
    await expect(fetchTrustedImage(`${STORAGE}a.png`, opts)).rejects.toThrow("image_too_large");
  });

  it("ruxsat etilmagan Content-Type va xato status — rad", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(respond(200, { "content-type": "image/svg+xml" }, "<svg/>")));
    await expect(fetchTrustedImage(`${STORAGE}a.svg`, opts)).rejects.toThrow("image_type");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(respond(404)));
    await expect(fetchTrustedImage(`${STORAGE}a.png`, opts)).rejects.toThrow("image_404");
  });

  it("image/png deb kelgan HTML — ContentMismatchError (niqoblangan fayl)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(respond(200, { "content-type": "image/png" }, "<html><script>x</script>")));
    const err = await fetchTrustedImage(`${STORAGE}a.png`, opts).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ContentMismatchError);
    expect(err).toBeInstanceOf(FetchRejectedError);
    expect((err as Error).message).toBe("image_content_mismatch");
  });

  it("haqiqiy PNG — qabul qilinadi", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(respond(200, { "content-type": "image/png; charset=binary" }, PNG)));
    const img = await fetchTrustedImage("https://t.me/i/userpic/320/abc.png", opts);
    expect(img.mimeType).toBe("image/png");
    expect(img.bytes.equals(Buffer.from(PNG))).toBe(true);
  });
});
