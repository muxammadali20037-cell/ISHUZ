import { describe, expect, it } from "vitest";
import { socialHandle, socialLinks } from "./social";

describe("rasmiy ijtimoiy tarmoqlar", () => {
  it("@manzil URL'dan olinadi", () => {
    expect(socialHandle("https://t.me/ish_topdim_uz")).toBe("@ish_topdim_uz");
    expect(socialHandle("https://www.instagram.com/ishtopdim/")).toBe("@ishtopdim");
    expect(socialHandle("https://www.instagram.com/")).toBeNull();
    expect(socialHandle("http://t.me/x_y_z")).toBeNull();
    expect(socialHandle("not a url")).toBeNull();
  });
  it("faqat sozlangan va https havolalar, tartib: Telegram, Instagram, Facebook", () => {
    expect(socialLinks({ SOCIAL_INSTAGRAM_URL: "https://www.instagram.com/ishtopdim/", SOCIAL_TELEGRAM_URL: "https://t.me/ish_topdim_uz" })).toEqual([
      { key: "telegram", href: "https://t.me/ish_topdim_uz", handle: "@ish_topdim_uz" },
      { key: "instagram", href: "https://www.instagram.com/ishtopdim/", handle: "@ishtopdim" },
    ]);
    expect(socialLinks({ SOCIAL_FACEBOOK_URL: "javascript:alert(1)" })).toEqual([]);
    expect(socialLinks({})).toEqual([]);
  });
});
