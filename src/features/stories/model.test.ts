import { describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abc.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key-for-tests";
});

import { forAudience, isLive, isSafeCtaUrl, orderBySeen, storyInputSchema, toStory, videoSignatureOk, type StoryRow } from "./model";

const SHA = "a".repeat(64);
const IMG = `site-media/stories/v-${SHA}.webp`;
const VID = "story-videos/v/0b9c8a3e-1f2d-4c5b-9a8e-7d6c5b4a3f21.mp4";

const row = (over: Partial<StoryRow> = {}): StoryRow => ({
  id: "s1",
  title: "Yangi imkoniyat",
  caption: null,
  media_kind: "image",
  media_path: IMG,
  poster_path: null,
  cta_label: null,
  cta_url: null,
  audience: "all",
  duration_sec: 7,
  is_active: true,
  starts_at: "2026-11-14T00:00:00Z",
  ends_at: null,
  sort_order: 0,
  created_at: "2026-11-14T00:00:00Z",
  ...over,
});

describe("hikoyalar modeli", () => {
  it("reklama tugmasi: faqat sayt ichidagi yo'l yoki https", () => {
    for (const ok of ["/", "/jobs", "/post/vacancy?x=1", "https://t.me/ishtopdim", "https://ishuz.vercel.app/ustalar"]) expect(isSafeCtaUrl(ok), ok).toBe(true);
    for (const bad of ["javascript:alert(1)", "//evil.com", "/\\evil.com", "http://evil.com", "data:text/html,x", "https://u:p@x.com", "https://x.com/a b", ""]) expect(isSafeCtaUrl(bad), bad).toBe(false);
  });

  it("muddat: boshlanmagan, tugagan va o'chirilgan ko'rinmaydi", () => {
    const now = new Date("2026-11-15T00:00:00Z").getTime();
    expect(isLive(row(), now)).toBe(true);
    expect(isLive(row({ starts_at: "2026-11-16T00:00:00Z" }), now)).toBe(false);
    expect(isLive(row({ ends_at: "2026-11-14T12:00:00Z" }), now)).toBe(false);
    expect(isLive(row({ is_active: false }), now)).toBe(false);
  });

  it("auditoriya: mehmonga faqat 'hammaga'; rejimdagiga — o'ziniki ham", () => {
    const rows = [row({ id: "a", audience: "all" }), row({ id: "s", audience: "seeker" }), row({ id: "e", audience: "employer" })];
    expect(forAudience(rows, null).map((r) => r.id)).toEqual(["a"]);
    expect(forAudience(rows, "seeker").map((r) => r.id)).toEqual(["a", "s"]);
    expect(forAudience(rows, "employer").map((r) => r.id)).toEqual(["a", "e"]);
  });

  it("qatordan hikoya: begona yo'l yoki xavfli havola o'tmaydi", () => {
    expect(toStory(row())?.posterUrl).toContain(`/storage/v1/object/public/${IMG}`);
    expect(toStory(row({ media_path: "https://evil.com/x.webp" }))).toBeNull();
    expect(toStory(row({ media_kind: "video", media_path: IMG }))).toBeNull();
    expect(toStory(row({ media_kind: "video", media_path: VID }))?.posterUrl).toBeNull();
    expect(toStory(row({ cta_label: "Ko'rish", cta_url: "javascript:alert(1)" }))?.ctaUrl).toBeNull();
    expect(toStory(row({ cta_label: "Ko'rish", cta_url: "/jobs" }))).toMatchObject({ ctaLabel: "Ko'rish", ctaUrl: "/jobs" });
  });

  it("video imzosi: kengaytmaga ishonilmaydi", () => {
    const mp4 = new Uint8Array([0, 0, 0, 0x18, ...Buffer.from("ftypisom")]);
    const webm = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0, 0, 0, 0, 0]);
    const html = new Uint8Array(Buffer.from("<html><script>"));
    expect(videoSignatureOk(mp4, "mp4")).toBe(true);
    expect(videoSignatureOk(mp4, "mov")).toBe(true);
    expect(videoSignatureOk(webm, "webm")).toBe(true);
    expect(videoSignatureOk(webm, "mp4")).toBe(false);
    expect(videoSignatureOk(html, "mp4")).toBe(false);
    expect(videoSignatureOk(new Uint8Array(4), "webm")).toBe(false);
  });

  it("forma: rasm/video yo'li turiga mos, tugma matni va havolasi birga", () => {
    const base = { title: "  Yangi   imkoniyat ", kind: "image" as const, mediaPath: IMG, audience: "all" as const, durationSec: 7, days: 7, isActive: true };
    expect(storyInputSchema.parse(base).title).toBe("Yangi imkoniyat");
    expect(storyInputSchema.safeParse({ ...base, kind: "video" }).success).toBe(false);
    expect(storyInputSchema.safeParse({ ...base, kind: "video", mediaPath: VID }).success).toBe(true);
    expect(storyInputSchema.safeParse({ ...base, ctaLabel: "Ko'rish" }).success).toBe(false);
    expect(storyInputSchema.safeParse({ ...base, ctaLabel: "Ko'rish", ctaUrl: "//evil.com" }).success).toBe(false);
    expect(storyInputSchema.safeParse({ ...base, ctaLabel: "Ko'rish", ctaUrl: "/post/vacancy" }).success).toBe(true);
    expect(storyInputSchema.safeParse({ ...base, title: "   " }).success).toBe(false);
  });

  it("ko'rilmaganlar oldinda", () => {
    expect(orderBySeen([{ id: "a" }, { id: "b" }, { id: "c" }], new Set(["a"])).map((s) => s.id)).toEqual(["b", "c", "a"]);
  });
});
