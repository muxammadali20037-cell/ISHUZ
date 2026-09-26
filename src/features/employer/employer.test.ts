import { describe, expect, it } from "vitest";
import {
  companySchema,
  personSchema,
  verificationRequestSchema,
  normalizeTelegram,
  normalizeInstagram,
  normalizeWebsite,
  telegramUrl,
  instagramUrl,
  isValidLogoPath,
  isValidDocumentPath,
  validateLogoFile,
  validateDocumentFile,
  inviteLink,
} from "./schema";
import { parseDashboardStats, employerDisplayName, errorMessageKey, toWorkerCardData } from "./mappers";
import type { SearchWorkerRow } from "./types";

const CID = "7aba03bd-f315-417a-a3f5-f3388cd4cda8";
const UID = "b2222222-2222-2222-2222-222222222222";

describe("normalizers", () => {
  it("telegram accepts @user, t.me links and rejects short/invalid", () => {
    expect(normalizeTelegram("@anor_market")).toBe("@anor_market");
    expect(normalizeTelegram("https://t.me/AnorMarket/")).toBe("@AnorMarket");
    expect(normalizeTelegram("t.me/anor")).toBeNull();
    expect(normalizeTelegram("1abcde")).toBeNull();
    expect(normalizeTelegram("   ")).toBe("");
  });
  it("instagram strips url/@ and validates", () => {
    expect(normalizeInstagram("https://www.instagram.com/anor.market/?hl=en")).toBe("anor.market");
    expect(normalizeInstagram("@anor")).toBe("anor");
    expect(normalizeInstagram("bad name")).toBeNull();
    expect(normalizeInstagram("")).toBe("");
  });
  it("website adds https and validates", () => {
    expect(normalizeWebsite("anor.uz")).toBe("https://anor.uz");
    expect(normalizeWebsite("http://anor.uz/jobs")).toBe("http://anor.uz/jobs");
    expect(normalizeWebsite("ftp://x.uz")).toBeNull();
    expect(normalizeWebsite("localhost")).toBeNull();
    expect(normalizeWebsite("")).toBe("");
  });
  it("builds external links", () => {
    expect(telegramUrl("@anor")).toBe("https://t.me/anor");
    expect(telegramUrl(null)).toBeNull();
    expect(instagramUrl("anor")).toBe("https://instagram.com/anor");
    expect(inviteLink("https://ish.uz/", "abc123")).toBe("https://ish.uz/company/join?token=abc123");
  });
});

describe("companySchema", () => {
  it("normalizes and nulls empty optionals", () => {
    const r = companySchema.safeParse({
      name: "  Anor Market ",
      phone: "90 123 45 67",
      telegram: "t.me/anormarket",
      website: "anor.uz",
      instagram: "",
      address: "",
      regionId: "",
      districtId: "",
      industryCategoryId: CID,
      about: " ",
      size: "11_50",
      tin: "123 456 789",
    });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data).toMatchObject({
      name: "Anor Market",
      phone: "+998901234567",
      telegram: "@anormarket",
      website: "https://anor.uz",
      instagram: null,
      address: null,
      regionId: null,
      districtId: null,
      industryCategoryId: CID,
      about: null,
      size: "11_50",
      tin: "123456789",
    });
  });
  it("reports i18n keys as messages", () => {
    const r = companySchema.safeParse({ name: "A", phone: "123", telegram: "x", website: "nope", instagram: "a b", address: "", regionId: "not-uuid", districtId: "", industryCategoryId: "", about: "", size: "", tin: "12" });
    expect(r.success).toBe(false);
    if (r.success) return;
    const byPath = Object.fromEntries(r.error.issues.map((i) => [String(i.path[0]), i.message]));
    expect(byPath.name).toBe("employer.form.errors.name_length");
    expect(byPath.phone).toBe("common.errors.invalid_phone");
    expect(byPath.telegram).toBe("employer.form.errors.telegram");
    expect(byPath.website).toBe("common.errors.invalid_url");
    expect(byPath.instagram).toBe("employer.form.errors.instagram");
    expect(byPath.tin).toBe("employer.form.errors.tin");
    expect(byPath.regionId).toBe("common.errors.validation");
  });
});

describe("personSchema / verificationRequestSchema", () => {
  it("person requires display name, phone optional", () => {
    expect(personSchema.safeParse({ displayName: "Aziz aka", contactPhone: "", regionId: "", districtId: "", about: "" }).success).toBe(true);
    expect(personSchema.safeParse({ displayName: "A", contactPhone: "", regionId: "", districtId: "", about: "" }).success).toBe(false);
  });
  it("verification needs 1..5 documents", () => {
    expect(verificationRequestSchema.safeParse({ companyId: CID, type: "company", note: "", documentPaths: [] }).success).toBe(false);
    expect(verificationRequestSchema.safeParse({ companyId: null, type: "identity", note: "x", documentPaths: [`${UID}/a.pdf`] }).success).toBe(true);
    expect(verificationRequestSchema.safeParse({ companyId: null, type: "identity", note: "", documentPaths: Array(6).fill("p") }).success).toBe(false);
  });
});

