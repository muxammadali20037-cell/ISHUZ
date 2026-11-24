import { describe, expect, it } from "vitest";
import { extraKeysFor, extraLines, extrasFromName, hoursRelevant, isExtras, parseAge, parseGender, parseWorkHours, pickExtras, scheduleRelevant } from "./requirements";

describe("kasbga xos savollar (extraKeysFor)", () => {
  it("haydovchi — guvohnoma va mashina; haydovchi bo'lmagan (styuardessa) — hech narsa", () => {
    expect(extraKeysFor({ category: "driver", names: ["Taksi haydovchisi", "Водитель такси"] })).toEqual(["license", "car"]);
    expect(extraKeysFor({ category: "driver", names: ["Styuardessa (bort kuzatuvchisi)"] })).toEqual([]);
    // avtobus, samosval — mashina har doim ish beruvchiniki; traktor — boshqa guvohnoma
    expect(extraKeysFor({ category: "driver", names: ["Shahar avtobusi haydovchisi"] })).toEqual(["license"]);
    expect(extraKeysFor({ category: "driver", names: ["Traktor haydovchisi"] })).toEqual([]);
  });
  it("kuryer — transport; PVZ operatori — yo'q", () => {
    expect(extraKeysFor({ category: "courier", names: ["Ovqat yetkazib beruvchi"] })).toEqual(["transport"]);
    expect(extraKeysFor({ category: "courier", names: ["Buyurtmalarni topshirish punkti operatori (PVZ)"] })).toEqual([]);
    expect(extraKeysFor({ category: "courier", names: ["Kuryerlik xizmati dispetcheri"] })).toEqual([]);
  });
  it("tikuvchi — ishbay/oylik; usta va quruvchi — doimiy/bir martalik; IT — format; fotograf — yo'q", () => {
    expect(extraKeysFor({ category: "sewing", names: ["Tikuvchi"] })).toEqual(["pay"]);
    for (const c of ["construction", "craftsman", "electrician", "plumber"]) expect(extraKeysFor({ category: c, names: ["Usta"] })).toEqual(["term"]);
    expect(extraKeysFor({ category: "it", names: ["Frontend dasturchi"] })).toEqual(["format"]);
    expect(extraKeysFor({ category: "design", names: ["Fotograf"] })).toEqual([]);
    expect(extraKeysFor({ category: "restaurant", names: ["Oshpaz"] })).toEqual([]);
    expect(extraKeysFor({ category: null, names: [] })).toEqual([]);
  });
  it("kasb nomining o'zidan: «C toifa haydovchi» → C, «Piyoda kuryer» → piyoda, «Avtokuryer» → avtomobil", () => {
    expect(extrasFromName({ category: "driver", names: ["C toifa haydovchi", "Водитель категории C"] })).toEqual({ license: "C" });
    expect(extrasFromName({ category: "courier", names: ["Piyoda kuryer"] })).toEqual({ transport: "foot" });
    expect(extrasFromName({ category: "courier", names: ["Avtokuryer"] })).toEqual({ transport: "car" });
  });
});

describe("matndan tushunish", () => {
  it("jinsi: ayol, yigit, ruscha; ikkalasi yoki «farqi yo'q» — any; «men» va «ayollar kiyimi» — tushunilmaydi", () => {
    expect(parseGender("Do'konga sotuvchi qiz kerak")).toBe("female");
    expect(parseGender("faqat ayollar, Chilonzor")).toBe("female");
    expect(parseGender("Нужна девушка администратор")).toBe("female");
    expect(parseGender("Omborga yigitlar kerak")).toBe("male");
    expect(parseGender("требуется мужчина грузчик")).toBe("male");
    expect(parseGender("ayol yoki erkak farqi yo'q")).toBe("any");
    expect(parseGender("jinsidan qat'i nazar")).toBe("any");
    expect(parseGender("Men oshpaz qidiryapman")).toBeNull();
    expect(parseGender("Ayollar kiyimi tikuvchisi kerak")).toBeNull();
    expect(parseGender("Qizil rangli forma beriladi")).toBeNull();
  });
  it("yosh: oraliq, dan–gacha, ruscha, faqat yuqori yoki quyi chegara; noto'g'ri — null", () => {
    expect(parseAge("18-35 yosh")).toEqual({ min: 18, max: 35 });
    expect(parseAge("25 yoshdan 40 yoshgacha")).toEqual({ min: 25, max: 40 });
    expect(parseAge("20 dan 35 yoshgacha")).toEqual({ min: 20, max: 35 });
    expect(parseAge("от 20 до 35 лет")).toEqual({ min: 20, max: 35 });
    expect(parseAge("30 yoshgacha bo'lsin")).toEqual({ min: 18, max: 30 });
    expect(parseAge("25 yoshdan katta")).toEqual({ min: 25, max: null });
    expect(parseAge("40-20 yosh")).toBeNull();
    expect(parseAge("oylik 5-7 mln")).toBeNull();
  });
  it("ish vaqti: 8:00-17:00, soat 9 dan 18 gacha, с 9 до 18; yosh va maosh bilan adashtirmaydi", () => {
    expect(parseWorkHours("ish vaqti 8:00-17:00")).toEqual({ from: "08:00", to: "17:00" });
    expect(parseWorkHours("soat 9 dan 18 gacha")).toEqual({ from: "09:00", to: "18:00" });
    expect(parseWorkHours("9 dan 18 gacha ishlash")).toEqual({ from: "09:00", to: "18:00" });
    expect(parseWorkHours("график с 9 до 18")).toEqual({ from: "09:00", to: "18:00" });
    expect(parseWorkHours("20 dan 35 yoshgacha")).toBeNull();
    expect(parseWorkHours("3 dan 5 mln gacha")).toBeNull();
    expect(parseWorkHours("от 18 до 35 лет")).toBeNull();
    expect(parseWorkHours("18-35 yosh")).toBeNull();
  });
  it("qo'shimcha javoblar faqat shu kasb savollaridan: «C toifa», «С тоифа» (kirill), mashina, bir martalik, ishbay", () => {
    expect(pickExtras("C toifali haydovchi, o'z mashinasi bilan", ["license", "car"])).toEqual({ license: "C", car: "own" });
    expect(pickExtras("С тоифа хайдовчи керак", ["license", "car"])).toEqual({ license: "C" });
    expect(pickExtras("категория CE, служебный автомобиль", ["license", "car"])).toEqual({ license: "CE", car: "company" });
    expect(pickExtras("uyni ta'mirlashga bir martalik usta kerak", ["term"])).toEqual({ term: "once" });
    expect(pickExtras("tikuvchi kerak, dona bay", ["pay"])).toEqual({ pay: "piece" });
    expect(pickExtras("piyoda kuryer", ["term"])).toEqual({});
    expect(pickExtras("dasturchi, gibrid format", ["format"])).toEqual({ format: "hybrid" });
  });
});

