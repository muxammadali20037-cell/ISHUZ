import { describe, expect, it } from "vitest";
import { isoToTashkent, tashkentToIso, tashkentToday } from "./tashkent-time";

describe("tashkent-time", () => {
  it("maydonlar → ISO (+05:00)", () => {
    expect(tashkentToIso("2026-10-03", "10:30")).toBe("2026-10-03T10:30:00+05:00");
    expect(tashkentToIso("2026-10-03", "")).toBeNull();
    expect(tashkentToIso("03.10.2026", "10:30")).toBeNull();
  });
  it("ISO → Toshkent vaqti (UTC dan +5)", () => {
    expect(isoToTashkent("2026-10-03T05:30:00Z")).toEqual({ date: "2026-10-03", time: "10:30" });
    expect(isoToTashkent("2026-10-03T21:00:00Z")).toEqual({ date: "2026-10-04", time: "02:00" });
  });
  it("bugun Toshkentda", () => {
    expect(tashkentToday(new Date("2026-10-03T20:00:00Z"))).toBe("2026-10-04");
  });
});
