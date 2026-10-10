import { afterEach, describe, expect, it, vi } from "vitest";
import { clientIp, ipBucket, isCrossSiteRequest, isJsonRequest, subjectHash } from "./request";

const h = (init: Record<string, string>) => new Headers(init);

describe("clientIp", () => {
  it("x-real-ip, keyin X-Forwarded-For ning birinchisi", () => {
    expect(clientIp(h({ "x-real-ip": "203.0.113.5", "x-forwarded-for": "198.51.100.1" }))).toBe("203.0.113.5");
    expect(clientIp(h({ "x-forwarded-for": "198.51.100.1, 10.0.0.1" }))).toBe("198.51.100.1");
    expect(clientIp(h({}))).toBe("unknown");
  });
});

describe("ipBucket", () => {
  it("IPv4 o'zgarmaydi", () => expect(ipBucket("203.0.113.5")).toBe("203.0.113.5"));
  it("IPv6 — /64 tarmoq (bir tarmoqdagi manzillar bitta chelak)", () => {
    expect(ipBucket("2001:db8:abcd:12:1:2:3:4")).toBe("2001:db8:abcd:12::/64");
    expect(ipBucket("2001:db8:abcd:12::9")).toBe("2001:db8:abcd:12::/64");
    expect(ipBucket("2001:DB8:ABCD:0012:ffff::1")).toBe("2001:db8:abcd:12::/64");
  });
  it("noto'g'ri satr — o'zi", () => expect(ipBucket("zz::zz::1")).toBe("zz::zz::1"));
});

describe("subjectHash", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("barqaror, turga bog'liq, ochiq qiymatni saqlamaydi", () => {
    vi.stubEnv("SECURITY_PEPPER", "test-pepper");
    const a = subjectHash("phone", "+998901234567");
    expect(a).toHaveLength(32);
    expect(a).toBe(subjectHash("phone", "+998901234567"));
    expect(a).not.toBe(subjectHash("ip", "+998901234567"));
    expect(a).not.toContain("998901234567");
  });
});

describe("isCrossSiteRequest", () => {
  const origin = "https://ishuz.vercel.app";
  it("o'z sayti va admin host — ruxsat", () => {
    expect(isCrossSiteRequest(h({ origin }), origin)).toBe(false);
    expect(isCrossSiteRequest(h({ origin: "https://admin.ishuz.uz" }), origin, ["https://admin.ishuz.uz"])).toBe(false);
  });
  it("boshqa sayt va 'null' origin — rad", () => {
    expect(isCrossSiteRequest(h({ origin: "https://evil.uz" }), origin)).toBe(true);
    expect(isCrossSiteRequest(h({ origin: "null" }), origin)).toBe(true);
  });
  it("Origin yo'q: Sec-Fetch-Site bo'yicha", () => {
    expect(isCrossSiteRequest(h({ "sec-fetch-site": "cross-site" }), origin)).toBe(true);
    expect(isCrossSiteRequest(h({ "sec-fetch-site": "same-site" }), origin)).toBe(true);
    expect(isCrossSiteRequest(h({ "sec-fetch-site": "same-origin" }), origin)).toBe(false);
    expect(isCrossSiteRequest(h({}), origin)).toBe(false);
  });
});

describe("isJsonRequest", () => {
  it("faqat application/json", () => {
    expect(isJsonRequest(h({ "content-type": "application/json; charset=utf-8" }))).toBe(true);
    expect(isJsonRequest(h({ "content-type": "text/plain" }))).toBe(false);
    expect(isJsonRequest(h({}))).toBe(false);
  });
});
