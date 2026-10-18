import { describe, expect, it } from "vitest";
import { phoneLoginHref } from "./auth-links";

describe("telefon orqali kirish manzili", () => {
  it("rol tanlanmagan qurilmada — avval rol, keyin raqam", () => {
    expect(phoneLoginHref({ next: "/start", mode: null })).toBe(`/start/rol?next=${encodeURIComponent("/auth/telefon?next=%2Fstart")}`);
  });

  it("rol tanlangan — to'g'ridan-to'g'ri raqam (e'londa yozilgan raqam saqlanadi)", () => {
    expect(phoneLoginHref({ next: "/start", mode: "worker" })).toBe("/auth/telefon?next=%2Fstart");
    expect(phoneLoginHref({ next: "/post/worker?step=4", mode: "employer", phone: "+998901234567" })).toBe("/auth/telefon?next=%2Fpost%2Fworker%3Fstep%3D4&phone=%2B998901234567");
  });

  it("admin panelga kirish — rol so'ralmaydi (alohida admin domenida /start yo'q)", () => {
    expect(phoneLoginHref({ next: "/admin", mode: null })).toBe("/auth/telefon?next=%2Fadmin");
    expect(phoneLoginHref({ next: "/admin/entry?x=1", mode: null })).toBe("/auth/telefon?next=%2Fadmin%2Fentry%3Fx%3D1");
    expect(phoneLoginHref({ next: "/administrator", mode: null })).toContain("/start/rol");
  });
});
