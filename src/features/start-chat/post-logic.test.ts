import { describe, expect, it } from "vitest";
import { matchRegion, nextPostAsk, parseExperience, parseName, parsePhone, postAnswers, postDraftFromForm, withProfession, type PostDraft } from "./post-logic";

const full: PostDraft = {
  profession: { id: "11111111-1111-4111-8111-111111111111", name: "Oshpaz" },
  regionId: "22222222-2222-4222-8222-222222222222",
  districtId: null,
  regions: [],
  firstName: "Botir",
  lastName: "",
  experience: "1_3",
  notes: ["Obed tekin"],
  phone: "+998901234567",
  extras: {},
  said: "",
  gender: "male",
  age: 30,
};

describe("chatda e'lon: savollar bittadan, tartib bilan", () => {
  it("kasb → viloyat → ism → tajriba → izoh (ixtiyoriy) → telefon → tayyor", () => {
    expect(nextPostAsk({ ...full, profession: null, regionId: null })).toBe("post_profession");
    expect(nextPostAsk({ ...full, regionId: null })).toBe("post_region");
    expect(nextPostAsk({ ...full, firstName: "" })).toBe("post_name");
    expect(nextPostAsk({ ...full, experience: null })).toBe("post_experience");
    // 2026-11-22: izoh — tajribadan keyin; "Izohsiz" (bo'sh ro'yxat) ham javob
    expect(nextPostAsk({ ...full, notes: null })).toBe("post_note");
    expect(nextPostAsk({ ...full, notes: [], phone: null })).toBe("post_phone");
    expect(nextPostAsk({ ...full, phone: null })).toBe("post_phone");
    expect(nextPostAsk(full)).toBeNull();
  });
  it("kasbga xos savollar — kasbdan keyin darhol (ega, 2026-11-24); gapda aytilgani so'ralmaydi; javoblar e'longa", () => {
    const driver = { id: full.profession!.id, name: "Haydovchi", extraKeys: ["license", "car"] as ("license" | "car")[] };
    const d = { ...full, profession: driver };
    expect(nextPostAsk({ ...d, regionId: null })).toBe("post_license");
    expect(nextPostAsk({ ...d, extras: { license: "C" } })).toBe("post_car");
    expect(nextPostAsk({ ...d, extras: { license: "C", car: "no" } })).toBeNull();
    // birinchi gapdan: "C toifa haydovchiman, mashinam bor" — ikkala savol ham o'tkaziladi
    const form = { text: "C toifa haydovchiman, mashinam bor", profession: driver, regionId: null, districtId: null, regions: [], districts: {}, loggedIn: true, firstName: "Botir", lastName: "" };
    expect(postDraftFromForm(form).extras).toEqual({ license: "C", car: "yes" });
    expect(nextPostAsk(postDraftFromForm(form))).toBe("post_region");
    // kasb keyin o'zgarsa — boshqa kasbning javobi tashlanadi, gapdagisi qayta o'qiladi
    const courier = { id: full.profession!.id, name: "Kuryer", extraKeys: ["transport"] as "transport"[] };
    expect(withProfession({ ...postDraftFromForm(form), said: "velosipedim bor, kuryerman" }, courier).extras).toEqual({ transport: "bike" });
    expect(postAnswers({ ...d, extras: { license: "C", car: "no" } })?.extras).toEqual({ license: "C", car: "no" });
    // kasb nomidan: "Piyoda kuryer" — transport so'ralmaydi (nomdagisi gapdagidan ustun)
    const foot = { id: full.profession!.id, name: "Piyoda kuryer", extraKeys: ["transport"] as "transport"[] };
    expect(withProfession({ ...full, said: "velosipedim bor" }, foot).extras).toEqual({ transport: "foot" });
    expect(nextPostAsk(withProfession(full, foot))).toBeNull();
  });
  it("ismdan keyin — jinsi va yoshi (ega, 2026-11-24: «kanalga jinsi, yoshi kelmayapti»); gapda «28 yoshli» bo'lsa — yosh so'ralmaydi", () => {
    expect(nextPostAsk({ ...full, gender: null })).toBe("post_gender");
    expect(nextPostAsk({ ...full, age: null })).toBe("post_age");
    expect(nextPostAsk({ ...full, gender: null, experience: null })).toBe("post_gender");
    const form = { text: "28 yoshli oshpazman", profession: { id: full.profession!.id, name: "Oshpaz" }, regionId: null, districtId: null, regions: [], districts: {}, loggedIn: true, firstName: "Botir", lastName: "" };
    expect(postDraftFromForm(form).age).toBe(28);
    expect(postDraftFromForm({ ...form, text: "oshpazman, 5 yil tajriba" }).age).toBeNull();
  });
  it("hisobdagi ism bo'lsa — ism so'ralmaydi", () => {
    expect(nextPostAsk({ ...full, experience: null })).toBe("post_experience");
  });
  it("to'liq bo'lsa — javoblar; bo'lmasa — null", () => {
    expect(postAnswers(full)).toEqual({ professionId: full.profession!.id, firstName: "Botir", lastName: "", regionId: full.regionId, districtId: null, experience: "1_3", phone: "+998901234567", phone2: null, notes: ["Obed tekin"], gender: "male", age: 30 });
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
