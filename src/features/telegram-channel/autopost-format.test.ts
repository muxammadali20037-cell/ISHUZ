import { describe, expect, it } from "vitest";
import { makeT } from "@/lib/i18n/translate";
import { dialable, hashtag, sanitizeLine, sanitizeText, vacancyPost, workerPost } from "./autopost-format";

const t = makeT("uz");
const BASE = "https://ishuz.vercel.app";

describe("kanal e'lonlari: to'liq matn; raqam — faqat rozilik maydonidan, erkin matnda telefon va havola yo'q", () => {
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

  it("ko'p qatorli tavsif: qatorlar saqlanadi, telefon/havola olib tashlanadi, bo'sh qatorlar va ortiqchasi tashlanadi", () => {
    expect(sanitizeText("Ish 9:00–18:00\n\nTel: +998 90 123 45 67\nTushlik bepul\nt.me/xyz", 200)).toBe("Ish 9:00–18:00\nTel:\nTushlik bepul");
    expect(sanitizeText("a\nb\nc", 200, 2)).toBe("a\nb");
    expect(sanitizeText("x".repeat(50), 10)).toHaveLength(10);
    expect(sanitizeText(null, 100)).toBe("");
  });

  it("vakansiya: VAKANSIYA belgisi, maosh davri bilan, tugma — vakansiya sahifasi; rozilik raqami berilmasa — raqamsiz", () => {
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
    expect(p.html).toContain("💼 VAKANSIYA · ishchi kerak");
    expect(p.html).toContain("#sotuvchi #toshkent_shahri");
    expect(p.html).toContain("<b>Sotuvchi &lt;kassir&gt;</b>");
    expect(p.html).toContain("Baraka &amp; Co");
    expect(p.html).toContain("4 000 000 – 6 000 000 so'm");
    expect(p.html).not.toMatch(/90 123/);
    expect(p.button.url).toBe(`${BASE}/jobs/sotuvchi-abc123`);
    // rasm (ish nomi, maosh, joylashuv, kompaniya); 2026-11-18 (ega): rasm ostida — to'liq matn; tugma — "Ariza qoldirish";
    // matnda sayt nomi yo'q (ega, 2026-11-16)
    expect(p.button.text).toBe("Ariza qoldirish");
    expect(p.photo).toBe(`${BASE}/api/promo/vacancy/sotuvchi-abc123?f=post`);
    expect(p.caption).toBe(p.html);
    expect(p.html).not.toMatch(/📞/);
    expect(p.html).not.toMatch(/vercel|ishuz|https?:/i);
  });

  it("vakansiya to'liq: tajriba, tavsif (tozalangan) va rozilik berilgan raqam — rasm ostida, 1024 dan oshmaydi", () => {
    const p = vacancyPost(
      {
        slug: "oqituvchi-1",
        title: "Ўқитувчи",
        company: null,
        place: "Toshkent shahri",
        remote: false,
        salaryFrom: null,
        salaryTo: null,
        salaryType: null,
        negotiable: true,
        schedule: null,
        profession: null,
        experienceMonths: 12,
        description: "Matematika fani o'qituvchisi kerak.\nMurojaat: 90 999 88 77, @hr_maktab\nhttps://spam.uz",
        phone: "+998901234567",
      },
      t,
      BASE,
    );
    expect(p.html).toContain("🧰 Tajriba: 1 yildan");
    expect(p.html).toContain("Matematika fani o'qituvchisi kerak.\nMurojaat: ,");
    expect(p.html).not.toMatch(/999 88 77|hr_maktab|spam/);
    // 2026-11-20 (ega): raqam bo'shliqsiz — Telegram uni bosiladigan qiladi (bosilsa qo'ng'iroq)
    expect(p.html).toMatch(/📞 Tel: \+998901234567$/);
    expect(p.caption).toBe(p.html);
    // tavsif juda uzun bo'lsa — qisqartiriladi, raqam baribir oxirida
    const long = vacancyPost(
      { slug: "x", title: "Oshpaz", company: "Baraka", place: "Toshkent", remote: false, salaryFrom: 1, salaryTo: null, salaryType: null, negotiable: false, schedule: null, profession: null, description: "Juda uzun matn. ".repeat(200), phone: "+998901234567" },
      t,
      BASE,
    );
    expect(long.caption!.length).toBeLessThanOrEqual(1024);
    expect(long.caption).toMatch(/…\n\n📞 Tel: \+998901234567$/);
    expect(vacancyPost({ slug: "y", title: "Qorovul", company: null, place: null, remote: false, salaryFrom: null, salaryTo: null, salaryType: null, negotiable: true, schedule: null, profession: null, experienceMonths: 0 }, t, BASE).html).toContain(
      "🧰 Tajriba talab qilinmaydi",
    );
  });

  it("ishchi: ISHCHI belgisi, ismsiz, raqamsiz (sarlavhadagi raqam ham olib tashlanadi); tugma — «Bog'lanish», e'londagi raqam ochish", () => {
    const p = workerPost(
      { id: "0b9c8a3e-1f2d-4c5b-9a8e-7d6c5b4a3f21", profession: "Oshpaz", headline: "Milliy taomlar, tel 998901234567", place: "Samarqand viloyati", experience: "3–5 yil", salary: 5_000_000, salaryType: "monthly", schedules: ["5/2", "Smenali"] },
      t,
      BASE,
    );
    expect(p.html).toContain("👤 ISHCHI · ish qidiryapti");
    expect(p.html).toContain("<b>Oshpaz</b>");
    expect(p.html).toContain("<i>Milliy taomlar, tel</i>");
    expect(p.html).toContain("Tajriba: 3–5 yil");
    expect(p.html).toContain("Kutilayotgan maosh:");
    expect(p.html).not.toMatch(/998901234567/);
    expect(p.button).toEqual({ text: "📞 Bog'lanish", url: `${BASE}/listing/0b9c8a3e-1f2d-4c5b-9a8e-7d6c5b4a3f21#contact` });
    expect(p.html).toMatch(/\n\n📞 Raqam — «Bog'lanish» tugmasi orqali saytda$/);
    // 2026-11-17 (ega): ishchi e'loni ham rasm bilan — kasbi, tajribasi, joyi, maosh (ism, telefon yo'q);
    // 2026-11-18: rasm ostida to'liq matn
    expect(p.photo).toBe(`${BASE}/api/promo/worker/0b9c8a3e-1f2d-4c5b-9a8e-7d6c5b4a3f21`);
    expect(p.caption).toBe(p.html);
    expect(p.caption).not.toMatch(/998901234567|Tel:/);
  });

  it("dialable: faqat O'zbekiston raqami, xalqaro ko'rinishda", () => {
    expect(dialable("+998 93 272 87 66")).toBe("+998932728766");
    expect(dialable("998932728766")).toBe("+998932728766");
    expect(dialable("+7 999 123 45 67")).toBeNull();
    expect(dialable("90 123")).toBeNull();
  });

  it("ishchi maosh kutmasa — kelishiladi", () => {
    const p = workerPost({ id: "x", profession: "Haydovchi", headline: null, place: null, experience: null, salary: null, salaryType: null, schedules: [] }, t, BASE);
    expect(p.html).toContain("Kutilayotgan maosh: Kelishiladi");
  });

  it("tugma havolasi — berilgan funksiyadan (Mini App), rasm — saytdan", () => {
    const p = vacancyPost(
      { slug: "oshpaz-x1", title: "Oshpaz", company: null, place: null, remote: false, salaryFrom: null, salaryTo: null, salaryType: null, negotiable: true, schedule: null, profession: "Oshpaz" },
      t,
      BASE,
      (path) => `https://t.me/ishberuvchi_bot?startapp=${path === "/jobs/oshpaz-x1" ? "j_oshpaz-x1" : "?"}`,
    );
    expect(p.button.url).toBe("https://t.me/ishberuvchi_bot?startapp=j_oshpaz-x1");
    expect(p.photo).toBe(`${BASE}/api/promo/vacancy/oshpaz-x1?f=post`);
  });
});

