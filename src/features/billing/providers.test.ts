import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const env = {
  PAYME_MERCHANT_ID: "65f000000000000000000000",
  PAYME_KEY: "payme-secret-key",
  PAYME_TEST: undefined as string | undefined,
  CLICK_SERVICE_ID: "12345",
  CLICK_MERCHANT_ID: "67890",
  CLICK_SECRET_KEY: "click-secret",
};
vi.mock("@/lib/env", () => ({ getServerEnv: () => env }));

const { checkoutUrl, clickSign, enabledProviders, verifyClickSign, verifyPaymeAuth } = await import("./providers");

describe("Payme", () => {
  it("checkout havolasi: base64 parametrlar, summa tiyinda", () => {
    const url = checkoutUrl("payme", 42, 50000, "https://ishuz.vercel.app/billing/return?order=42", "uz");
    expect(url.startsWith("https://checkout.paycom.uz/")).toBe(true);
    const decoded = Buffer.from(url.split("/").pop()!, "base64").toString();
    expect(decoded).toBe("m=65f000000000000000000000;ac.order_id=42;a=5000000;c=https://ishuz.vercel.app/billing/return?order=42;l=uz");
  });

  it("Basic auth: faqat to'g'ri kalit", () => {
    const ok = "Basic " + Buffer.from("Paycom:payme-secret-key").toString("base64");
    expect(verifyPaymeAuth(ok)).toBe(true);
    expect(verifyPaymeAuth("Basic " + Buffer.from("Paycom:wrong").toString("base64"))).toBe(false);
    expect(verifyPaymeAuth("Basic " + Buffer.from("Other:payme-secret-key").toString("base64"))).toBe(false);
    expect(verifyPaymeAuth(null)).toBe(false);
  });
});

describe("Click", () => {
  const base = { click_trans_id: "111", service_id: "12345", merchant_trans_id: "42", amount: "50000", sign_time: "2026-09-27 10:00:00" };

  it("prepare imzosi (merchant_prepare_id'siz)", () => {
    const f = { ...base, action: "0" };
    const expected = createHash("md5").update("11112345click-secret4250000" + "0" + "2026-09-27 10:00:00").digest("hex");
    expect(clickSign(f, "click-secret")).toBe(expected);
    expect(verifyClickSign({ ...f, sign_string: expected })).toBe(true);
    expect(verifyClickSign({ ...f, sign_string: expected.replace(/.$/, "0") })).toBe(false);
  });

  it("complete imzosi merchant_prepare_id ni o'z ichiga oladi", () => {
    const f = { ...base, action: "1", merchant_prepare_id: "42" };
    const expected = createHash("md5").update("11112345click-secret42" + "42" + "50000" + "1" + "2026-09-27 10:00:00").digest("hex");
    expect(verifyClickSign({ ...f, sign_string: expected })).toBe(true);
  });

  it("boshqa service_id rad etiladi", () => {
    const f = { ...base, action: "0", service_id: "99999" };
    expect(verifyClickSign({ ...f, sign_string: clickSign(f, "click-secret") })).toBe(false);
  });

  it("checkout havolasi", () => {
    const url = new URL(checkoutUrl("click", 42, 50000, "https://x.uz/r", "uz"));
    expect(url.origin + url.pathname).toBe("https://my.click.uz/services/pay");
    expect(Object.fromEntries(url.searchParams)).toEqual({ service_id: "12345", merchant_id: "67890", amount: "50000", transaction_param: "42", return_url: "https://x.uz/r" });
  });
});

describe("enabledProviders", () => {
  it("kalitlar bo'lsa ikkalasi ham", () => {
    expect(enabledProviders()).toEqual(["payme", "click"]);
  });
});
