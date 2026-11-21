import { describe, expect, it } from "vitest";
import { matchRegion, nextPostAsk, parseExperience, parseName, parsePhone, postAnswers, type PostDraft } from "./post-logic";

const full: PostDraft = {
  profession: { id: "11111111-1111-4111-8111-111111111111", name: "Oshpaz" },
  regionId: "22222222-2222-4222-8222-222222222222",
  districtId: null,
  regions: [],
  firstName: "Botir",
  lastName: "",
  experience: "1_3",
  phone: "+998901234567",
};

describe("chatda e'lon: savollar bittadan, tartib bilan", () => {
  it("kasb → viloyat → ism → tajriba → telefon → tayyor", () => {
    expect(nextPostAsk({ ...full, profession: null, regionId: null })).toBe("post_profession");
    expect(nextPostAsk({ ...full, regionId: null })).toBe("post_region");
    expect(nextPostAsk({ ...full, firstName: "" })).toBe("post_name");
    expect(nextPostAsk({ ...full, experience: null })).toBe("post_experience");
    expect(nextPostAsk({ ...full, phone: null })).toBe("post_phone");
    expect(nextPostAsk(full)).toBeNull();
  });
  it("hisobdagi ism bo'lsa — ism so'ralmaydi", () => {
    expect(nextPostAsk({ ...full, experience: null })).toBe("post_experience");
  });
  it("to'liq bo'lsa — javoblar; bo'lmasa — null", () => {
    expect(postAnswers(full)).toEqual({ professionId: full.profession!.id, firstName: "Botir", lastName: "", regionId: full.regionId, districtId: null, experience: "1_3", phone: "+998901234567", phone2: null });
    expect(postAnswers({ ...full, phone: null })).toBeNull();
  });
});

describe("telefon yozilganidan", () => {
  it("odatiy yozuvlar", () => {
    expect(parsePhone("90 123 45 67")).toBe("+998901234567");
    expect(parsePhone("901234567")).toBe("+998901234567");
    expect(parsePhone("+998 90 123-45-67")).toBe("+998901234567");
    expect(parsePhone("998901234567")).toBe("+998901234567");
    expect(parsePhone("8 90 123 45 67")).toBe("+998901234567");
  });
  it("to'liq bo'lmasa yoki boshqa narsa — null", () => {
    expect(parsePhone("90 123")).toBeNull();
    expect(parsePhone("telefonim yo'q")).toBeNull();
  });
});

describe("tajriba yozilganidan", () => {
  it("yo'q", () => {
    expect(parseExperience("yo'q")).toBe("none");
    expect(parseExperience("Tajribam yo'q")).toBe("none");
    expect(parseExperience("нет")).toBe("none");
  });
  it("yil va oy", () => {
    expect(parseExperience("6 oy")).toBe("lt1");
    expect(parseExperience("2 yil")).toBe("1_3");
    expect(parseExperience("ikki yil ishlaganman")).toBe("1_3");
    expect(parseExperience("5 yildan ko'p")).toBe("3plus");
    expect(parseExperience("3 года")).toBe("3plus");
    expect(parseExperience("1 year")).toBe("1_3");
  });
  it("tushunilmasa — null", () => {
    expect(parseExperience("bilmadim")).toBeNull();
    expect(parseExperience("")).toBeNull();
  });
});

describe("ism yozilganidan", () => {
  it("ism va familiya, katta harf bilan", () => {
    expect(parseName("botir")).toEqual({ first: "Botir", last: "" });
    expect(parseName("Mening ismim Botir Karimov")).toEqual({ first: "Botir", last: "Karimov" });
    expect(parseName("Меня зовут Алишер")).toEqual({ first: "Алишер", last: "" });
  });
  it("raqam yoki uzun gap — null", () => {
    expect(parseName("90 123 45 67")).toBeNull();
    expect(parseName("men toshkentda oshpaz bo'lib ishlayman")).toBeNull();
    expect(parseName("a")).toBeNull();
  });
});

describe("yozilgan viloyat — tugmalardan biri", () => {
  const regions = [
    { value: "r1", label: "Toshkent shahri" },
    { value: "r2", label: "Toshkent viloyati" },
    { value: "r3", label: "Samarqand" },
  ];
  it("aniq bittasiga mos — o'sha; ikkitasiga mos yoki hech biri — null", () => {
    expect(matchRegion("samarqand", regions)?.value).toBe("r3");
    expect(matchRegion("Toshkent shahri", regions)?.value).toBe("r1");
    expect(matchRegion("toshkent", regions)).toBeNull();
    expect(matchRegion("moskva", regions)).toBeNull();
  });
});
