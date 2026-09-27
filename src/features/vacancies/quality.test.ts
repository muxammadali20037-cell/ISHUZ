import { describe, expect, it } from "vitest";
import { assessVacancy, type QualityInput } from "./quality";

const good: QualityInput = {
  title: "Ofitsiant",
  description: "Chilonzordagi oilaviy kafemizga xushmuomala ofitsiant kerak. Vazifalar: mehmonlarni kutib olish, buyurtma qabul qilish, zalni toza saqlash.",
  salary_from: 4_000_000,
  salary_to: 5_000_000,
  salary_type: "monthly",
  salary_negotiable: false,
  is_remote: false,
  address: "Chilonzor 9-kvartal",
  district_id: "d1",
  work_time_from: "10:00",
  work_time_to: "22:00",
  age_min: 18,
  age_max: 35,
  skills: [1],
};
const keys = (v: Partial<QualityInput>) => assessVacancy({ ...good, ...v }).tips.map((t) => t.key);

describe("assessVacancy", () => {
  it("to'liq e'lon — yaxshi", () => {
    const r = assessVacancy(good);
    expect(r.tips).toEqual([]);
    expect(r.level).toBe("good");
    expect(r.score).toBe(100);
  });
  it("oldindan to'lov — xavf, birinchi o'rinda", () => {
    const r = assessVacancy({ ...good, description: `${good.description} Ishga kirish uchun oldindan to'lov 200 ming.`, skills: [] });
    expect(r.tips[0]?.key).toBe("scam_words");
    expect(r.level).toBe("weak");
    expect(keys({ description: "Требуется предоплата за форму" })).toContain("scam_words");
  });
  it("telefon yoki havola tavsifda", () => {
    expect(keys({ description: `${good.description} Tel: +998 90 123 45 67` })).toContain("contact_in_text");
    expect(keys({ description: `${good.description} t.me/kafe_hr` })).toContain("contact_in_text");
  });
  it("maosh: ko'rsatilmagan / g'ayrioddiy", () => {
    expect(keys({ salary_from: null, salary_to: null })).toContain("salary_missing");
    expect(keys({ salary_from: null, salary_to: null, salary_negotiable: true })).not.toContain("salary_missing");
    expect(keys({ salary_from: 100_000, salary_to: 200_000 })).toContain("salary_suspicious");
    expect(keys({ salary_type: "daily", salary_from: 300_000, salary_to: 300_000 })).not.toContain("salary_suspicious");
  });
  it("katta harflar, qisqa tavsif, undovlar", () => {
    expect(keys({ title: "SROCHNO OFITSIANT" })).toContain("caps_title");
    expect(keys({ description: "Ofitsiant kerak" })).toContain("description_short");
    expect(keys({ description: `${good.description}!!!` })).toContain("shouting");
  });
});
