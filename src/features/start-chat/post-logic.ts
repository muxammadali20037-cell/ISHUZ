import { normalizeText } from "@/features/search/understand";
import { normalizePhone } from "@/lib/format";
import type { QuickOption } from "@/features/find/quick-types";
import type { PostAnswers, PostChoice, PostExperience, PostForm } from "@/features/find/quick-post-types";
import { WORKER_EXTRA_KEYS, pickWorkerExtras, type WorkerExtraKey, type WorkerExtras } from "@/features/post/requirements";

/**
 * Chatning o'zida ishchi e'loni (master prompt, 3-bosqich; ega, 2026-11-21: "kasb, viloyat, ism, tajriba — tajriba bormi
 * degan joyiga yozsin"). Savollar bittadan: kasb (yoziladi; guruh bo'lsa — "aynan qaysi biri?" tugmalari) → viloyat
 * (tugmalar) → ism (yoziladi; hisobda bo'lsa so'ralmaydi) → tajriba (yoziladi yoki tugma) → izoh (ixtiyoriy, tayyor
 * variantlar yoki o'z so'zi bilan — 2026-11-22) → telefon (yoziladi, majburiy —
 * 2026-11-17 va 2026-11-21 qarorlari) → tayyor e'lon kartasi va "Joylash". Sof qismlar — mijoz va unit test uchun.
 */

/** Kasbga xos savollar (ega, 2026-11-24: "ishchiga ham", keyin "hamma kasblardan"): katalog — requirements.ts */
export type PostExtraAsk = `post_${WorkerExtraKey}`;
export type PostAsk = "post_profession" | "post_which" | PostExtraAsk | "post_region" | "post_name" | "post_experience" | "post_note" | "post_phone";

export const POST_ASKS: readonly PostAsk[] = ["post_profession", "post_which", ...WORKER_EXTRA_KEYS.map((k) => `post_${k}` as const), "post_region", "post_name", "post_experience", "post_note", "post_phone"];

/** "post_license" → "license" */
export function postExtraKey(a: PostAsk): WorkerExtraKey | null {
  const k = a.slice(5);
  return (WORKER_EXTRA_KEYS as readonly string[]).includes(k) ? (k as WorkerExtraKey) : null;
}

export function isPostAsk(a: string | null | undefined): a is PostAsk {
  return !!a && (POST_ASKS as readonly string[]).includes(a);
}

/** Yig'ilayotgan e'lon (javoblar bilan to'ladi) */
export interface PostDraft {
  profession: PostChoice | null;
  regionId: string | null;
  districtId: string | null;
  /** viloyat tugmalari (id → nom) */
  regions: QuickOption[];
  firstName: string;
  lastName: string;
  experience: PostExperience | null;
  /** "Izoh" (ega, 2026-11-22) — tartibga keltirilgan bandlar; null — hali so'ralmagan ("Izohsiz" — bo'sh ro'yxat) */
  notes: string[] | null;
  /** "+998901234567" */
  phone: string | null;
  /** kasbga xos javoblar ("C", "yes"…) — birinchi gapdan tushunilgani qayta so'ralmaydi */
  extras: WorkerExtras;
  /** foydalanuvchining birinchi gapi (kasb keyin tanlansa ham undagi "mashinam bor" olinadi) */
  said: string;
}

/** Kasb tanlandi/o'zgardi: shu kasb savollariga gapdan tushunilgan javoblar (boshqa kasbniki tashlanadi) */
export function withProfession(d: PostDraft, profession: PostChoice, text = ""): PostDraft {
  return { ...d, profession, extras: extrasFor(profession, `${d.said} ${text}`) };
}

/** Gapdan va kasb nomining o'zidan ("Piyoda kuryer" → piyoda, "C toifa haydovchi" → C); nomdagisi ustun */
function extrasFor(profession: PostChoice | null, text: string): WorkerExtras {
  const keys = profession?.extraKeys ?? [];
  if (!profession || !keys.length) return {};
  return { ...pickWorkerExtras(text, keys), ...pickWorkerExtras(profession.name, keys) };
}

export function postDraftFromForm(form: PostForm): PostDraft {
  return {
    profession: form.profession,
    regionId: form.regionId,
    districtId: form.districtId,
    regions: form.regions,
    firstName: form.firstName.trim(),
    lastName: form.lastName.trim(),
    experience: null,
    notes: null,
    phone: null,
    extras: extrasFor(form.profession, form.text),
    said: form.text,
  };
}

/** Keyingi savol yoki null — e'lon tayyor (karta ko'rsatiladi) */
export function nextPostAsk(d: PostDraft): Exclude<PostAsk, "post_which"> | null {
  if (!d.profession) return "post_profession";
  // kasbga xos savol — kasbdan keyin darhol (gapda aytilgan bo'lsa — o'tkaziladi)
  for (const k of d.profession.extraKeys ?? []) if (!d.extras[k]) return `post_${k}`;
  if (!d.regionId) return "post_region";
  if (d.firstName.trim().length < 2) return "post_name";
  if (!d.experience) return "post_experience";
  if (d.notes === null) return "post_note";
  if (!d.phone) return "post_phone";
  return null;
}

