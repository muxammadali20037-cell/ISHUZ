import { describe, expect, it } from "vitest";
import { adminNext, isRecoveryHash, isTechnicalEmail, normalizeEmail, parseLinkHash, parseOwnerEmails, passwordProblem } from "./admin-login";

describe("admin zaxira kirishi: email va parol qoidalari", () => {
  it("email: kichik harf, bo'shliqsiz; noto'g'ri va texnik (tg_…@telegram.ishuz.local) manzil qabul qilinmaydi", () => {
    expect(normalizeEmail("  Ali.Valiyev@Gmail.COM ")).toBe("ali.valiyev@gmail.com");
    for (const bad of ["", "ali", "ali@", "@gmail.com", "ali@gmail", "a b@gmail.com", "ali@@gmail.com", "x".repeat(250) + "@a.uz", 42, null]) {
      expect(normalizeEmail(bad)).toBeNull();
    }
    expect(normalizeEmail("tg_123@telegram.ishuz.local")).toBeNull();
    expect(isTechnicalEmail("TG_1_ab12@telegram.ishuz.local")).toBe(true);
    expect(isTechnicalEmail(null)).toBe(true);
    expect(isTechnicalEmail("owner@ishtopdim.uz")).toBe(false);
  });

  it("parol: 12–128 belgi, bir xil belgilardan emas, email nomisiz", () => {
    expect(passwordProblem("qisqa-parol")).toBe("too_short");
    expect(passwordProblem("a".repeat(129))).toBe("too_long");
    expect(passwordProblem("aaaaaaaaaaaa")).toBe("too_simple");
    expect(passwordProblem("121212121212")).toBe("too_simple");
    expect(passwordProblem("Valiyev-2026-ish!", "valiyev@gmail.com")).toBe("contains_email");
    expect(passwordProblem("tog' boshida uch olma", "valiyev@gmail.com")).toBeNull();
    expect(passwordProblem("x9#Lm2!pQr7$")).toBeNull();
  });

  it("SUPER_ADMIN_EMAILS: vergul/bo'shliq bilan, takrorsiz, noto'g'rilari tashlanadi", () => {
    expect(parseOwnerEmails(" Owner@Ish.uz, boss@gmail.com;owner@ish.uz\nnot-an-email ")).toEqual(["owner@ish.uz", "boss@gmail.com"]);
    expect(parseOwnerEmails(undefined)).toEqual([]);
  });

  it("emaildagi havola: sessiya tokenlari yoki xato kodi; boshqa narsa — null", () => {
    const at = "aaa.bbb.ccc";
    expect(parseLinkHash(`#access_token=${at}&expires_in=3600&refresh_token=r1&token_type=bearer&type=recovery`)).toEqual({ kind: "session", accessToken: at, refreshToken: "r1" });
    expect(parseLinkHash("#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid")).toEqual({ kind: "error", code: "otp_expired" });
    expect(parseLinkHash("#error_code=<script>")).toEqual({ kind: "error", code: "unknown" });
    expect(parseLinkHash("#access_token=not-a-jwt&refresh_token=r")).toBeNull();
    expect(parseLinkHash("#refresh_token=r")).toBeNull();
    expect(parseLinkHash("")).toBeNull();
    expect(isRecoveryHash(`#access_token=${at}&refresh_token=r&type=recovery`)).toBe(true);
    expect(isRecoveryHash(`#access_token=${at}&refresh_token=r&type=magiclink`)).toBe(false);
  });

  it("qaytish manzili faqat admin panel ichida", () => {
    expect(adminNext("/admin/account")).toBe("/admin/account");
    expect(adminNext("/admin")).toBe("/admin");
    expect(adminNext("/profile")).toBe("/admin");
    expect(adminNext("/admin/../profile")).toBe("/admin");
    expect(adminNext("//evil.uz/admin")).toBe("/admin");
    expect(adminNext("/administrator")).toBe("/admin");
    expect(adminNext(null)).toBe("/admin");
  });
});
