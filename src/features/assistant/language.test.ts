import { describe, expect, it } from "vitest";
import { conversationLanguage, detectLanguage } from "./language";

describe("detectLanguage — xabar tili va yozuvi", () => {
  it("o'zbek lotin", () => {
    expect(detectLanguage("Chilonzorda oshpaz ish kerak")).toBe("uz");
    expect(detectLanguage("salom, menga kunlik ish topib bering")).toBe("uz");
    expect(detectLanguage("O‘zimga mos ish qidiryapman")).toBe("uz");
  });
  it("o'zbek kirill", () => {
    expect(detectLanguage("Чилонзорда ошпаз иш керак")).toBe("oz");
    expect(detectLanguage("менга ҳайдовчи керак")).toBe("oz");
    expect(detectLanguage("Қандай ишлар бор?")).toBe("oz");
  });
  it("rus", () => {
    expect(detectLanguage("ищу работу поваром в Ташкенте")).toBe("ru");
    expect(detectLanguage("Здравствуйте, нужен водитель")).toBe("ru");
  });
  it("ingliz", () => {
    expect(detectLanguage("I am looking for a job as a cook")).toBe("en");
    expect(detectLanguage("hello, can you help me find work?")).toBe("en");
  });
  it("aniqlab bo'lmasa — oldingi til (bitta so'z, ism, son)", () => {
    expect(detectLanguage("oshpaz", "uz")).toBe("uz");
    expect(detectLanguage("Chilonzor", "en")).toBe("en");
    expect(detectLanguage("Ташкент", "oz")).toBe("oz");
    expect(detectLanguage("Ташкент", "uz")).toBe("ru");
    expect(detectLanguage("5 000 000", "ru")).toBe("ru");
    expect(detectLanguage("👍", "oz")).toBe("oz");
  });
  it("suhbat tili: oxirgi aniq xabar hal qiladi", () => {
    // ruscha boshlab, keyin lotinda o'zbekcha so'z yozdi — javob o'zbek lotinda
    expect(conversationLanguage(["ищу работу", "oshpaz"], "uz")).toBe("uz");
    expect(conversationLanguage(["salom", "Ташкент"], "uz")).toBe("ru");
    expect(conversationLanguage(["Қандай ишлар бор?", "Самарқанд"], "uz")).toBe("oz");
    expect(conversationLanguage([], "en")).toBe("en");
  });
});
