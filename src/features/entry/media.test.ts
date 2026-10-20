import { describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abc.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key-for-tests";
});

import { ENTRY_SLOTS, SLOT_GROUPS, SLOT_SPEC, entryMediaUrl, parseEntryMedia } from "./media";

const own = `site-media/entry/v-${"a".repeat(64)}.webp`;

describe("kirish ekranlari rasmlari", () => {
  it("faqat o'z storage'imizdagi qayta kodlangan fayl yo'li qabul qilinadi", () => {
    expect(parseEntryMedia({ intro_jobs: own, role_worker: null })).toEqual({ intro_jobs: own, role_worker: null });
    for (const bad of ["https://evil.example/x.webp", "site-media/windows/v-" + "a".repeat(64) + ".webp", "site-media/entry/../x.webp", "javascript:alert(1)"]) {
      expect(parseEntryMedia({ intro_jobs: bad })).toEqual({});
    }
    expect(parseEntryMedia(null)).toEqual({});
    expect(parseEntryMedia("x")).toEqual({});
  });

  it("ommaviy manzil — Supabase storage, yaroqsiz yo'lga null (o'rnatilgan tasvir)", () => {
    expect(entryMediaUrl(own)).toBe(`https://abc.supabase.co/storage/v1/object/public/${own}`);
    expect(entryMediaUrl("https://evil.example/x.webp")).toBeNull();
    expect(entryMediaUrl(null)).toBeNull();
  });

  it("har joyning nisbati va o'lchami ko'rsatilgan", () => {
    for (const s of ENTRY_SLOTS) expect(SLOT_SPEC[s].size).toMatch(/^\d+×\d+$/);
  });

  it("admin sahifasida har joy aynan bitta guruhda (yo'qolgan yoki takrorlangan joy yo'q)", () => {
    const grouped = Object.values(SLOT_GROUPS).flat();
    expect([...grouped].sort()).toEqual([...ENTRY_SLOTS].sort());
    for (const s of SLOT_GROUPS.tiles) expect(SLOT_SPEC[s].ratio).toBe("16:9");
  });

  it("plitka rasmlari ham faqat o'z storage'imizdan", () => {
    expect(parseEntryMedia({ tile_near_workers: own })).toEqual({ tile_near_workers: own });
    expect(parseEntryMedia({ tile_daily_workers: "https://evil.example/x.webp" })).toEqual({});
  });
});
