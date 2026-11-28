import { describe, expect, it } from "vitest";
import { maintenanceBody, maintenanceOn, maintenanceOpen } from "./maintenance";

describe("texnik ishlar rejimi", () => {
  it("faqat MAINTENANCE_MODE=1 (yoki true) bo'lsa yoqiladi", () => {
    expect(maintenanceOn({})).toBe(false);
    expect(maintenanceOn({ MAINTENANCE_MODE: "0" })).toBe(false);
    expect(maintenanceOn({ MAINTENANCE_MODE: "" })).toBe(false);
    expect(maintenanceOn({ MAINTENANCE_MODE: "1" })).toBe(true);
    expect(maintenanceOn({ MAINTENANCE_MODE: "true" })).toBe(true);
  });
  it("faqat /api/health ochiq; webhook va cron ham yopiq (Telegram keyin qayta yuboradi)", () => {
    expect(maintenanceOpen("/api/health")).toBe(true);
    for (const p of ["/", "/jobs", "/api/telegram/webhook", "/api/cron/tick", "/api/payments/payme", "/admin"]) expect(maintenanceOpen(p)).toBe(false);
  });
  it("API — JSON, sahifa — uch tilda HTML, tashqi resurssiz", () => {
    expect(maintenanceBody("/api/cron/tick")).toEqual({ body: '{"ok":false,"error":"maintenance"}', contentType: "application/json; charset=utf-8" });
    const page = maintenanceBody("/jobs");
    expect(page.contentType).toBe("text/html; charset=utf-8");
    expect(page.body).toContain("Texnik ishlar olib borilmoqda");
    expect(page.body).toContain("Идут технические работы");
    expect(page.body).not.toMatch(/https?:\/\/|<script|#[0-9a-f]{3,6}\b/i);
  });
});