describe("storage paths & files", () => {
  it("validates logo and document paths", () => {
    expect(isValidLogoPath(CID, `${CID}/logo.png`)).toBe(true);
    expect(isValidLogoPath(CID, `${UID}/logo.png`)).toBe(false);
    expect(isValidLogoPath(CID, `${CID}/logo.exe`)).toBe(false);
    expect(isValidDocumentPath(UID, `${UID}/0b7f5f1c-1b2a-4c3d-9e8f-123456789abc.pdf`)).toBe(true);
    expect(isValidDocumentPath(UID, `${UID}/../x.pdf`)).toBe(false);
    expect(isValidDocumentPath(UID, `${CID}/0b7f5f1c-1b2a-4c3d-9e8f-123456789abc.pdf`)).toBe(false);
  });
  it("validates file type and size", () => {
    expect(validateLogoFile({ type: "image/png", size: 1000 })).toBeNull();
    expect(validateLogoFile({ type: "image/gif", size: 1000 })).toBe("employer.form.errors.logo_type");
    expect(validateLogoFile({ type: "image/png", size: 4 * 1024 * 1024 })).toBe("employer.form.errors.logo_size");
    expect(validateDocumentFile({ type: "application/pdf", size: 1000 })).toBeNull();
    expect(validateDocumentFile({ type: "image/webp", size: 1000 })).toBe("employer.verification.errors.doc_type");
    expect(validateDocumentFile({ type: "image/png", size: 16 * 1024 * 1024 })).toBe("employer.verification.errors.doc_size");
  });
});

describe("mappers", () => {
  it("parses dashboard stats jsonb with defaults", () => {
    expect(parseDashboardStats({ active_vacancies: 2, new_applications: "3", views: 10 })).toMatchObject({ active_vacancies: 2, new_applications: 3, views: 10, hired: 0, total_vacancies: 0 });
    expect(parseDashboardStats(null).applications).toBe(0);
    expect(parseDashboardStats([1, 2]).views).toBe(0);
  });
  it("maps search_workers row incl. json skills/languages", () => {
    const row = {
      id: "w1",
      profile_id: "p1",
      first_name: "Ali",
      last_initial: "V",
      avatar_url: null,
      headline: "Kassir",
      category_id: "c",
      category_name_uz: "Savdo",
      category_name_ru: "Продажи",
      subcategory_name_uz: null,
      subcategory_name_ru: null,
      region_name_uz: "Toshkent",
      region_name_ru: "Ташкент",
      district_name_uz: "Chilonzor",
      district_name_ru: "Чиланзар",
      experience_level: "1_2y",
      status: "active",
      work_format: "official",
      remote_preference: "no",
      salary_min: 5000000,
      salary_expected: 7000000,
      salary_type: "monthly",
      employment_types: ["full_time"],
      schedules: ["5_2"],
      availability: "today",
      skills: [{ id: "s1", name_uz: "POS", name_ru: "POS", level: "good" }, "bad", { name_uz: "no id" }],
      languages: [{ code: "ru", level: "b1" }, null],
      completeness: 80,
      has_portfolio: false,
      phone_verified: true,
      match_score: 88,
      match_reasons: [],
      distance_km: null,
      is_saved: false,
      last_active_at: "2026-09-26T00:00:00Z",
      total_count: 1,
    } as unknown as SearchWorkerRow;
    const card = toWorkerCardData(row);
    expect(card.skills).toEqual([{ id: "s1", name_uz: "POS", name_ru: "POS", level: "good" }]);
    expect(card.languages).toEqual([{ code: "ru", level: "b1" }]);
    expect(card.match_score).toBe(88);
    expect(card.first_name).toBe("Ali");
  });
  it("picks display name and error keys", () => {
    expect(employerDisplayName({ companyName: " ", displayName: "Aziz aka", firstName: "Aziz" })).toBe("Aziz aka");
    expect(employerDisplayName({ companyName: "Anor", displayName: null, firstName: "Aziz" })).toBe("Anor");
    expect(errorMessageKey("not_admin")).toBe("employer.errors.not_admin");
    expect(errorMessageKey("forbidden")).toBe("common.errors.forbidden");
    expect(errorMessageKey("weird_code")).toBe("common.errors.generic");
  });
});
