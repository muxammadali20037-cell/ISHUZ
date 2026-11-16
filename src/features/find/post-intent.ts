import { smallTalk } from "@/features/assistant/replies";

/**
 * Yozilgan gap ish haqidami yoki boshqa mavzudami (ega, 2026-11-17: "boshqa mavzularda savol-javob bo'lsa oyna chiqmasin,
 * «ish kerak» deb yozsa — chiqsin"). Sof funksiyalar: qidiruv va e'lon joylash uchun umumiy.
 */

export type OffTopic = "greeting" | "thanks" | "who" | "other";

const APOS = /[ʻʼ‘’`´]/g;
const norm = (s: string) => s.toLowerCase().replace(APOS, "'").replace(/\s+/g, " ").trim();
const words = (s: string) => norm(s).split(/[^\p{L}\p{N}']+/u).filter(Boolean);

/** "ish", "ishga", "ishlayman", "ishchi", "vakansiya", "e'lon", "работа", "job" … (lekin "ishonch", "ishtaha" emas) */
const JOB_WORD =
  /^(ish(|i|im|ingiz|ga|da|dan|ni|lar|larni|lari|chi|chilar|chiman|siz|siz\p{L}*|la\p{L}*|kerak)|иш(|и|им|га|да|дан|ни|лар|ларни|чи|чилар|сиз|ла\p{L}*)|vakans\p{L}*|ваканс\p{L}*|e'?lon\p{L}*|elon\p{L}*|эълон\p{L}*|объявлен\p{L}*|работ\p{L}*|подработк\p{L}*|job|jobs|work|hiring|usta|ustalar|уста|xodim\p{L}*|ходим\p{L}*|сотрудник\p{L}*|kadr\p{L}*|кадр\p{L}*)$/u;

export function hasJobIntent(text: string): boolean {
  return words(text).some((w) => JOB_WORD.test(w));
}

/** Savol ko'rinishidagi gap ("qachon", "nega", "как", "what" bilan boshlanadi yoki "?" bilan tugaydi) */
const QUESTION = /(\?\s*$)|^(nima|nimaga|nega|qachon|qanday|qayer\p{L}*|qaysi|kim|necha|qancha|нима|нега|қачон|қандай|қаер\p{L}*|ким|что|как|почему|зачем|когда|где|кто|сколько|what|how|why|when|where|who)(\s|$)/u;

/**
 * Boshqa mavzu: salomlashish, rahmat, "kimsan", maslahat so'rash yoki ish bilan bog'liq bo'lmagan savol.
 * `understood` — matndan kasb, hudud yoki maosh tushunilgan (unda bu qidiruv/e'lon, savol bo'lsa ham).
 * "Menga ish toping" (forme) — ish so'rovi, boshqa mavzu emas.
 */
export function offTopic(text: string, understood: boolean): OffTopic | null {
  const s = text.trim();
  if (!s) return null;
  const talk = smallTalk(s);
  if (talk === "greeting" || talk === "howdy") return "greeting";
  if (talk === "thanks") return "thanks";
  if (talk === "who") return "who";
  if (understood || hasJobIntent(s) || talk === "forme") return null;
  if (talk === "advice") return "other";
  return QUESTION.test(norm(s)) ? "other" : null;
}

/**
 * Kasb nomi yozilgan gapda haqiqatan bormi: ikki so'zgacha nomda — hamma so'zi, uzunroq nomda — kamida uchdan ikkisi
 * (qo'shimcha bilan — "o'qituvchisiman"; imlo xatosi bilan — "oqtvchi": undosh skeleti). "bugun havo zo'r" → "Havo
 * liniyasi elektromontyori" — yo'q. `normalize` — lotin/kirill birxillashtirish (search/understand).
 */
export function professionMentioned(text: string, names: string[], normalize: (s: string) => string): boolean {
  const said = normalize(text).split(" ").filter((w) => w.length >= 2);
  const skel = (s: string) => s.replace(/'/g, "").replace(/[aeiouy]/g, "");
  const prefix = (a: string, b: string) => {
    let i = 0;
    while (i < a.length && i < b.length && a[i] === b[i]) i++;
    return i;
  };
  const covered = (nw: string) =>
    said.some(
      (w) =>
        w.startsWith(nw) ||
        (w.length >= 4 && nw.startsWith(w)) ||
        // "haydovchiman" ~ "haydovchisi", "o'qituvchiman" ~ "o'qituvchisi" (egalik va kesim qo'shimchalari)
        prefix(w, nw) >= Math.max(5, Math.ceil(nw.length * 0.75)) ||
        (skel(nw).length >= 4 && skel(w).startsWith(skel(nw))),
    );
  return names.some((name) => {
    const parts = normalize(name)
      .split(" ")
      .filter((w) => w.length >= 3);
    if (!parts.length) return false;
    const need = parts.length <= 2 ? parts.length : Math.ceil((parts.length * 2) / 3);
    return parts.filter(covered).length >= need;
  });
}