describe("qachon so'raladi", () => {
  it("ish vaqti: masofaviy, bir martalik, smenali va erkin grafikda — yo'q", () => {
    expect(hoursRelevant({ remote: false, schedule: "5_2" })).toBe(true);
    expect(hoursRelevant({ remote: false, schedule: "" })).toBe(true);
    expect(hoursRelevant({ remote: true, schedule: "" })).toBe(false);
    expect(hoursRelevant({ remote: false, schedule: "", extras: { term: "once" } })).toBe(false);
    expect(hoursRelevant({ remote: false, schedule: "shift" })).toBe(false);
    expect(hoursRelevant({ remote: false, schedule: "flexible" })).toBe(false);
    expect(scheduleRelevant({ extras: { term: "once" } })).toBe(false);
    expect(scheduleRelevant({ extras: { term: "permanent" } })).toBe(true);
  });
  it("e'lon matni bandlari: farqi yo'q va masofaviy yozilmaydi; qoralama tekshiruvi", () => {
    const t = (k: string, v?: Record<string, string | number>) => `${k}${v ? `:${JSON.stringify(v)}` : ""}`;
    expect(extraLines({ license: "C", car: "own" }, ["license", "car"], t)).toEqual(['easy.vguide.x.license.line:{"value":"C"}', 'easy.vguide.x.car.line_own:{"value":"own"}']);
    expect(extraLines({ transport: "any" }, ["transport"], t)).toEqual([]);
    expect(extraLines({ format: "remote" }, ["format"], t)).toEqual([]);
    // savoli bo'lmagan javob (kasb o'zgargan) — yozilmaydi
    expect(extraLines({ term: "once" }, ["pay"], t)).toEqual([]);
    expect(isExtras({ license: "C" })).toBe(true);
    expect(isExtras({ license: "Z" })).toBe(false);
    expect(isExtras({ hack: "1" })).toBe(false);
    expect(isExtras(undefined)).toBe(true);
  });
});

describe("ishchi e'loni: kasbga xos savollar", () => {
  it("haydovchi — guvohnoma va mashina; kuryer — transport; usta — asboblar; boshqa kasb — yo'q (kirillcha nom ham)", async () => {
    const { workerExtraKeysFor } = await import("./requirements");
    expect(workerExtraKeysFor({ category: "driver", names: ["Haydovchi"] })).toEqual(["license", "car"]);
    expect(workerExtraKeysFor({ category: "driver", names: ["Ҳайдовчи"] })).toEqual(["license", "car"]);
    expect(workerExtraKeysFor({ category: "courier", names: ["Piyoda kuryer"] })).toEqual(["transport"]);
    expect(workerExtraKeysFor({ category: "plumber", names: ["Santexnik"] })).toEqual(["tools"]);
    expect(workerExtraKeysFor({ category: "construction", names: ["Ekskavator operatori"] })).toEqual([]);
    expect(workerExtraKeysFor({ category: "driver", names: ["Samosval haydovchisi"] })).toEqual(["license"]);
    expect(workerExtraKeysFor({ category: "restaurant", names: ["Oshpaz"] })).toEqual([]);
  });
  it("yozganidan tushunadi va bitta savolga yozilgan javobni («C», «ha», «нет», «velosipedda») taniydi", async () => {
    const { parseWorkerExtra, pickWorkerExtras, workerExtraLines } = await import("./requirements");
    expect(pickWorkerExtras("C toifa haydovchiman, mashinam bor", ["license", "car"])).toEqual({ license: "C", car: "yes" });
    expect(pickWorkerExtras("santexnikman, o'z asboblarim bor", ["tools"])).toEqual({ tools: "yes" });
    expect(pickWorkerExtras("kuryerman velosipedda", ["transport"])).toEqual({ transport: "bike" });
    expect(parseWorkerExtra("license", "C")).toBe("C");
    expect(parseWorkerExtra("license", "bc toifa")).toBe("BC");
    expect(parseWorkerExtra("license", "Z")).toBeNull();
    expect(parseWorkerExtra("car", "ha")).toBe("yes");
    expect(parseWorkerExtra("car", "нет")).toBe("no");
    expect(parseWorkerExtra("car", "bilmadim")).toBeNull();
    expect(parseWorkerExtra("tools", "yo'q")).toBe("no");
    expect(parseWorkerExtra("transport", "velosipedda")).toBe("bike");
    const t = (k: string, v?: Record<string, string | number>) => `${k}${v ? `:${v.value}` : ""}`;
    expect(workerExtraLines({ license: "C", car: "no" }, ["license", "car"], t)).toEqual(["easy.guided.wx.license.line:C"]);
  });
});
