import { describe, expect, it } from "vitest";
import { jobSlugFromLink, vacancyStillOpen } from "./eligibility";

const NOW = Date.parse("2026-10-20T09:00:00Z");

describe("yuborish paytidagi tekshiruv", () => {
  it("e'lon faol va muddati o'tmagan bo'lsagina taklif qilinadi", () => {
    expect(vacancyStillOpen({ status: "active", expires_at: null }, NOW)).toBe(true);
    expect(vacancyStillOpen({ status: "active", expires_at: "2026-10-20T10:00:00Z" }, NOW)).toBe(true);
    // muddati o'tgan, lekin expire_vacancies hali ishlamagan (soatiga bir marta) — status hali "active"
    expect(vacancyStillOpen({ status: "active", expires_at: "2026-10-20T08:59:59Z" }, NOW)).toBe(false);
    expect(vacancyStillOpen({ status: "active", expires_at: "2026-10-20T09:00:00Z" }, NOW)).toBe(false);
    for (const status of ["paused", "closed", "expired", "draft", "pending_review", "rejected"]) {
      expect(vacancyStillOpen({ status, expires_at: null }, NOW)).toBe(false);
    }
    expect(vacancyStillOpen(null, NOW)).toBe(false);
    expect(vacancyStillOpen(undefined, NOW)).toBe(false);
  });

  it("AI PRO xabari havolasidan e'lon: faqat /jobs/<slug>", () => {
    expect(jobSlugFromLink("/jobs/kassir-abc123")).toBe("kassir-abc123");
    expect(jobSlugFromLink("/jobs/kassir-abc123?apply=1")).toBe("kassir-abc123");
    expect(jobSlugFromLink("/jobs/%D0%BA%D0%B0%D1%81")).toBe("кас");
    expect(jobSlugFromLink("/jobs/a/moslik")).toBeNull();
    expect(jobSlugFromLink("/applications")).toBeNull();
    expect(jobSlugFromLink("https://evil.example/jobs/x")).toBeNull();
    expect(jobSlugFromLink(null)).toBeNull();
  });
});
