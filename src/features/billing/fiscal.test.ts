import { describe, expect, it } from "vitest";
import { fiscalTitle, paymeDetail } from "./fiscal";

const cfg = { code: "11111111111111111", packageCode: "1111111", vat: 0 };

describe("fiskal chek (Payme detail)", () => {
  it("kodlar to'liq bo'lsa — bitta xizmat qatori, narx tiyinda", () => {
    expect(paymeDetail({ purpose: "vacancy_publish", plan: "boost", amount: 24_500 }, cfg)).toEqual({
      receipt_type: 0,
      items: [{ title: "Ish topdim: vakansiya e'lonini joylash (Tezkor)", price: 2_450_000, count: 1, code: cfg.code, package_code: cfg.packageCode, vat_percent: 0 }],
    });
  });
  it("kod yoki qadoq kodi bo'lmasa — null (detail yuborilmaydi, avvalgidek)", () => {
    expect(paymeDetail({ purpose: "vacancy_publish", plan: "boost", amount: 24_500 }, {})).toBeNull();
    expect(paymeDetail({ purpose: "vacancy_publish", plan: "boost", amount: 24_500 }, { code: cfg.code })).toBeNull();
    expect(paymeDetail({ purpose: "vacancy_publish", plan: "boost", amount: 0 }, cfg)).toBeNull();
  });
  it("QQS ko'rsatilmasa — 0 (YaTT aylanma solig'ida)", () => {
    expect(paymeDetail({ purpose: "contact_unlock", plan: null, amount: 5_000 }, { code: cfg.code, packageCode: cfg.packageCode })!.items[0]!.vat_percent).toBe(0);
  });
  it("xizmat nomlari", () => {
    expect(fiscalTitle({ purpose: "worker_listing", plan: "max" })).toBe("Ish topdim: ishchi e'lonini joylash (Maksimal)");
    expect(fiscalTitle({ purpose: "vacancy_publish", plan: "basic" })).toBe("Ish topdim: vakansiya e'lonini joylash (Oddiy)");
    expect(fiscalTitle({ purpose: "contact_unlock", plan: "basic" })).toBe("Ish topdim: nomzod raqamini ochish");
    expect(fiscalTitle({ purpose: "wallet_topup", plan: null })).toBe("Ish topdim: xizmatlar uchun oldindan to'lov");
    expect(fiscalTitle({ purpose: "something_new", plan: null })).toBe("Ish topdim: e'lon xizmati");
  });
});
