import { describe, expect, it, vi } from "vitest";

// modul yuklanganda `publicEnv` darhol o'qiladi (ilovadagidek) — importdan oldin sinov qiymatlari
vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key-for-tests";
});

import { readPublicEnv } from "./env-public";

// avvalgi zod sxemasi bilan bir xil qoidalar: URL, kalit ≥ 10 belgi, APP_URL bo'lmasa — localhost
const ok = { url: "https://abc.supabase.co", anonKey: "eyJhbGciOiJIUzI1NiJ9.x", appUrl: "https://ishtopdim.uz" };

describe("ochiq muhit o'zgaruvchilari (zod'siz)", () => {
  it("to'g'ri qiymatlar o'zgarishsiz qaytadi", () => {
    expect(readPublicEnv(ok)).toEqual({ NEXT_PUBLIC_SUPABASE_URL: ok.url, NEXT_PUBLIC_SUPABASE_ANON_KEY: ok.anonKey, NEXT_PUBLIC_APP_URL: ok.appUrl });
  });

  it("APP_URL berilmasa — http://localhost:3000", () => {
    expect(readPublicEnv({ ...ok, appUrl: undefined }).NEXT_PUBLIC_APP_URL).toBe("http://localhost:3000");
  });

  it.each([
    ["Supabase manzili yo'q", { ...ok, url: undefined }],
    ["Supabase manzili URL emas", { ...ok, url: "abc.supabase.co" }],
    ["kalit yo'q", { ...ok, anonKey: undefined }],
    ["kalit juda qisqa", { ...ok, anonKey: "short" }],
    ["APP_URL bo'sh qator", { ...ok, appUrl: "" }],
    ["APP_URL URL emas", { ...ok, appUrl: "ishtopdim" }],
  ])("%s — tushunarli xato bilan to'xtaydi", (_, env) => {
    expect(() => readPublicEnv(env)).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });
});
