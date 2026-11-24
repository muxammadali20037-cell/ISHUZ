import { describe, expect, it } from "vitest";
import { extraKeysFor, extraLines, extrasFromName, hoursRelevant, isExtras, parseAge, parseGender, parseWorkHours, pickExtras, scheduleRelevant } from "./requirements";

describe("kasbga xos savollar (extraKeysFor)", () => {
  it("haydovchi — guvohnoma va mashina; haydovchi bo'lmagan (styuardessa) — tillar", () => {
    expect(extraKeysFor({ category: "driver", names: ["Taksi haydovchisi", "Водитель такси"] })).toEqual(["license", "car"]);
    expect(extraKeysFor({ category: "driver", names: ["Styuardessa (bort kuzatuvchisi)"] })).toEqual(["languages"]);
    // avtobus, samosval — mashina har doim ish beruvchiniki; traktor — boshqa guvohnoma
    expect(extraKeysFor({ category: "driver", names: ["Shahar avtobusi haydovchisi"] })).toEqual(["license"]);
    expect(extraKeysFor({ category: "driver", names: ["Traktor haydovchisi"] })).toEqual(["season"]);
  });
  it("kuryer — transport; PVZ operatori, dispetcher — tillar", () => {
    expect(extraKeysFor({ category: "courier", names: ["Ovqat yetkazib beruvchi"] })).toEqual(["transport"]);
    expect(extraKeysFor({ category: "courier", names: ["Buyurtmalarni topshirish punkti operatori (PVZ)"] })).toEqual(["languages"]);
    expect(extraKeysFor({ category: "courier", names: ["Kuryerlik xizmati dispetcheri"] })).toEqual(["languages"]);
  });
  it("tikuvchi — ishbay/oylik va mashina; usta va quruvchi — doimiy/bir martalik; IT — format va daraja; fotograf — buyurtma; oshpaz — joy va sanitar daftarcha", () => {
    expect(extraKeysFor({ category: "sewing", names: ["Tikuvchi"] })).toEqual(["pay", "machine"]);
    for (const c of ["construction", "craftsman", "plumber"]) expect(extraKeysFor({ category: c, names: ["Usta"] })).toEqual(["term"]);
    expect(extraKeysFor({ category: "electrician", names: ["Elektrik"] })).toEqual(["term", "el_group"]);
    expect(extraKeysFor({ category: "it", names: ["Frontend dasturchi"] })).toEqual(["format", "level"]);
    expect(extraKeysFor({ category: "design", names: ["Fotograf"] })).toEqual(["term"]);
    expect(extraKeysFor({ category: "restaurant", names: ["Oshpaz"] })).toEqual(["venue", "medbook"]);
    expect(extraKeysFor({ category: "other", names: ["Animator"] })).toEqual(["term"]);
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
    expect(workerExtraKeysFor({ category: "construction", names: ["Ekskavator operatori"] })).toEqual(["vaxta"]);
    expect(workerExtraKeysFor({ category: "construction", names: ["Prorab"] })).toEqual(["edu"]);
    expect(workerExtraKeysFor({ category: "driver", names: ["Samosval haydovchisi"] })).toEqual(["license"]);
    expect(workerExtraKeysFor({ category: "restaurant", names: ["Oshpaz"] })).toEqual(["venue", "medbook"]);
    expect(workerExtraKeysFor({ category: "other", names: ["Animator"] })).toEqual(["term_pref"]);
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

describe("katalog: hamma kasblar, ikkala rol (ega, 2026-11-24: «har bitta bosqich, har bir rol uchun aniq»)", () => {
  const CATEGORIES = ["other", "it", "sales", "marketing", "design", "finance", "driver", "logistics", "courier", "construction", "craftsman", "electrician", "plumber", "mechanic", "auto_service", "restaurant", "call_center", "office", "education", "medicine", "cleaning", "security", "sewing", "beauty", "production", "agriculture", "hotel", "legal", "science", "management", "government", "engineering", "telecom", "energy", "mining", "culture", "real_estate", "crafts"];
  const NAMES: Record<string, string> = { driver: "Haydovchi", courier: "Kuryer", logistics: "Yuklovchi", design: "Grafik dizayner" };

  it("har bir soha (\"Boshqa\" ham) — ish beruvchiga ham, ishchiga ham kamida bitta aniq savol", async () => {
    const { extraKeysFor, workerExtraKeysFor } = await import("./requirements");
    for (const c of CATEGORIES) {
      const p = { category: c, names: [NAMES[c] ?? "Mutaxassis"] };
      expect(extraKeysFor(p).length, `ish beruvchi: ${c}`).toBeGreaterThan(0);
      expect(workerExtraKeysFor(p).length, `ishchi: ${c}`).toBeGreaterThan(0);
    }
  });

  it("har savol va variantning matni 4 tilda bor (savol, tugma, e'londagi qator)", async () => {
    const { EXTRA_KEYS, EXTRA_OPTIONS, WORKER_EXTRA_KEYS, WORKER_EXTRA_OPTIONS } = await import("./requirements");
    const SILENT = new Set(["any", "not_required", "no", "none"]);
    for (const loc of ["uz", "oz", "ru", "en"]) {
      const easy = (await import(`../../../messages/${loc}/easy.json`)).default as Record<string, unknown>;
      const get = (path: string) => path.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), easy);
      const has = (path: string) => expect(typeof get(path) === "string" && (get(path) as string).length > 0, `${loc}: easy.${path}`).toBe(true);
      for (const k of EXTRA_KEYS) {
        has(`vguide.q.x_${k}`);
        has(`vguide.x.${k}.label`);
        if (k === "license") {
          has("vguide.x.license.option");
          has("vguide.x.license.line");
          continue;
        }
        for (const o of EXTRA_OPTIONS[k]) {
          has(`vguide.x.${k}.${o}`);
          if (!SILENT.has(o) && !(k === "format" && o === "remote")) has(`vguide.x.${k}.line_${o}`);
        }
      }
      for (const k of WORKER_EXTRA_KEYS) {
        has(`guided.ask_post_${k}`);
        has(`guided.placeholder_post_${k}`);
        if (k === "license") {
          has("guided.wx.license.option");
          has("guided.wx.license.line");
          continue;
        }
        for (const o of WORKER_EXTRA_OPTIONS[k]) {
          has(`guided.wx.${k}.${o}`);
          if (!SILENT.has(o)) has(`guided.wx.${k}.line_${o}`);
        }
      }
    }
  });

  it("gapdan: oshpaz — «kafe» va «sanitar daftarcha»; o'qituvchi — maktab va IELTS; qo'riqchi — sutkalik va armiya; konchi — vaxta", async () => {
    const { pickExtras, pickWorkerExtras } = await import("./requirements");
    expect(pickExtras("kafemizga oshpaz kerak, sanitar daftarchasi bo'lsin", ["venue", "medbook"])).toEqual({ venue: "cafe", medbook: "required" });
    expect(pickExtras("maktabga ingliz tili o'qituvchisi, IELTS 7", ["teach_place", "cert"])).toEqual({ teach_place: "school", cert: "required" });
    expect(pickExtras("qorovul kerak, sutkalik, armiyadan kelgan", ["guard_shift", "army"])).toEqual({ guard_shift: "day24", army: "required" });
    expect(pickExtras("konga ishchi kerak, vaxta 15/15", ["vaxta"])).toEqual({ vaxta: "yes" });
    expect(pickExtras("elektrik kerak, III guruh", ["term", "el_group"])).toEqual({ el_group: "g3" });
    expect(pickExtras("bog'chaga tarbiyachi", ["teach_place"])).toEqual({ teach_place: "kindergarten" });
    expect(pickExtras("bog'ga ishchi kerak", ["farm_place"])).toEqual({ farm_place: "garden" });
    expect(pickWorkerExtras("buxgalterman, 1C va Excel bilaman", ["fin_soft"])).toEqual({ fin_soft: "both" });
    expect(pickWorkerExtras("oshpazman, sanitar daftarcham bor", ["venue", "medbook"])).toEqual({ medbook: "yes" });
  });

  it("yozib javob: tugma matniga mos kelsa tanlanadi («maktabda» → Maktab, «o'quv markazi»), noaniq — null", async () => {
    const { parseWorkerExtra } = await import("./requirements");
    const labels = { school: "Maktab", center: "O'quv markazi", kindergarten: "Bog'cha", online: "Onlayn", private: "Uyda (repetitorlik)", any: "Farqi yo'q" };
    expect(parseWorkerExtra("teach_place", "maktabda", labels)).toBe("school");
    expect(parseWorkerExtra("teach_place", "o'quv markazi", labels)).toBe("center");
    expect(parseWorkerExtra("teach_place", "farqi yo'q", labels)).toBe("any");
    expect(parseWorkerExtra("teach_place", "qwerty", labels)).toBeNull();
    expect(parseWorkerExtra("army", "ha", {})).toBe("yes");
    expect(parseWorkerExtra("el_group", "3 guruh", {})).toBe("g3");
  });
});

describe("ishchi: jinsi va yoshi", () => {
  it("yosh: «28», «28 yosh», «yoshim 30», tug'ilgan yil «1998»; chegaradan tashqari — null", async () => {
    const { parseWorkerAge, parseWorkerGender, workerPersonLine, PERSON_LINE } = await import("./requirements");
    const now = new Date("2026-11-24T00:00:00Z");
    expect(parseWorkerAge("28", now)).toBe(28);
    expect(parseWorkerAge("28 yosh", now)).toBe(28);
    expect(parseWorkerAge("yoshim 30 da", now)).toBe(30);
    expect(parseWorkerAge("1998", now)).toBe(28);
    expect(parseWorkerAge("1998 yil", now)).toBe(28);
    expect(parseWorkerAge("9", now)).toBeNull();
    expect(parseWorkerAge("95", now)).toBeNull();
    expect(parseWorkerAge("bilmayman", now)).toBeNull();
    expect(parseWorkerGender("erkak")).toBe("male");
    expect(parseWorkerGender("Ayolman")).toBe("female");
    expect(parseWorkerGender("мужчина")).toBe("male");
    expect(parseWorkerGender("qwerty")).toBeNull();
    const t = (k: string, v?: Record<string, string | number>) => (k === "easy.guided.person_line" ? `${v!.gender}, ${v!.age} yosh` : k === "easy.vguide.male" ? "Erkak" : k === "easy.vguide.female" ? "Ayol" : `${v?.age} yosh`);
    expect(workerPersonLine("male", 28, t)).toBe("Erkak, 28 yosh");
    expect(workerPersonLine("female", null, t)).toBe("Ayol");
    expect(workerPersonLine(null, null, t)).toBeNull();
    expect(PERSON_LINE.test("✅ Erkak, 28 yosh")).toBe(true);
    expect(PERSON_LINE.test("✅ Мужчина, 28 лет")).toBe(true);
    expect(PERSON_LINE.test("✅ Obed tekin")).toBe(false);
  });
});

describe("e'lon matnida jinsi/yosh bandi", () => {
  it("yangisi ✅ ro'yxat boshiga, avvalgisi almashtiriladi; javob yo'q — matn o'zgarmaydi", async () => {
    const { withPersonLine } = await import("./requirements");
    expect(withPersonLine("Oshpazman.", "Erkak, 28 yosh")).toBe("Oshpazman.\n\n✅ Erkak, 28 yosh");
    expect(withPersonLine("Oshpazman.\n\n✅ Obed tekin", "Ayol, 30 yosh")).toBe("Oshpazman.\n\n✅ Ayol, 30 yosh\n✅ Obed tekin");
    expect(withPersonLine("Oshpazman.\n\n✅ Erkak, 28 yosh\n✅ Obed tekin", "Erkak, 29 yosh")).toBe("Oshpazman.\n\n✅ Erkak, 29 yosh\n✅ Obed tekin");
    expect(withPersonLine("Oshpazman.\n\n✅ Erkak, 28 yosh", null)).toBe("Oshpazman.\n\n✅ Erkak, 28 yosh");
  });
});

describe("soha ichida kasb nomiga qarab (audit, 2026-11-24)", () => {
  it("ta'lim: avtoinstruktor — guvohnoma, murabbiy — mashg'ulot joyi, dotsent — ilmiy daraja, psixolog — ma'lumoti, raqs — joy, ingliz tili — joy va sertifikat", async () => {
    const { extraKeysFor, workerExtraKeysFor } = await import("./requirements");
    const e = (n: string) => extraKeysFor({ category: "education", names: [n] });
    expect(e("Avtoinstruktor")).toEqual(["license"]);
    expect(e("Futbol murabbiyi")).toEqual(["sport_place"]);
    expect(e("Dotsent")).toEqual(["degree"]);
    expect(e("Maktab psixologi")).toEqual(["edu"]);
    expect(e("Raqs o'qituvchisi")).toEqual(["teach_place"]);
    expect(e("Ingliz tili o'qituvchisi")).toEqual(["teach_place", "cert"]);
    expect(workerExtraKeysFor({ category: "education", names: ["Gitara o'qituvchisi"] })).toEqual(["teach_place", "portfolio"]);
  });
  it("energetika, logistika, telekom, tozalash, yurist — kasbiga mos", async () => {
    const { extraKeysFor, workerExtraKeysFor } = await import("./requirements");
    expect(extraKeysFor({ category: "energy", names: ["Podstansiya elektromontyori"] })).toEqual(["el_group"]);
    expect(extraKeysFor({ category: "energy", names: ["Yoqilg'i quyish shoxobchasi operatori"] })).toEqual(["night"]);
    expect(extraKeysFor({ category: "logistics", names: ["Omborchi", "Кладовщик"] })).toEqual(["fin_soft"]);
    expect(extraKeysFor({ category: "logistics", names: ["Forklift operatori", "Оператор погрузчика"] })).toEqual(["night"]);
    expect(extraKeysFor({ category: "logistics", names: ["Yuklovchi", "Грузчик"] })).toEqual(["term", "night"]);
    expect(extraKeysFor({ category: "logistics", names: ["Logist"] })).toEqual(["languages"]);
    expect(extraKeysFor({ category: "telecom", names: ["Pochta avtomobili haydovchisi"] })).toEqual(["license"]);
    expect(extraKeysFor({ category: "telecom", names: ["Pochtalon"] })).toEqual(["transport"]);
    expect(extraKeysFor({ category: "cleaning", names: ["Enaga"] })).toEqual(["term"]);
    expect(workerExtraKeysFor({ category: "cleaning", names: ["Enaga"] })).toEqual(["medbook"]);
    expect(extraKeysFor({ category: "legal", names: ["Advokat"] })).toEqual(["lawyer_license"]);
    expect(extraKeysFor({ category: "legal", names: ["Notarius"] })).toEqual(["edu"]);
    expect(extraKeysFor({ category: "government", names: ["Ichki ishlar xodimi (politsiya)"] })).toEqual(["edu", "army"]);
  });
});
