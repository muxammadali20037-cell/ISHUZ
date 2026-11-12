import { describe, expect, it } from "vitest";
import { stripSuffix } from "@/features/find/intent";
import { EMPTY_COLLECTED, chatProgress, experienceFromMonths, nextField, parseExperienceAnswer, parseNameAnswer, parseSalaryAnswer, type ChatCollected } from "./chat-logic";

const prof = { id: "p1", categoryId: "c1", trail: [{ id: "p1", name_uz: "Moto kuryer", name_ru: "Мотокурьер", name_en: null }] } as unknown as ChatCollected["profession"];
const guest = { firstName: "", hasPhone: false };

describe("e'lon suhbati: savollar tartibi", () => {
  it("kasb → viloyat → tuman → tajriba → grafik → maosh → ism → telefon → o'zi haqida → tayyor", () => {
    let c: ChatCollected = { ...EMPTY_COLLECTED };
    const order: string[] = [];
    const answers: Array<(x: ChatCollected) => ChatCollected> = [
      (x) => ({ ...x, profession: prof }),
      (x) => ({ ...x, place: { regionId: "r1", districtId: null, districtChosen: false, remote: false } }),
      (x) => ({ ...x, place: { ...x.place, districtId: "d1", districtChosen: true } }),
      (x) => ({ ...x, experience: "1_3" }),
      (x) => ({ ...x, schedule: "any" }),
      (x) => ({ ...x, salary: "negotiable" }),
      (x) => ({ ...x, firstName: "Aziz" }),
      (x) => ({ ...x, phone: "901234567" }),
      (x) => ({ ...x, about: "Moto kuryer bo'lib ishlamoqchiman." }),
    ];
    for (const a of answers) {
      order.push(nextField(c, guest)!);
      c = a(c);
    }
    expect(order).toEqual(["profession", "region", "district", "experience", "schedule", "salary", "name", "phone", "about"]);
    expect(nextField(c, guest)).toBeNull();
    expect(chatProgress(c, guest)).toEqual({ done: 8, total: 8 });
  });

  it("profildan ma'lum ism va telefon so'ralmaydi; birinchi gapdan tushunilganlar qayta so'ralmaydi", () => {
    const c: ChatCollected = { ...EMPTY_COLLECTED, profession: prof, place: { regionId: "r1", districtId: "d1", districtChosen: true, remote: false }, experience: "none", schedule: "5_2", salary: "5000000" };
    expect(nextField(c, { firstName: "Aziz", hasPhone: true })).toBe("about");
    expect(chatProgress(EMPTY_COLLECTED, { firstName: "Aziz", hasPhone: true }).done).toBe(2);
  });
});

describe("javoblarni tushunish", () => {
  it("tajriba", () => {
    expect(parseExperienceAnswer("3 yil")).toBe("3plus");
    expect(parseExperienceAnswer("2 yil ishlaganman")).toBe("1_3");
    expect(parseExperienceAnswer("6 oy")).toBe("lt1");
    expect(parseExperienceAnswer("yo'q")).toBe("none");
    expect(parseExperienceAnswer("tajribam yo‘q")).toBe("none");
    expect(parseExperienceAnswer("без опыта")).toBe("none");
    expect(parseExperienceAnswer("1,5 года")).toBe("1_3");
    expect(parseExperienceAnswer("bilmadim")).toBeNull();
    expect(experienceFromMonths(false, 36)).toBe("3plus");
    expect(experienceFromMonths(true, 60)).toBe("none");
  });

  it("maosh: savol maosh haqida — '5' = 5 mln, '800' = 800 ming; kelishiladi; aqlga sig'maydigani rad", () => {
    expect(parseSalaryAnswer("5 mln")).toEqual({ amount: 5_000_000 });
    expect(parseSalaryAnswer("5")).toEqual({ amount: 5_000_000 });
    expect(parseSalaryAnswer("4,5 mln")).toEqual({ amount: 4_500_000 });
    expect(parseSalaryAnswer("4 500 000 so'm")).toEqual({ amount: 4_500_000 });
    expect(parseSalaryAnswer("800 ming")).toEqual({ amount: 800_000 });
    expect(parseSalaryAnswer("800")).toEqual({ amount: 800_000 });
    expect(parseSalaryAnswer("7 млн")).toEqual({ amount: 7_000_000 });
    expect(parseSalaryAnswer("Kelishiladi")).toEqual({ negotiable: true });
    expect(parseSalaryAnswer("договорная")).toEqual({ negotiable: true });
    expect(parseSalaryAnswer("ko'p")).toBeNull();
    expect(parseSalaryAnswer("900 mln")).toBeNull();
  });

  it("ism: faqat harflar, 1–3 so'z; 'mening ismim …' olib tashlanadi", () => {
    expect(parseNameAnswer("aziz")).toEqual({ firstName: "Aziz", lastName: "" });
    expect(parseNameAnswer("Mening ismim Aziz Karimov")).toEqual({ firstName: "Aziz", lastName: "Karimov" });
    expect(parseNameAnswer("Меня зовут Азиз")).toEqual({ firstName: "Азиз", lastName: "" });
    expect(parseNameAnswer("O'tkir")).toEqual({ firstName: "O'tkir", lastName: "" });
    expect(parseNameAnswer("90 123 45 67")).toBeNull();
    expect(parseNameAnswer("men har qanday ishni qila olaman")).toBeNull();
  });

  it("kasb so'zi qo'shma qo'shimcha bilan: 'kuryerlikdan' → 'kuryer' (dispetcher emas)", () => {
    expect(stripSuffix("kuryerlikdan")).toContain("kuryer");
    expect(stripSuffix("oshpazlikka")).toContain("oshpaz");
    expect(stripSuffix("haydovchilikdan")).toContain("haydovchi");
  });
});
