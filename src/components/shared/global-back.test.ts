import { describe, expect, it } from "vitest";
import { backFallback, showGlobalBack } from "./global-back";

describe("umumiy 'Orqaga'", () => {
  it("bosh sahifalarda yo'q, qolganlarida bor", () => {
    expect(showGlobalBack("/")).toBe(false);
    expect(showGlobalBack("/employer")).toBe(false);
    expect(showGlobalBack("/ustalar")).toBe(false);
    expect(showGlobalBack(null)).toBe(false);
    for (const p of ["/ai", "/cabinet", "/jobs", "/jobs/xarita", "/employer/vacancies/abc", "/ustalar/kabinet", "/settings"]) expect(showGlobalBack(p)).toBe(true);
  });

  it("to'g'ridan-to'g'ri ochilganda — eng yaqin bo'lim sahifasi, topilmasa bosh sahifa", () => {
    expect(backFallback("/employer/vacancies/3f2c")).toBe("/employer/vacancies");
    expect(backFallback("/employer/vacancies/3f2c/applications")).toBe("/employer/vacancies");
    expect(backFallback("/jobs/oshpaz-123")).toBe("/jobs");
    expect(backFallback("/ustalar/elon/1")).toBe("/ustalar");
    expect(backFallback("/messages/7")).toBe("/messages");
    expect(backFallback("/cabinet")).toBe("/");
    expect(backFallback("/ai")).toBe("/");
    expect(backFallback("/jobsxyz/1")).toBe("/");
  });
});
