import { describe, expect, it } from "vitest";
import { latinToCyrillic as c } from "./translit";

describe("latinToCyrillic", () => {
  it("asosiy harflar va qo'shma harflar", () => {
    expect(c("O'zbekiston")).toBe("Ўзбекистон");
    expect(c("g'isht teruvchi")).toBe("ғишт терувчи");
    expect(c("Shifokor va choyxona")).toBe("Шифокор ва чойхона");
    expect(c("Yoshlar, yuk, yangi, yer")).toBe("Ёшлар, юк, янги, ер");
    expect(c("Ish qidiryapman")).toBe("Иш қидиряпман");
    expect(c("Haydovchi")).toBe("Ҳайдовчи");
  });
  it("yo + tutuq: y va o' alohida (йўқ, йўл), oddiy yo — ё", () => {
    expect(c("yo'q")).toBe("йўқ");
    expect(c("Yo'nalish")).toBe("Йўналиш");
    expect(c("yo‘l")).toBe("йўл");
    expect(c("bor-yo'qligi")).toBe("бор-йўқлиги");
    expect(c("yoz yordam")).toBe("ёз ёрдам");
  });

  it("e harfi: so'z boshida э, ichida е", () => {
    expect(c("E'lon")).toBe("Эълон");
    expect(c("ekskavator operatori")).toBe("экскаватор оператори");
    expect(c("Telefon")).toBe("Телефон");
  });
  it("tutuq belgisi → ъ", () => {
    expect(c("ma'lumot")).toBe("маълумот");
    expect(c("Ta’lim")).toBe("Таълим");
  });
  it("o'zgaruvchilar, brendlar va qisqartmalar o'zgarmaydi", () => {
    expect(c("Salom, {name} 👋")).toBe("Салом, {name} 👋");
    expect(c("Telegram orqali kirish")).toBe("Telegram орқали кириш");
    expect(c("IT va SMM")).toBe("IT ва SMM");
    expect(c("Batafsil: https://ishtopdim.uz/jobs")).toBe("Батафсил: https://ishtopdim.uz/jobs");
    expect(c("Full-time ish")).toBe("Full-time иш");
    expect(c("Telegram'ga keladi")).toBe("Telegramга келади");
  });
});

describe("kirill (oz) xabarlari", () => {
  it("noto'g'ri \"ёъ\" yo'q (yo'q → йўқ, yo'l → йўл)", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const dir = path.join(__dirname, "../../../messages/oz");
    const bad = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".json"))
      .flatMap((f) => (fs.readFileSync(path.join(dir, f), "utf8").match(/[^\s"]*[ёЁ][ъЪ][^\s",]*/g) ?? []).map((w) => `${f}: ${w}`));
    expect(bad).toEqual([]);
  });
});
