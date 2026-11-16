import { describe, expect, it } from "vitest";
import { makeT } from "@/lib/i18n/translate";
import { hashtag, sanitizeLine, vacancyPost, workerPost } from "./autopost-format";

const t = makeT("uz");
const BASE = "https://ishuz.vercel.app";

describe("kanal e'lonlari: faqat ochiq ma'lumot, telefon va havolasiz", () => {
  it("sarlavhadan telefon, @nik, havola va email olib tashlanadi; oddiy raqamlar qoladi", () => {
    expect(sanitizeLine("Oshpaz kerak +998 90 123-45-67 tel qiling")).toBe("Oshpaz kerak tel qiling");
    expect(sanitizeLine("Sotuvchi (901234567) @hr_bot t.me/xyz https://x.uz a@b.uz")).toBe("Sotuvchi");
    expect(sanitizeLine("2 smenali ish, 5/2, 24 yoshgacha")).toBe("2 smenali ish, 5/2, 24 yoshgacha");
    expect(sanitizeLine("a".repeat(200), 20)).toHaveLength(20);
  });

  it("heshteg: harflar va pastki chiziq", () => {
    expect(hashtag("Sotuvchi-kassir")).toBe("#sotuvchi_kassir");
    expect(hashtag("Toshkent shahri")).toBe("#toshkent_shahri");
    expect(hashtag("Ta'mirlovchi")).toBe("#tamirlovchi");
    expect(hashtag("Повар")).toBe("#повар");
    expect(hashtag("123")).toBeNull();
    expect(hashtag(null)).toBeNull();
  });

  it("vakansiya: ISH belgisi, maosh davri bilan, tugma — vakansiya sahifasi; tavsif va telefon yo'q", () => {
    const p = vacancyPost(
      {
        slug: "sotuvchi-abc123",
        title: "Sotuvchi <kassir> 90 123 45 67",
        company: "Baraka & Co",
        place: "Toshkent shahri, Chilonzor",
        remote: false,
        salaryFrom: 4_000_000,
        salaryTo: 6_000_000,
        salaryType: "monthly",
        negotiable: false,
        schedule: "5/2",
        profession: "Sotuvchi",
      },
      t,
      BASE,
    );
    expect(p.html).toContain("🟦 ISH");
    expect(p.html).toContain("#sotuvchi #toshkent_shahri");
    expect(p.html).toContain("<b>Sotuvchi &lt;kassir&gt;</b>");
    expect(p.html).toContain("Baraka &amp; Co");
    expect(p.html).toContain("4 000 000 – 6 000 000 so'm");
    expect(p.html).not.toMatch(/90 123/);
    expect(p.button.url).toBe(`${BASE}/jobs/sotuvchi-abc123`);
    // oddiy matn: rasm va sayt nomi yo'q, tugma — "Ariza qoldirish" (ega, 2026-11-16)
    expect(p.button.text).toBe("Ariza qoldirish");
    expect(p).not.toHaveProperty("photo");
    expect(p.html).not.toMatch(/vercel|ishuz|https?:/i);
  });

  it("ishchi: ISHCHI belgisi, ism/telefonsiz, tugma — ishchi sahifasi", () => {
    const p = workerPost(
      { id: "0b9c8a3e-1f2d-4c5b-9a8e-7d6c5b4a3f21", profession: "Oshpaz", headline: "Milliy taomlar, tel 998901234567", place: "Samarqand viloyati", experience: "3–5 yil", salary: 5_000_000, salaryType: "monthly", schedules: ["5/2", "Smenali"] },
      t,
      BASE,
    );
    expect(p.html).toContain("🟩 ISHCHI");
    expect(p.html).toContain("<b>Oshpaz</b>");
    expect(p.html).toContain("<i>Milliy taomlar, tel</i>");
    expect(p.html).toContain("Tajriba: 3–5 yil");
    expect(p.html).toContain("Kutilayotgan maosh:");
    expect(p.html).not.toMatch(/998901234567/);
    expect(p.button.url).toBe(`${BASE}/workers/0b9c8a3e-1f2d-4c5b-9a8e-7d6c5b4a3f21`);
    expect(p).not.toHaveProperty("photo");
  });

  it("ishchi maosh kutmasa — kelishiladi", () => {
    const p = workerPost({ id: "x", profession: "Haydovchi", headline: null, place: null, experience: null, salary: null, salaryType: null, schedules: [] }, t, BASE);
    expect(p.html).toContain("Kutilayotgan maosh: Kelishiladi");
  });
});
