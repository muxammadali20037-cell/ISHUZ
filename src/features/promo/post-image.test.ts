import { beforeEach, describe, expect, it, vi } from "vitest";

/** Post rasmidagi AI surat: faqat o'z saqlovimizdan yuklanadi (begona manzil — yo'q), xatoda — rasmsiz shablon */
vi.mock("server-only", () => ({}));
vi.mock("next/og", () => ({ ImageResponse: class {} }));
vi.mock("@/lib/env", () => ({ publicEnv: { NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co" } }));

const { inlinePhoto } = await import("./post-image");
const OWN = "https://abc.supabase.co/storage/v1/object/public/listing-images/vacancy/x-1.jpg";

describe("inlinePhoto", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(Buffer.from("jpg"), { status: 200, headers: { "content-type": "image/jpeg" } })));
  });

  it("o'z saqlovimizdagi rasm — data URL", async () => {
    expect(await inlinePhoto(OWN)).toBe(`data:image/jpeg;base64,${Buffer.from("jpg").toString("base64")}`);
  });

  it("begona manzil va bo'sh qiymat — so'rovsiz null", async () => {
    expect(await inlinePhoto("https://evil.example/a.jpg")).toBeNull();
    expect(await inlinePhoto("http://169.254.169.254/latest")).toBeNull();
    expect(await inlinePhoto(null)).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rasm emas yoki xato — null (post rasmi baribir chiziladi)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>", { status: 200, headers: { "content-type": "text/html" } })));
    expect(await inlinePhoto(OWN)).toBeNull();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 404 })));
    expect(await inlinePhoto(OWN)).toBeNull();
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("timeout"))));
    expect(await inlinePhoto(OWN)).toBeNull();
  });
});
