import { describe, expect, it } from "vitest";
import { makeT } from "@/lib/i18n/translate";
import { dialable, masterPost, sanitizeLine, sanitizeText, vacancyPost, workerPost } from "./autopost-format";

const t = makeT("uz");
const BASE = "https://ishuz.vercel.app";

describe("kanal e'lonlari: to'liq matn; raqam — faqat rozilik maydonidan, erkin matnda telefon va havola yo'q", () => {
  it("sarlavhadan telefon, @nik, havola va email olib tashlanadi; oddiy raqamlar qoladi", () => {
    expect(sanitizeLine("Oshpaz kerak +998 90 123-45-67 tel qiling")).toBe("Oshpaz kerak tel qiling");
    expect(sanitizeLine("Sotuvchi (901234567) @hr_bot t.me/xyz https://x.uz a@b.uz")).toBe("Sotuvchi");
    expect(sanitizeLine("2 smenali ish, 5/2, 24 yoshgacha")).toBe("2 smenali ish, 5/2, 24 yoshgacha");
    expect(sanitizeLine("a".repeat(200), 20)).toHaveLength(20);
  });

  it("ko'p qatorli tavsif: qatorlar saqlanadi, telefon/havola olib tashlanadi, bo'sh qatorlar va ortiqchasi tashlanadi", () => {
    expect(sanitizeText("Ish 9:00–18:00\n\nTel: +998 90 123 45 67\nTushlik bepul\nt.me/xyz", 200)).toBe("Ish 9:00–18:00\nTel:\nTushlik bepul");
    expect(sanitizeText("a\nb\nc", 200, 2)).toBe("a\nb");
    expect(sanitizeText("x".repeat(50), 10)).toHaveLength(10);
    expect(sanitizeText(null, 100)).toBe("");
  });

  it("vakansiya: «Ish beruvchi ishchi qidiryapti» (heshtegsiz), maosh davri bilan, tugma — vakansiya sahifasi; rozilik raqami berilmasa — raqamsiz", () => {
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
    // ega (2026-11-22): boshida oddiy yozuv, heshteglarsiz — "Ish beruvchi ishchi qidiryapti", keyin nomi
    expect(p.html.startsWith("💼 Ish beruvchi ishchi qidiryapti\n\n<b>Sotuvchi &lt;kassir&gt;</b>\n")).toBe(true);
    expect(p.html).not.toMatch(/VAKANSIYA|#/);
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
    // jinsi, yosh va ish vaqti berilmagan — qatorlari yo'q
    expect(p.html).toMatch(/🕘 5\/2(\n|$)/);
    expect(p.html).not.toMatch(/👤/);
  });

  it("vakansiya: ish vaqti grafik yonida, jinsi va yosh chegarasi — alohida qatorda (ega, 2026-11-24)", () => {
    const p = vacancyPost(
      { slug: "s-1", title: "Sotuvchi", company: null, place: "Toshkent", remote: false, salaryFrom: null, salaryTo: null, salaryType: null, negotiable: true, schedule: "5/2", profession: "Sotuvchi", workTime: "09:00–18:00", gender: "Ayol", age: "18–35 yosh" },
      t,
      BASE,
    );
    expect(p.html).toContain("🕘 5/2 · 09:00–18:00");
    expect(p.html).toContain("👤 Ayol · 18–35 yosh");
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

  it("ishchi: «Ishchi ish qidiryapti» (heshtegsiz), ismsiz, raqamsiz (sarlavhadagi raqam ham olib tashlanadi); tugma — «Bog'lanish», e'londagi raqam ochish", () => {
    const p = workerPost(
      { id: "0b9c8a3e-1f2d-4c5b-9a8e-7d6c5b4a3f21", profession: "Oshpaz", headline: "Milliy taomlar, tel 998901234567", place: "Samarqand viloyati", experience: "3–5 yil", salary: 5_000_000, salaryType: "monthly", schedules: ["5/2", "Smenali"] },
      t,
      BASE,
    );
    // ega (2026-11-22): boshida oddiy yozuv, heshteglarsiz — "Ishchi ish qidiryapti", keyin kasbi
    expect(p.html.startsWith("👤 Ishchi ish qidiryapti\n\n<b>Oshpaz</b>\n")).toBe(true);
    expect(p.html).not.toMatch(/ISHCHI|#/);
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


describe("kanal: usta e'loni (ega, 2026-11-24: ishchi e'lonlari kanaliga)", () => {
  const base = {
    slug: "santexnik-abc123",
    category: "Santexnik",
    title: "Santexnika ishlari, tez va sifatli",
    services: ["Kran almashtirish", "Unitaz o'rnatish"],
    place: "Chilonzor, Toshkent shahri",
    experienceYears: 5,
    priceFrom: 100_000,
    priceTo: null,
    negotiable: true,
    description: "Har kuni 8 dan 20 gacha.\nTel: +998 90 123 45 67\nKafolat beraman",
    photo: "https://x.supabase.co/storage/v1/object/public/listing-images/master/a.png",
  };

  it("turi, kategoriya, sarlavha, xizmatlar, joy, tajriba, narx, tavsif; telefon va ism yo'q; tugma — usta sahifasidagi aloqa", () => {
    const p = masterPost(base, t, BASE);
    expect(p.html.split("\n").slice(0, 9)).toEqual([
      "🛠 Universal ustalar xizmati",
      "",
      "<b>Santexnik</b>",
      "<i>Santexnika ishlari, tez va sifatli</i>",
      "🔧 Kran almashtirish, Unitaz o&#39;rnatish".replace("&#39;", "'"),
      "📍 Chilonzor, Toshkent shahri",
      "🧰 Tajriba: 5 yil",
      expect.stringMatching(/^💰 Narxi: .*100 000/),
      "",
    ]);
    expect(p.html).toContain("Kafolat beraman");
    expect(p.html).not.toMatch(/998|123 45 67/);
    expect(p.html.endsWith("📞 Raqam — «Bog'lanish» tugmasi orqali saytda")).toBe(true);
    expect(p.button).toEqual({ text: "📞 Bog'lanish", url: `${BASE}/ustalar/santexnik-abc123#contact` });
    expect(p.photo).toBe(base.photo);
    expect(p.caption).toBe(p.html);
  });

  it("narx yo'q — «Kelishiladi»; tajriba 0 — qator yo'q; sarlavha kategoriya bilan bir xil — takrorlanmaydi; rasm yo'q — rasmsiz xabar", () => {
    const p = masterPost({ ...base, title: "santexnik", priceFrom: null, experienceYears: 0, photo: null, description: null }, t, BASE);
    expect(p.html).toContain("💰 Narxi: Kelishiladi");
    expect(p.html).not.toContain("🧰");
    expect(p.html).not.toContain("<i>");
    expect(p.photo).toBeUndefined();
    expect(p.caption).toBeUndefined();
  });

  it("«Boshqa xizmatlar» — sarlavhada ustaning o'z yozgani; avtomatik tavsif (kategoriya: xizmatlar. Hudud…) takrorlanmaydi", () => {
    const p = masterPost(
      { ...base, category: "Boshqa xizmatlar", categorySlug: "other", title: "Tokar", services: ["Tokar"], description: "Boshqa xizmatlar: Tokar. Hudud: Buxoro, Romitan tumani.", photo: null },
      t,
      BASE,
    );
    expect(p.html.split("\n")[2]).toBe("<b>Tokar</b>");
    expect(p.html).not.toContain("Boshqa xizmatlar");
    expect(p.html).not.toContain("Hudud:");
  });

  it("Mini App havolasi — # siz", () => {
    const p = masterPost(base, t, BASE, (path) => `https://t.me/bot?startapp=${encodeURIComponent(path)}`);
    expect(p.button.url).toBe("https://t.me/bot?startapp=%2Fustalar%2Fsantexnik-abc123");
  });
});
