import { beforeEach, describe, expect, it } from "vitest";
import { rememberReturnTo, takeReturnTo } from "./return-to";

class MemoryStorage {
  private m = new Map<string, string>();
  getItem(k: string) {
    return this.m.has(k) ? this.m.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
}

describe("onboardingdan keyin qaytish", () => {
  beforeEach(() => {
    (globalThis as unknown as { sessionStorage: MemoryStorage }).sessionStorage = new MemoryStorage();
  });

  it("ariza oynasi bilan vakansiyaga qaytadi va bir marta o'qiladi", () => {
    rememberReturnTo("/jobs/oshpaz-abc?apply=1", 1000);
    expect(takeReturnTo(2000)).toBe("/jobs/oshpaz-abc?apply=1");
    expect(takeReturnTo(2000)).toBeNull();
  });

  it("boshqa saytga olib ketadigan yo'llar saqlanmaydi", () => {
    for (const bad of ["https://evil.uz/x", "//evil.uz", "/\\evil.uz", "/\t/evil.uz", "javascript:alert(1)"]) {
      rememberReturnTo(bad, 1000);
      expect(takeReturnTo(1000), bad).toBeNull();
    }
  });

  it("1 soatdan eski yozuv e'tiborsiz qoladi", () => {
    rememberReturnTo("/jobs/x?apply=1", 0);
    expect(takeReturnTo(60 * 60 * 1000 + 1)).toBeNull();
  });

  it("buzilgan yozuv xato bermaydi", () => {
    sessionStorage.setItem("ib_onb_return", "{buzilgan");
    expect(takeReturnTo()).toBeNull();
  });
});
