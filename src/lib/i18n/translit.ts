/**
 * O'zbek lotin → kirill transliteratsiyasi (1995-yilgi lotin alifbosi qoidalari asosida).
 * Kirill interfeys (oz) shu funksiya bilan o'zbekcha matnlardan hosil qilinadi; bazadagi nomlar (soha, kasb, hudud)
 * ham ko'rsatishda shu yo'l bilan o'giriladi. {o'zgaruvchi}, URL va lotin harfli brend/qisqartmalar o'zgarmaydi.
 */

const APOS = "['‘’ʻʼ`´]";

/** O'zgarmaydigan so'zlar: brendlar, xalqaro qisqartmalar va texnik atamalar */
const KEEP = new Set(
  [
    "telegram", "payme", "click", "google", "android", "ios", "iphone", "uzum", "wildberries", "ozon", "yandex", "express24", "wolt",
    "it", "ai", "smm", "seo", "hr", "cv", "pdf", "uzs", "top", "qa", "ui", "ux", "crm", "1c", "sms", "otp", "gps", "id", "url", "pwa",
    "ielts", "cefr", "sat", "celta", "tesol", "toefl", "react", "next.js", "python", "java", "php", "flutter", "figma", "devops",
    "full-time", "part-time", "freelance", "online", "offline", "email", "e-mail", "instagram", "facebook", "whatsapp", "linkedin", "github",
  ].map((w) => w.toLowerCase()),
);

const VOWELS = "aeiouö"; // lotin unlilar (o' alohida qayta ishlanadi)

const PAIRS: [RegExp, string, string][] = [
  // [naqsh, kichik, katta]  — tartib muhim
  [new RegExp(`^o${APOS}`, "i"), "ў", "Ў"],
  [new RegExp(`^g${APOS}`, "i"), "ғ", "Ғ"],
  [/^sh/i, "ш", "Ш"],
  [/^ch/i, "ч", "Ч"],
  [/^yo/i, "ё", "Ё"],
  [/^yu/i, "ю", "Ю"],
  [/^ya/i, "я", "Я"],
  [/^ye/i, "е", "Е"],
];

const SINGLE: Record<string, string> = {
  a: "а", b: "б", d: "д", f: "ф", g: "г", h: "ҳ", i: "и", j: "ж", k: "к", l: "л", m: "м", n: "н", o: "о",
  p: "п", q: "қ", r: "р", s: "с", t: "т", u: "у", v: "в", x: "х", y: "й", z: "з",
};

function isUpper(ch: string) {
  return ch !== ch.toLowerCase();
}

/** Bitta so'zni o'giradi (faqat o'zbek lotin harflaridan iborat bo'lsa) */
function word(w: string): string {
  const lower = w.toLowerCase();
  if (KEEP.has(lower)) return w;
  // brend + qo'shimcha: Telegram'ga → Telegramга (kirillda ajratuvchi belgi qo'yilmaydi)
  const brand = new RegExp(`^(.+?)${APOS}(.+)$`).exec(w);
  if (brand?.[1] && brand[2] && KEEP.has(brand[1].toLowerCase())) return brand[1] + word(brand[2]);
  // o'zbek lotin alifbosida yo'q harflar (c — "ch" dan tashqari, w) bo'lsa — chet so'z, o'zgartirilmaydi
  if (/w/i.test(w) || /c(?!h)/i.test(w)) return w;
  // 2–4 harfli bosh harfli qisqartmalar (IT, SMM, YATT) — o'zgarmaydi
  if (/^[A-Z]{2,5}$/.test(w) && !/^(YATT|MHOBT|STIR)$/.test(w)) return w;

  let out = "";
  let i = 0;
  while (i < w.length) {
    const rest = w.slice(i);
    const ch = w[i] ?? "";
    let matched = false;
    for (const [re, lo, up] of PAIRS) {
      const m = re.exec(rest);
      if (m) {
        out += isUpper(m[0][0] ?? "") ? up : lo;
        i += m[0].length;
        matched = true;
        break;
      }
    }
    if (matched) continue;
    const l = ch.toLowerCase();
    if (l === "e") {
      // so'z boshida va unlidan keyin "э", aks holda "е"
      const prev = i > 0 ? (w[i - 1] ?? "").toLowerCase() : "";
      const cyr = i === 0 || VOWELS.includes(prev) ? "э" : "е";
      out += isUpper(ch) ? cyr.toUpperCase() : cyr;
    } else if (/['‘’ʻʼ`´]/.test(ch)) {
      out += "ъ"; // tutuq belgisi (ma'no → маъно)
    } else if (SINGLE[l]) {
      const cyr = SINGLE[l];
      out += isUpper(ch) ? cyr.toUpperCase() : cyr;
    } else {
      out += ch;
    }
    i += 1;
  }
  return out;
}

/** Matnni o'giradi: {o'zgaruvchilar}, URL va e-pochtalar o'zgarmaydi */
export function latinToCyrillic(text: string): string {
  if (!text) return text;
  // Brend nomi har doim lotinda: «Ish Beruvchi»
  return text
    .split(/(Ish Beruvchi)/)
    .map((chunk, j) => (j % 2 === 1 ? chunk : translitChunk(chunk)))
    .join("");
}

function translitChunk(text: string): string {
  return text
    .split(/(\{[^}]*\}|https?:\/\/\S+|\S+@\S+\.\S+|\/[a-z0-9/_-]+)/gi)
    .map((part, idx) => {
      if (idx % 2 === 1) return part; // himoyalangan bo'lak
      return part.replace(/[A-Za-z0-9.+-]*[A-Za-z][A-Za-z0-9'‘’ʻʼ`.+-]*/g, (w) => {
        // so'z oxiridagi nuqta/apostrof yopishib qolmasin
        const m = /^(.*?)([.]*)$/.exec(w)!;
        return word(m[1] ?? "") + (m[2] ?? "");
      });
    })
    .join("");
}
