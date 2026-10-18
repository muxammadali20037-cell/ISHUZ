import { describe, expect, it } from "vitest";
import { canDisableVerticalSwipes, hexColor, insetVars, versionAtLeast, wantsFullscreen } from "./fullscreen";

describe("Telegram Mini App: to'liq ekran qoidalari", () => {
  it("versiyalar son sifatida taqqoslanadi (7.10 > 7.7)", () => {
    expect(versionAtLeast("7.10", "7.7")).toBe(true);
    expect(versionAtLeast("8.0", "8.0")).toBe(true);
    expect(versionAtLeast("7.9", "8.0")).toBe(false);
    expect(versionAtLeast("9", "8.0")).toBe(true);
    expect(versionAtLeast(undefined, "6.0")).toBe(false);
  });

  it("to'liq ekran — faqat telefonda va Bot API 8.0+ da; kompyuter Telegram'ida — yo'q", () => {
    expect(wantsFullscreen("android", "8.0")).toBe(true);
    expect(wantsFullscreen("ios", "9.1")).toBe(true);
    expect(wantsFullscreen("android", "7.10")).toBe(false);
    for (const p of ["tdesktop", "macos", "web", "weba", "webk", "unknown"]) expect(wantsFullscreen(p, "9.0")).toBe(false);
  });

  it("aylantirganda yopilib qolmaslik — 7.7+", () => {
    expect(canDisableVerticalSwipes("7.7")).toBe(true);
    expect(canDisableVerticalSwipes("7.6")).toBe(false);
  });

  it("chetlar CSS o'zgaruvchilariga (manfiy yoki yo'q qiymat — 0)", () => {
    const v = insetVars({ top: 47.4, bottom: 34 }, { top: 46, bottom: -1 });
    expect(v["--tg-safe-area-inset-top"]).toBe("47px");
    expect(v["--tg-safe-area-inset-bottom"]).toBe("34px");
    expect(v["--tg-safe-area-inset-left"]).toBe("0px");
    expect(v["--tg-content-safe-area-inset-top"]).toBe("46px");
    expect(v["--tg-content-safe-area-inset-bottom"]).toBe("0px");
    expect(Object.keys(insetVars(undefined, undefined))).toHaveLength(8);
  });

  it("panel ranglari faqat #rrggbb ko'rinishida", () => {
    expect(hexColor(" #F6F8FB ")).toBe("#f6f8fb");
    expect(hexColor("#fff")).toBe("#ffffff");
    expect(hexColor("oklch(0.9 0 0)")).toBeNull();
    expect(hexColor(undefined)).toBeNull();
  });
});
