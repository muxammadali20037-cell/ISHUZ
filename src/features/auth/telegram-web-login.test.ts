import { describe, expect, it } from "vitest";
import { WEB_LOGIN_CALLBACK, WEB_LOGIN_START_PREFIX, WEB_LOGIN_TOKEN, newSecret, parseWebLoginCookie, sha256hex, shortUserAgent } from "./telegram-web-login";

describe("Telegram orqali kodsiz kirish — yordamchilar", () => {
  it("token: 43 belgi base64url, /start parametri 64 dan oshmaydi", () => {
    const t = newSecret();
    expect(t).toMatch(WEB_LOGIN_TOKEN);
    expect(`${WEB_LOGIN_START_PREFIX}${t}`.length).toBeLessThanOrEqual(64);
    expect(newSecret()).not.toBe(t);
    expect(sha256hex(t)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("cookie: faqat to'g'ri ko'rinish qabul qilinadi", () => {
    const id = "0b9c8a3e-1f2d-4c5b-9a8e-7d6c5b4a3f21";
    const nonce = newSecret();
    expect(parseWebLoginCookie(`${id}.${nonce}`)).toEqual({ id, nonce });
    expect(parseWebLoginCookie(`${id}.short`)).toBeNull();
    expect(parseWebLoginCookie(undefined)).toBeNull();
    expect(parseWebLoginCookie(`x${id}.${nonce}`)).toBeNull();
  });

  it("callback: wl:<uuid> 64 baytga sig'adi", () => {
    const data = "wl:0b9c8a3e-1f2d-4c5b-9a8e-7d6c5b4a3f21";
    expect(data.length).toBeLessThanOrEqual(64);
    expect(WEB_LOGIN_CALLBACK.exec(data)?.[1]).toBe("0b9c8a3e-1f2d-4c5b-9a8e-7d6c5b4a3f21");
    expect(WEB_LOGIN_CALLBACK.test("wl:../../x")).toBe(false);
  });

  it("brauzer nomi qisqa va aniq", () => {
    expect(shortUserAgent("Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36")).toBe("Chrome · Android");
    expect(shortUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1")).toBe("Safari · iPhone");
    expect(shortUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 Edg/130.0")).toBe("Edge · Windows");
    expect(shortUserAgent("Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/130.0 YaBrowser/24.10 Safari/537.36")).toBe("Yandex · Windows");
    expect(shortUserAgent("")).toBeNull();
    expect(shortUserAgent("curl/8.0")).toBeNull();
  });
});
