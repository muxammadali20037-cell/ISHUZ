import { afterEach, describe, expect, it, vi } from "vitest";
import { formatDate, formatDateTime, formatRelative } from "./index";

describe("formatDate: o'zbek imlosi", () => {
  const d = "2026-10-22T07:00:00Z"; // Toshkent: 12:00

  it("lotin: kun-oy chiziqcha bilan, oy kichik harf", () => {
    expect(formatDate(d, "uz")).toBe("22-oktabr 2026");
    expect(formatDateTime(d, "uz")).toBe("22-okt 2026, 12:00");
  });

  it("kirill: xuddi shu qoida", () => {
    expect(formatDate(d, "oz")).toBe("22-октабр 2026"); // oy imlosi — date-fns uzCyrl lokalidan
  });

  it("rus va ingliz — o'z qoidasi bilan (o'zgarmaydi)", () => {
    expect(formatDate(d, "ru")).toBe("22 октября 2026");
    expect(formatDate(d, "en")).toBe("22 October 2026");
  });

  it("boshqa naqsh (oy-yil) o'zgarmaydi", () => {
    expect(formatDate(d, "uz", "MMMM yyyy")).toBe("Oktabr 2026");
  });
});

describe("formatRelative", () => {
  afterEach(() => vi.useRealTimers());
  const now = new Date("2026-10-12T10:00:00Z");

  it("bir daqiqagacha — 'hozirgina' ('0 sekund oldin' emas)", () => {
    vi.useFakeTimers({ now });
    expect(formatRelative(now, "uz")).toBe("hozirgina");
    expect(formatRelative(new Date(now.getTime() - 30_000), "oz")).toBe("ҳозиргина");
    expect(formatRelative(new Date(now.getTime() - 5_000), "ru")).toBe("только что");
    expect(formatRelative(now, "en")).toBe("just now");
  });

  it("undan keyin — oddiy nisbiy vaqt", () => {
    vi.useFakeTimers({ now });
    expect(formatRelative(new Date(now.getTime() - 3 * 3600_000), "uz")).toBe("3 soat oldin");
    expect(formatRelative(new Date(now.getTime() - 3 * 3600_000), "en")).toBe("3 hours ago");
  });
});
