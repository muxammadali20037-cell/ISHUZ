import { describe, expect, it } from "vitest";
import { statsSubject, summarizeSalaries } from "./market-math";

const m = (from: number | null, to: number | null, extra: Partial<{ salary_type: string; salary_negotiable: boolean }> = {}) => ({
  salary_from: from,
  salary_to: to,
  salary_type: "monthly",
  salary_negotiable: false,
  ...extra,
});

describe("summarizeSalaries — faqat haqiqiy oylik maoshlar", () => {
  it("3 tadan kam e'lon — oraliq yo'q (taxmin chiqarilmaydi)", () => {
    expect(summarizeSalaries([])).toBeNull();
    expect(summarizeSalaries([m(4_000_000, 6_000_000), m(5_000_000, null)])).toBeNull();
  });

  it("o'rta qiymat (dan–gacha o'rtasi), mediana, chegaralar; 100 mingga yaxlitlanadi", () => {
    expect(summarizeSalaries([m(4_000_000, 6_000_000), m(5_000_000, null), m(null, 8_000_000), m(3_050_000, 3_050_000)])).toEqual({
      n: 4,
      min: 3_100_000,
      median: 5_000_000,
      max: 8_000_000,
    });
  });

  it("kelishiladi, kunlik/soatlik va g'ayrioddiy qiymatlar hisobga olinmaydi", () => {
    const rows = [
      m(4_000_000, 5_000_000),
      m(5_000_000, 6_000_000),
      m(6_000_000, 7_000_000),
      m(200_000, null, { salary_type: "daily" }),
      m(9_000_000, null, { salary_negotiable: true }),
      m(10, 20),
      m(1_000_000_000, null),
    ];
    expect(summarizeSalaries(rows)).toEqual({ n: 3, min: 4_500_000, median: 5_500_000, max: 6_500_000 });
  });
});

describe("statsSubject — savoldan kasb va joy", () => {
  it("so'roq so'zlari olib tashlanadi, kasb va joy qoladi", () => {
    expect(statsSubject("Samarqandda buxgalter maoshi qancha?")).toBe("Samarqandda buxgalter");
    expect(statsSubject("Oshpaz o‘rtacha oyligi qancha")).toBe("Oshpaz");
    expect(statsSubject("Сколько получает повар в Ташкенте?")).toBe("повар в Ташкенте");
    expect(statsSubject("How much does a cook earn in Samarkand?")).toBe("cook Samarkand");
    expect(statsSubject("Samarqandda-chi?")).toBe("Samarqandda");
  });
  it("faqat so'roq — bo'sh (kasb so'raladi; 'talab' yoki 'statistika' kasb deb olinmaydi)", () => {
    for (const q of ["statistika", "Kasbim bo'yicha maosh qancha va talab qanday?", "Касбим бўйича маош қанча ва талаб қандай?", "Сколько платят по моей профессии и какой спрос?", "How much does my job pay and is it in demand?", "Xodimga qancha maosh taklif qilay? Bozordagi maoshni ko'rsating"])
      expect(statsSubject(q), q).toBe("");
  });
});

