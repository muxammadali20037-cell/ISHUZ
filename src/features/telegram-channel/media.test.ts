import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CAPTION_LIMIT, CHANNEL_MEDIA, channelChatIdFrom, channelMedia, telegramLength } from "./media";

describe("channelChatIdFrom", () => {
  it("kanal havolasidan @nom oladi", () => {
    expect(channelChatIdFrom("https://t.me/ish_topdim_uz")).toBe("@ish_topdim_uz");
    expect(channelChatIdFrom("t.me/ish_topdim_uz/")).toBe("@ish_topdim_uz");
    expect(channelChatIdFrom("https://telegram.me/IshTopdim")).toBe("@IshTopdim");
    expect(channelChatIdFrom("  https://www.t.me/ish_topdim_uz  ")).toBe("@ish_topdim_uz");
  });

  it("@nom va -100… raqamni o'zgarishsiz qabul qiladi", () => {
    expect(channelChatIdFrom("@ish_topdim_uz")).toBe("@ish_topdim_uz");
    expect(channelChatIdFrom("-1001234567890")).toBe("-1001234567890");
  });

  it("taklif, xabar havolalari va bo'sh qiymat — null", () => {
    expect(channelChatIdFrom("https://t.me/+AbCdEf123")).toBeNull();
    expect(channelChatIdFrom("https://t.me/joinchat/AbCdEf")).toBeNull();
    expect(channelChatIdFrom("https://t.me/c/123456/7")).toBeNull();
    expect(channelChatIdFrom("https://t.me/ish_topdim_uz/15")).toBeNull();
    expect(channelChatIdFrom("https://example.com/ish_topdim_uz")).toBeNull();
    expect(channelChatIdFrom("")).toBeNull();
    expect(channelChatIdFrom(undefined)).toBeNull();
    expect(channelChatIdFrom("12345")).toBeNull();
  });
});

describe("CHANNEL_MEDIA", () => {
  it("tayyor izohlar Telegram izoh chegarasiga sig'adi", () => {
    for (const m of CHANNEL_MEDIA) expect(telegramLength(m.caption), m.id).toBeLessThanOrEqual(CAPTION_LIMIT);
  });

  it("fayllar mavjud va Telegram URL chegaralarida (video ≤ 20 MB, rasm ≤ 5 MB)", () => {
    for (const m of CHANNEL_MEDIA) {
      for (const f of [...m.files, m.poster]) {
        const path = join(process.cwd(), "public", f);
        expect(existsSync(path), f).toBe(true);
        const limit = f.endsWith(".mp4") ? 20 : 5;
        expect(statSync(path).size, f).toBeLessThan(limit * 1024 * 1024);
      }
    }
  });

  it("albomda 2–10 ta rasm bo'ladi (sendMediaGroup talabi)", () => {
    for (const m of CHANNEL_MEDIA.filter((x) => x.kind === "album")) {
      expect(m.files.length).toBeGreaterThanOrEqual(2);
      expect(m.files.length).toBeLessThanOrEqual(10);
    }
  });

  it("noma'lum id — null", () => {
    expect(channelMedia("manifest")?.kind).toBe("video");
    expect(channelMedia("nope")).toBeNull();
    expect(channelMedia(null)).toBeNull();
  });
});
