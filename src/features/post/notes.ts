/**
 * E'londagi "Izoh" (ega, 2026-11-22: "ishchi va ish beruvchi e'lon joylayotganda izoh yozish bo'lsin — masalan «obed,
 * yo'lkira tekin»; shularni chiroyli e'lon qilib taxlash kerak, keyin joylash"). Yozilgan izoh bandlarga ajratiladi,
 * tozalanadi va ✅ bilan qatorma-qator e'lon matniga qo'shiladi. Sof funksiyalar (mijoz, server va testlar uchun).
 *
 *  · "obed, yo'lkira tekin" → ["Obed tekin", "Yo'lkira tekin"] — oxirgi bandning "tekin/bepul/beriladi" so'zi o'zidan
 *    oldingi qisqa (1–2 so'zli) bandlarga ham tegishli deb olinadi;
 *  · telefon raqami, havola, @nik — olib tashlanadi (raqam faqat o'z maydonida);
 *  · ko'pi bilan 8 band, har biri 80 belgigacha; takrorlar yo'q.
 */
/** Tayyor variantlar (kalitlar; matni — easy.notes.<vacancy|worker>.<kalit>) */
export const VACANCY_NOTE_PRESETS = ["lunch", "fare", "dorm", "uniform", "official", "ontime"] as const;
export const WORKER_NOTE_PRESETS = ["car", "night", "now", "docs", "russian"] as const;

const QUALIFIERS = ["tekin", "bepul", "beriladi", "bor", "bilan", "to'lanadi", "kafolatlanadi", "бесплатно", "бесплатный", "есть", "free", "provided"];
const LABEL_ONLY = /^(?:tel|telefon|nomer|raqam|raqamim|aloqa|тел|телефон|номер|phone|contact)$/i;
const MAX_ITEMS = 8;
const MAX_LEN = 80;

function clean(s: string): string {
  return s
    .replace(/https?:\/\/\S+|t\.me\/\S+|www\.\S+/gi, " ")
    .replace(/@[A-Za-z0-9_]{3,}/g, " ")
    .replace(/\+?\d[\d\s()-]{6,}\d/g, " ")
    .replace(/[✅✔☑•·*-]+\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.;:!]+$/g, "")
    .trim();
}

function capitalize(s: string): string {
  return s ? s.charAt(0).toLocaleUpperCase("uz") + s.slice(1) : s;
}

/** Yozilgan matn (va tanlangan tayyor variantlar) → tartibli bandlar */
export function formatNotes(text: string, picked: readonly string[] = []): string[] {
  const raw = [...picked, ...text.split(/[\n,;]+|[.!?]\s+|\s+(?:va|и|and)\s+(?=\S+\s+(?:tekin|bepul|beriladi))/i)];
  // raqam olib tashlangach qolgan "Tel:" kabi bo'sh yorliqlar ham tushib qoladi
  const parts = raw.map(clean).filter((p) => p.length >= 2 && !LABEL_ONLY.test(p));
  // oxirgi bandning sifati ("tekin") — undan oldingi qisqa bandlarga ham ("obed, yo'lkira tekin")
  const lastWord = (p: string) => p.split(" ").at(-1)!.toLowerCase();
  const out: string[] = [];
  for (let i = 0; i < parts.length; i += 1) {
    let p = parts[i]!;
    const words = p.split(" ");
    if (words.length <= 2 && !QUALIFIERS.includes(lastWord(p))) {
      const next = parts.slice(i + 1).find((q) => QUALIFIERS.includes(lastWord(q)));
      if (next && i >= picked.length) p = `${p} ${lastWord(next)}`;
    }
    out.push(capitalize(p.slice(0, MAX_LEN).trim()));
  }
  const seen = new Set<string>();
  return out.filter((p) => {
    const k = p.toLocaleLowerCase("uz");
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  }).slice(0, MAX_ITEMS);
}

/** E'lon matniga qo'shiladigan qism: har band — alohida qatorda, ✅ bilan */
export function notesBlock(items: readonly string[]): string {
  return items.map((i) => `✅ ${i}`).join("\n");
}

/** Matn + izoh (bo'sh qator bilan); izoh bo'lmasa — matnning o'zi */
export function withNotes(text: string, items: readonly string[]): string {
  const block = notesBlock(items);
  return block ? `${text.trimEnd()}\n\n${block}` : text;
}

/** Matn oxiridagi avvalgi izoh (✅ qatorlari) olib tashlanadi — yangisi uning o'rniga qo'yiladi */
export function stripNotes(text: string): string {
  return text.replace(/(?:\n*✅[^\n]*)+\s*$/u, "").trimEnd();
}
