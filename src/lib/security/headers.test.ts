import { describe, expect, it } from "vitest";
import { adminSecurityHeaders, baseSecurityHeaders, buildCsp } from "./headers";

const SB = "https://abcd.supabase.co";
const dir = (csp: string, name: string) => csp.split("; ").find((d) => d === name || d.startsWith(`${name} `)) ?? null;

describe("buildCsp", () => {
  const csp = buildCsp({ supabaseUrl: SB });

  it("plagin, <base> va begona forma yo'q", () => {
    expect(dir(csp, "object-src")).toBe("object-src 'none'");
    expect(dir(csp, "base-uri")).toBe("base-uri 'self'");
    expect(dir(csp, "form-action")).toBe("form-action 'self'");
    expect(dir(csp, "default-src")).toBe("default-src 'self'");
  });

  it("tashqi manbalar faqat ro'yxatdagilar (Supabase, Telegram)", () => {
    expect(dir(csp, "script-src")).toBe("script-src 'self' 'unsafe-inline' https://telegram.org");
    expect(dir(csp, "connect-src")).toBe(`connect-src 'self' ${SB} wss://abcd.supabase.co`);
    expect(dir(csp, "img-src")).toContain(SB);
    expect(dir(csp, "img-src")).not.toContain("*.supabase.co");
    expect(csp).not.toContain("'unsafe-eval'");
  });

  it("asosiy sayt: faqat o'zi va Telegram Web ramkaga oladi; admin — hech kim", () => {
    expect(dir(csp, "frame-ancestors")).toBe("frame-ancestors 'self' https://web.telegram.org https://webk.telegram.org https://webz.telegram.org");
    expect(dir(buildCsp({ supabaseUrl: SB, admin: true }), "frame-ancestors")).toBe("frame-ancestors 'none'");
  });

  it("prod: http so'rovlar https ga; dev: eval va ws (HMR)", () => {
    expect(dir(csp, "upgrade-insecure-requests")).toBe("upgrade-insecure-requests");
    const dev = buildCsp({ supabaseUrl: "http://127.0.0.1:54321", dev: true });
    expect(dir(dev, "script-src")).toContain("'unsafe-eval'");
    expect(dir(dev, "connect-src")).toContain("ws://127.0.0.1:54321");
    expect(dir(dev, "upgrade-insecure-requests")).toBeNull();
  });

  it("noto'g'ri Supabase URL — e'tiborsiz (CSP buzilmaydi)", () => {
    expect(dir(buildCsp({ supabaseUrl: "javascript:alert(1)" }), "connect-src")).toBe("connect-src 'self'");
  });
});

describe("sarlavhalar", () => {
  it("asosiy: HSTS, nosniff, COOP", () => {
    const keys = baseSecurityHeaders({ supabaseUrl: SB }).map((h) => h.key);
    expect(keys).toEqual(expect.arrayContaining(["Strict-Transport-Security", "X-Content-Type-Options", "Cross-Origin-Opener-Policy", "Content-Security-Policy"]));
    expect(baseSecurityHeaders({ supabaseUrl: SB, dev: true }).map((h) => h.key)).not.toContain("Strict-Transport-Security");
  });
  it("admin: X-Frame-Options DENY", () => {
    const h = Object.fromEntries(adminSecurityHeaders({ supabaseUrl: SB }).map((x) => [x.key, x.value]));
    expect(h["X-Frame-Options"]).toBe("DENY");
    expect(h["Content-Security-Policy"]).toContain("frame-ancestors 'none'");
  });
});
