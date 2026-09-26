import { describe, expect, it } from "vitest";
import {
  birthDateBounds,
  clampStep,
  customSkillSlug,
  dateToMonth,
  formatThousands,
  isBirthDateValid,
  isOwnPublicUrl,
  isOwnStoragePath,
  monthIndex,
  monthToDate,
  nextStepAfter,
  normalizeTelegramUsername,
  parseMoneyInput,
  slugifyText,
  storagePathFromPublicUrl,
  validateFile,
} from "./utils";

describe("qadamlar", () => {
  it("clampStep: oldinga sakrab bo'lmaydi, orqaga mumkin", () => {
    expect(clampStep(5, 3)).toBe(3);
    expect(clampStep(2, 3)).toBe(2);
    expect(clampStep(null, 4)).toBe(4);
    expect(clampStep(0, 4)).toBe(1);
    expect(clampStep(99, 99)).toBe(9);
    expect(clampStep(Number.NaN, 2)).toBe(2);
  });
  it("nextStepAfter: progress hech qachon orqaga ketmaydi", () => {
    expect(nextStepAfter(1, 1)).toBe(2);
    expect(nextStepAfter(9, 2)).toBe(9);
    expect(nextStepAfter(5, 4)).toBe(5);
    expect(nextStepAfter(8, 8)).toBe(9);
  });
});

describe("pul", () => {
  it("parseMoneyInput", () => {
    expect(parseMoneyInput("5 000 000")).toBe(5_000_000);
    expect(parseMoneyInput("5,000,000 so'm")).toBe(5_000_000);
    expect(parseMoneyInput("")).toBeNull();
    expect(parseMoneyInput("abc")).toBeNull();
  });
  it("formatThousands", () => {
    expect(formatThousands(5_000_000)).toBe("5 000 000");
    expect(formatThousands(750)).toBe("750");
    expect(formatThousands(null)).toBe("");
  });
});

describe("sanalar", () => {
  it("oy ↔ sana", () => {
    expect(monthToDate("2024-03")).toBe("2024-03-01");
    expect(dateToMonth("2024-03-01")).toBe("2024-03");
    expect(dateToMonth(null)).toBeNull();
    expect(monthIndex("2024-03")).toBe(202403);
    expect(monthIndex("2024-12") > monthIndex("2024-03")).toBe(true);
  });
  it("tug'ilgan sana 14–90 yosh oralig'ida", () => {
    const now = new Date("2026-09-26T12:00:00Z");
    expect(birthDateBounds(now)).toEqual({ min: "1936-09-27", max: "2012-09-25" });
    expect(isBirthDateValid("2000-01-15", now)).toBe(true);
    expect(isBirthDateValid("2012-09-26", now)).toBe(false); // roppa-rosa 14 yosh — DB: birth_date < today - 14y
    expect(isBirthDateValid("2012-09-25", now)).toBe(true);
    expect(isBirthDateValid("1936-09-26", now)).toBe(false);
    expect(isBirthDateValid("2000-02-30", now)).toBe(false);
    expect(isBirthDateValid("nope", now)).toBe(false);
  });
});

describe("ko'nikma slug", () => {
  it("slugifyText lotin va kirill", () => {
    expect(slugifyText("Adobe Premiere Pro")).toBe("adobe-premiere-pro");
    expect(slugifyText("Sotuvchi-konsultant INDEX")).toBe("sotuvchi-konsultant-index");
    expect(slugifyText("O'zbek tili")).toBe("ozbek-tili");
    expect(slugifyText("Работа с кассой")).toBe("работа-с-кассой");
  });
  it("customSkillSlug prefiks + tasodifiy suffiks", () => {
    const slug = customSkillSlug("Adobe Premiere", () => 0.5);
    expect(slug).toMatch(/^custom-adobe-premiere-[a-z0-9]{6}$/);
    expect(customSkillSlug("!!!", () => 0)).toMatch(/^custom-skill-[a-z0-9]{6}$/);
  });
});

describe("fayllar va storage", () => {
  it("validateFile", () => {
    expect(validateFile({ type: "image/png", size: 1000 }, ["image/png"], 3)).toBeNull();
    expect(validateFile({ type: "image/gif", size: 1000 }, ["image/png"], 3)?.key).toBe("common.errors.file_type");
    expect(validateFile({ type: "image/png", size: 4 * 1024 * 1024 }, ["image/png"], 3)?.key).toBe("common.errors.file_too_large");
  });
  it("isOwnStoragePath faqat o'z papkasi", () => {
    const uid = "11111111-1111-1111-1111-111111111111";
    expect(isOwnStoragePath(`${uid}/a.jpg`, uid)).toBe(true);
    expect(isOwnStoragePath(`${uid}/`, uid)).toBe(false);
    expect(isOwnStoragePath(`22222222-2222-2222-2222-222222222222/a.jpg`, uid)).toBe(false);
    expect(isOwnStoragePath(`${uid}/../x/a.jpg`, uid)).toBe(false);
  });
  it("isOwnPublicUrl va storagePathFromPublicUrl", () => {
    const uid = "11111111-1111-1111-1111-111111111111";
    const url = `https://x.supabase.co/storage/v1/object/public/avatars/${uid}/avatar.jpg?v=123`;
    expect(isOwnPublicUrl(url, "https://x.supabase.co/", "avatars", uid)).toBe(true);
    expect(isOwnPublicUrl(url, "https://y.supabase.co", "avatars", uid)).toBe(false);
    expect(isOwnPublicUrl(url.replace(uid, "22222222-2222-2222-2222-222222222222"), "https://x.supabase.co", "avatars", uid)).toBe(false);
    expect(storagePathFromPublicUrl(url, "avatars")).toBe(`${uid}/avatar.jpg`);
    expect(storagePathFromPublicUrl("https://x/other", "avatars")).toBeNull();
  });
  it("normalizeTelegramUsername", () => {
    expect(normalizeTelegramUsername("@ali_valiyev")).toBe("ali_valiyev");
    expect(normalizeTelegramUsername("https://t.me/ali")).toBe("ali");
    expect(normalizeTelegramUsername("  ali ")).toBe("ali");
  });
});
