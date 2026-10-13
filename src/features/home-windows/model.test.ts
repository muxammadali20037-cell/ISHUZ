import { describe, expect, it } from "vitest";
import { DEFAULT_WINDOWS, parseWindows, windowAudience, windowsFor, type HomeWindow } from "./model";

const w = (id: string, href: string, extra: Partial<HomeWindow> = {}): HomeWindow => ({ id, enabled: true, art: "jobs", image: null, href, title: {}, desc: {}, ...extra });

describe("bosh sahifa oynalari: kimga ko'rinadi", () => {
  it("standart oynalar: ish izlovchiga 3 ta, ish beruvchiga 3 ta, aralashmaydi", () => {
    expect(windowsFor("worker", DEFAULT_WINDOWS).map((x) => x.id)).toEqual(["jobs", "daily", "near_jobs"]);
    expect(windowsFor("employer", DEFAULT_WINDOWS).map((x) => x.id)).toEqual(["workers", "near_workers", "post_vacancy"]);
  });

  it("eski yozuv (auditoriyasiz) — havoladan aniqlanadi", () => {
    expect(windowAudience(w("a", "/search?mode=jobs&pay=daily"))).toBe("worker");
    expect(windowAudience(w("b", "/search?mode=workers"))).toBe("employer");
    expect(windowAudience(w("c", "/post/vacancy"))).toBe("employer");
    expect(windowAudience(w("d", "/post/worker"))).toBe("worker");
    expect(windowAudience(w("e", "/help"))).toBe("all");
    // "mode=workers" "mode=jobs" bilan adashtirilmaydi
    expect(windowAudience(w("f", "/search?mode=jobsx"))).toBe("all");
  });

  it("admin tanlovi ustun; o'chirilgani va boshqa rejimniki ko'rinmaydi; 'hammaga' — ikkalasiga", () => {
    const list = [w("a", "/search?mode=jobs", { audience: "employer" }), w("b", "/help", { audience: "all" }), w("c", "/search?mode=jobs", { enabled: false })];
    expect(windowsFor("worker", list).map((x) => x.id)).toEqual(["b"]);
    expect(windowsFor("employer", list).map((x) => x.id)).toEqual(["a", "b"]);
  });

  it("D6 dagi saqlangan 3 oyna (auditoriyasiz) ham o'qiladi", () => {
    const old = parseWindows([
      { id: "workers", enabled: true, art: "workers", image: null, href: "/search?mode=workers", title: {}, desc: {} },
      { id: "jobs", enabled: true, art: "jobs", image: null, href: "/search?mode=jobs", title: {}, desc: {} },
      { id: "daily", enabled: true, art: "daily", image: null, href: "/search?mode=jobs&pay=daily", title: {}, desc: {} },
    ]);
    expect(windowsFor("worker", old).map((x) => x.id)).toEqual(["jobs", "daily"]);
    expect(windowsFor("employer", old).map((x) => x.id)).toEqual(["workers"]);
  });
});
