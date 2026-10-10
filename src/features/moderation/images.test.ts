import { describe, expect, it } from "vitest";
import { isTelegramGeneratedAvatar } from "./images";

describe("isTelegramGeneratedAvatar", () => {
  it("faqat Telegram'ning avtomatik SVG avatari", () => {
    expect(isTelegramGeneratedAvatar("https://t.me/i/userpic/320/Km1F0jBxlfnxRhXv-JvbrsAfUC-KD-OO7XWw5L6OivElIjnxhjdgzMAMJJ-v_g5R.svg")).toBe(true);
    expect(isTelegramGeneratedAvatar("https://t.me/i/userpic/320/abc.jpg")).toBe(false); // haqiqiy rasm — tekshiriladi
    expect(isTelegramGeneratedAvatar("https://evil.example/i/userpic/320/x.svg")).toBe(false);
    expect(isTelegramGeneratedAvatar("http://t.me/i/userpic/320/x.svg")).toBe(false);
    expect(isTelegramGeneratedAvatar("vacancy-photos/a/b.png")).toBe(false);
    expect(isTelegramGeneratedAvatar(null)).toBe(false);
  });
});
