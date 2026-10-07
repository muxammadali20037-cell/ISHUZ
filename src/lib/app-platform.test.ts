import { describe, expect, it } from "vitest";
import { isAndroidAppLaunch } from "./app-platform";

describe("isAndroidAppLaunch", () => {
  it("TWA referer — ilova ichida", () => {
    expect(isAndroidAppLaunch("android-app://uz.ishberuvchi.app/", null)).toBe(true);
  });
  it("start URL'dagi ?app=android — ilova ichida", () => {
    expect(isAndroidAppLaunch(null, "android")).toBe(true);
  });
  it("oddiy brauzer — ilova emas", () => {
    expect(isAndroidAppLaunch("https://www.google.com/", null)).toBe(false);
    expect(isAndroidAppLaunch(null, null)).toBe(false);
    expect(isAndroidAppLaunch(null, "ios")).toBe(false);
  });
});
