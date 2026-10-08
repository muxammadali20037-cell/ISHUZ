import { describe, expect, it } from "vitest";
import { adminHostRoute, sameHost } from "./admin-host";

describe("alohida admin host", () => {
  it("ADMIN_HOST yo'q — /admin asosiy hostda ishlaydi", () => {
    expect(adminHostRoute("ishtopdim.uz", "/admin", undefined)).toEqual({ kind: "pass", admin: true });
    expect(adminHostRoute("ishtopdim.uz", "/search", undefined)).toEqual({ kind: "pass", admin: false });
  });
  it("asosiy hostda /admin — 404", () => {
    expect(adminHostRoute("ishtopdim.uz", "/admin", "admin.ishtopdim.uz")).toEqual({ kind: "not_found" });
    expect(adminHostRoute("ishtopdim.uz", "/admin/users", "admin.ishtopdim.uz")).toEqual({ kind: "not_found" });
    expect(adminHostRoute("ishtopdim.uz", "/administrator", "admin.ishtopdim.uz")).toEqual({ kind: "pass", admin: false });
  });
  it("admin hostda ommaviy yo'llar panelga ko'chiriladi", () => {
    expect(adminHostRoute("admin.ishtopdim.uz", "/", "admin.ishtopdim.uz")).toEqual({ kind: "rewrite", path: "/admin" });
    expect(adminHostRoute("admin.ishtopdim.uz", "/moderation", "admin.ishtopdim.uz")).toEqual({ kind: "rewrite", path: "/admin/moderation" });
    expect(adminHostRoute("admin.ishtopdim.uz", "/admin/users", "admin.ishtopdim.uz")).toEqual({ kind: "pass", admin: true });
    expect(adminHostRoute("admin.ishtopdim.uz", "/auth", "admin.ishtopdim.uz")).toEqual({ kind: "pass", admin: true });
    expect(adminHostRoute("admin.ishtopdim.uz", "/api/auth/otp", "admin.ishtopdim.uz")).toEqual({ kind: "pass", admin: true });
  });
  it("port va katta-kichik harf", () => {
    expect(sameHost("Admin.IshTopdim.uz:443", "admin.ishtopdim.uz")).toBe(true);
    expect(sameHost("admin.localhost:3200", "admin.localhost:3200")).toBe(true);
    expect(sameHost("admin.localhost:3300", "admin.localhost:3200")).toBe(false);
    expect(sameHost("evil.uz", "admin.ishtopdim.uz")).toBe(false);
  });
});
