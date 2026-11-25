import { describe, expect, it } from "vitest";
import { STORE_REVIEW_EMAIL, STORE_REVIEW_PROFILE_ID, storeReviewEnabled } from "./store-review-config";

describe("do'kon tekshiruvchisi uchun test kirish", () => {
  it("raqam va 6 xonali kod bo'lsa — yoqiq", () => {
    expect(storeReviewEnabled("+998990000000", "246810", [])).toBe(true);
  });
  it("biri yo'q yoki kod noto'g'ri — o'chiq", () => {
    expect(storeReviewEnabled(null, "246810", [])).toBe(false);
    expect(storeReviewEnabled("+998990000000", undefined, [])).toBe(false);
    expect(storeReviewEnabled("+998990000000", "12345", [])).toBe(false);
    expect(storeReviewEnabled("+998990000000", "abcdef", [])).toBe(false);
  });
  it("egasining raqami berilsa — o'chiq (admin huquqi bilan adashmasin)", () => {
    expect(storeReviewEnabled("+998990000000", "246810", ["+998990000000"])).toBe(false);
  });
  it("demo hisob — texnik manzil va doimiy UUID", () => {
    expect(STORE_REVIEW_EMAIL.endsWith("@telegram.ishuz.local")).toBe(true);
    expect(STORE_REVIEW_PROFILE_ID).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});
