import { describe, expect, it } from "vitest";
import { googleLoginAllowedIn, isExternalAvatar, namesFromGoogle } from "./google-profile";

describe("Google orqali kirish: profil ma'lumoti", () => {
  it("given_name/family_name bo'lsa — o'sha", () => {
    expect(namesFromGoogle({ given_name: "Gulnora", family_name: "Karimova", full_name: "G K" })).toEqual({ first: "Gulnora", last: "Karimova" });
  });
  it("faqat to'liq ism — bo'linadi", () => {
    expect(namesFromGoogle({ full_name: "  Aziz   Rahimov  Olimovich " })).toEqual({ first: "Aziz", last: "Rahimov Olimovich" });
    expect(namesFromGoogle({ name: "Aziz" })).toEqual({ first: "Aziz", last: "" });
  });
  it("ism yo'q yoki email — olinmaydi; xavfli belgilar tozalanadi", () => {
    expect(namesFromGoogle({})).toBeNull();
    expect(namesFromGoogle(null)).toBeNull();
    expect(namesFromGoogle({ full_name: "aziz@gmail.com" })).toBeNull();
    expect(namesFromGoogle({ given_name: "<b>Ali</b>\u0000" })).toEqual({ first: "bAli/b", last: "" });
    expect(namesFromGoogle({ given_name: "A".repeat(100) })!.first).toHaveLength(60);
  });
  it("tashqi rasm havolasi", () => {
    expect(isExternalAvatar("https://lh3.googleusercontent.com/a/x")).toBe(true);
    expect(isExternalAvatar("avatars/u1/a.jpg")).toBe(false);
    expect(isExternalAvatar(null)).toBe(false);
  });
  it("o'rnatilgan oynalarda (Telegram, Instagram, WebView) tugma yo'q — Google bloklaydi", () => {
    const chrome = "Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36";
    expect(googleLoginAllowedIn(chrome, false)).toBe(true);
    expect(googleLoginAllowedIn(chrome, true)).toBe(false);
    expect(googleLoginAllowedIn("Mozilla/5.0 (Linux; Android 14; wv) AppleWebKit/537.36 Chrome/131.0 Mobile Safari/537.36", false)).toBe(false);
    expect(googleLoginAllowedIn("Mozilla/5.0 (iPhone) Instagram 300.0", false)).toBe(false);
    expect(googleLoginAllowedIn("Mozilla/5.0 (Linux; Android 14) Telegram-Android/11.2", false)).toBe(false);
  });
});