/** Tayyor e'lon javoblari (server tekshiradi va joylaydi); to'liq bo'lmasa — null */
export function postAnswers(d: PostDraft): PostAnswers | null {
  if (nextPostAsk(d) || !d.profession || !d.regionId || !d.experience || !d.phone) return null;
  return {
    professionId: d.profession.id,
    firstName: d.firstName.trim().slice(0, 60),
    lastName: d.lastName.trim().slice(0, 60),
    regionId: d.regionId,
    districtId: d.districtId,
    experience: d.experience,
    phone: d.phone,
    phone2: null,
    notes: d.notes ?? [],
    ...(Object.keys(d.extras).length ? { extras: d.extras } : {}),
  };
}

/** Telefon: "90 123 45 67", "901234567", "+998 90 …", "8 90 …" → "+998901234567"; noto'g'ri — null */
export function parsePhone(text: string): string | null {
  const digits = text.replace(/[^\d+]/g, "");
  // eski yozuv: "8 90 123 45 67"
  const local = /^8\d{9}$/.test(digits) ? digits.slice(1) : digits;
  return normalizePhone(local);
}

const NUMBER_WORDS: Record<string, number> = {
  bir: 1, ikki: 2, uch: 3, "to'rt": 4, tort: 4, besh: 5, olti: 6, yetti: 7, sakkiz: 8, "to'qqiz": 9, toqqiz: 9, "o'n": 10, on: 10,
  odin: 1, odna: 1, dva: 2, dve: 2, tri: 3, chetyre: 4, pyat: 5, one: 1, two: 2, three: 3, four: 4, five: 5,
};

/**
 * Tajriba yozilganidan: "yo'q" → none; "6 oy" → lt1; "2 yil" → 1_3; "5 yildan ko'p" → 3plus. Rus va ingliz tilida ham
 * ("2 года", "нет опыта", "3 years"). Tushunilmasa — null (qayta so'raladi, tugmalar bilan).
 */
export function parseExperience(text: string): PostExperience | null {
  let s = normalizeText(text);
  if (!s) return null;
  if (/(^|\s)(yo'?q|yoq|tajribasiz|tajribam yo'?q|net|net opyta|bez opyta|no|none|no experience)(\s|$)/.test(s)) return "none";
  // so'z bilan yozilgan son ("ikki yil") — raqamga
  s = s.replace(/(^|\s)([a-z']+)(?=\s+(yil|oy|god|let|mesyat|year|month))/g, (m, sp: string, w: string) => (w in NUMBER_WORDS ? `${sp}${NUMBER_WORDS[w]}` : m));
  const m = s.match(/(\d+(?:\.\d+)?)\s*(yil|oy|god|let|mesyat|year|month)?/);
  if (m) {
    const n = Number(m[1]);
    const unit = m[2] ?? "yil";
    const years = unit === "oy" || unit === "mesyat" || unit === "month" ? n / 12 : n;
    if (!Number.isFinite(years)) return null;
    if (years < 1) return "lt1";
    if (years < 3) return "1_3";
    return "3plus";
  }
  if (/(^|\s)(yarim yil|ozgina|biroz|kam|nemnogo|a little)(\s|$)/.test(s)) return "lt1";
  return null;
}

/** "Mening ismim Botir Karimov" → { first: "Botir", last: "Karimov" }; harfdan boshqa narsa bo'lsa — null */
export function parseName(text: string): { first: string; last: string } | null {
  let s = text.replace(/\s+/g, " ").trim().replace(/[.,!?]+$/g, "");
  s = s.replace(/^(salom|assalomu alaykum)[,!]?\s+/i, "");
  s = s.replace(/^(mening\s+)?ismim\s+/i, "").replace(/^(menya zovut|меня зовут|my name is)\s+/i, "").replace(/^men\s+/i, "");
  const words = s.split(" ").filter(Boolean);
  if (!words.length || words.length > 3) return null;
  const ok = (w: string) => /^[\p{L}'’ʻʼ-]{2,40}$/u.test(w);
  if (!words.every(ok)) return null;
  const cap = (w: string) => w.charAt(0).toLocaleUpperCase("uz") + w.slice(1);
  return { first: cap(words[0]!), last: words.slice(1).map(cap).join(" ") };
}

/** Yozilgan viloyat nomi tugmalardan biriga mos kelsa ("toshkent shahri", "samarqand") — o'sha; aks holda null */
export function matchRegion(text: string, regions: QuickOption[]): QuickOption | null {
  const s = normalizeText(text);
  if (s.length < 3) return null;
  const hits = regions.filter((r) => normalizeText(r.label).startsWith(s) || s.startsWith(normalizeText(r.label)));
  return hits.length === 1 ? hits[0]! : null;
}
