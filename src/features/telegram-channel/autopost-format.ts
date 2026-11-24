import { formatSalaryWithPeriod } from "@/lib/format";

/**
 * Kanalga avtomatik e'lon matni (sof funksiyalar): vakansiya va ishchi e'loni (ega, 2026-11-14: "ish beruvchilar kanaliga —
 * ishchi, ishchilarga — ish"). Matn boshida — oddiy yozuv, heshteglarsiz (ega, 2026-11-22): "💼 Ish beruvchi ishchi
 * qidiryapti" / "👤 Ishchi ish qidiryapti". Rasm (/api/promo/…) — ish nomi, maosh,
 * joylashuv, kompaniya; vakansiya ko'k, ishchi yashil, tepasida turi yozilgan (ega, 2026-11-18: "ishchimi u ish beruvchimi
 * bilib bo'lmadi").
 *
 * Rasm ostida — TO'LIQ matn (ega, 2026-11-18: "rasm tagiga to'liq yozilsin, nomerlar bilan to'liq vakansiya"):
 *  · vakansiya: turi, nomi, kompaniya, joy, maosh, ish vaqti, tajriba, tavsif va telefon.
 *  · ishchi: turi, kasbi, sarlavha, joy, tajriba, maosh, ish vaqti. Ism, shaxsiy rasm va telefon YO'Q (ega, 2026-11-22:
 *    raqam saytda ochiladi) — "📞 Bog'lanish" tugmasi e'londagi raqam ochish bo'limiga olib boradi.
 * Vakansiya telefoni — faqat egasi kanal uchun rozi bo'lgani (qaysi raqam — chaqiruvchi, autopost.ts, tanlaydi). Ega (2026-11-20:
 * "kanalda nomer ustiga bossa telefon qilishga o'tsin — raqamlarni qo'shib yozish kerak"): raqam bo'shliqsiz, xalqaro
 * ko'rinishda (+998901234567) — Telegram uni bosiladigan raqamga aylantiradi, bosilsa qo'ng'iroq.
 * Erkin matndagi (sarlavha, tavsif) telefon, @nik, havola va email olib tashlanadi — raqam faqat rozilik maydonidan.
 */
export type T = (key: string, params?: Record<string, string | number>) => string;

/** Telegram HTML uchun (lib/telegram/bot.ts dagi bilan bir xil; u server-only — bu modul sof qolsin) */
function escapeHtml(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);
}

export interface VacancyPostData {
  slug: string;
  title: string;
  company: string | null;
  place: string | null;
  remote: boolean;
  salaryFrom: number | null;
  salaryTo: number | null;
  salaryType: string | null;
  negotiable: boolean;
  schedule: string | null;
  profession: string | null;
  /** tavsif (erkin matn — tozalanadi va qisqartiriladi) */
  description?: string | null;
  /** talab qilinadigan tajriba, oy (0 — tajribasiz) */
  experienceMonths?: number | null;
  /** E.164; faqat kanalga rozilik bo'lsa beriladi (chaqiruvchi tekshiradi) */
  phone?: string | null;
  /** ish vaqti "09:00–18:00" (ega, 2026-11-24) */
  workTime?: string | null;
  /** talab: jinsi ("Ayol") va yosh chegarasi ("18–35 yosh") — tayyor matn */
  gender?: string | null;
  age?: string | null;
}

export interface WorkerPostData {
  id: string;
  profession: string;
  headline: string | null;
  place: string | null;
  experience: string | null;
  salary: number | null;
  salaryType: string | null;
  schedules: string[];
  /** e'londagi ✅ bandlar: jinsi va yoshi ("Erkak, 28 yosh"), kasbga xos javoblar, izoh (ega, 2026-11-24) */
  notes?: string[];
}

/** Usta e'loni (ega, 2026-11-24: "ustalar e'loni ham kanalga — ishchi e'lonlari kanaliga") */
export interface MasterPostData {
  slug: string;
  /** xizmat kategoriyasi ("Santexnik") */
  category: string;
  /** "other" — "Boshqa xizmatlar": sarlavhada ustaning o'z yozgani ("Tokar") */
  categorySlug?: string | null;
  title: string;
  services: string[];
  place: string | null;
  experienceYears: number | null;
  priceFrom: number | null;
  priceTo: number | null;
  negotiable: boolean;
  description?: string | null;
  /** e'lon rasmi (AI) yoki birinchi ish namunasi — to'liq manzil; yo'q — rasmsiz xabar */
  photo?: string | null;
}

export interface ChannelPost {
  /** to'liq matn — rasmsiz xabar (yoki rasm ketmasa) */
  html: string;
  button: { text: string; url: string };
  /** rasm manzili (Telegram o'zi yuklab oladi) va rasm ostidagi matn (to'liq — html bilan bir xil, ≤ 1024) */
  photo?: string;
  caption?: string;
}

/** Telegram rasm izohi chegarasi 1024 belgi; teglar va &amp; ham hisoblanadi (zaxira bilan) */
const CAPTION_MAX = 1000;

/** Telefon, @nik, havola, email — olib tashlanadi; bo'sh joylar yig'iladi; uzunlik cheklanadi */
export function sanitizeLine(s: string | null | undefined, max = 120): string {
  if (!s) return "";
  const out = s
    .replace(/https?:\/\/\S+|www\.\S+|\b(?:t|telegram)\.me\/\S+/gi, " ")
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, " ")
    .replace(/@[A-Za-z0-9_]{3,}/g, " ")
    // 7 va undan ko'p raqam (bo'shliq, chiziqcha, qavs, + bilan ajratilgan bo'lsa ham)
    .replace(/\+?\d[\d\s().-]{5,}\d/g, (m) => (m.replace(/\D/g, "").length >= 7 ? " " : m))
    // olib tashlangandan keyin bo'sh qolgan qavslar va ortiqcha tinish belgilari
    .replace(/\(\s*\)|\[\s*\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return out.length > max ? `${out.slice(0, max - 1).trimEnd()}…` : out;
}

/** Ko'p qatorli erkin matn: har qator sanitizeLine, bo'sh qatorlar tashlanadi, ko'pi bilan `maxLines` qator va `max` belgi */
export function sanitizeText(s: string | null | undefined, max: number, maxLines = 8): string {
  if (!s || max <= 1) return "";
  const lines = s
    .split(/\r?\n/)
    .map((l) => sanitizeLine(l, 400))
    .filter(Boolean)
    .slice(0, maxLines);
  const out = lines.join("\n");
  return out.length > max ? `${out.slice(0, max - 1).trimEnd()}…` : out;
}

function salaryLabels(t: T) {
  return { negotiable: t("bot.channel.negotiable"), from: t("common.labels.salary_from"), to: t("common.labels.salary_to") };
}

/** tugma havolasi: sayt yo'li → manzil (standart — sayt; asosiy Mini App yoqilgan bo'lsa — t.me/<bot>?startapp=…) */
export type LinkFn = (path: string) => string;

/** "+998 90 123-45-67" → "+998901234567": bo'shliqsiz xalqaro raqam — Telegram uni bosiladigan (qo'ng'iroq) qiladi */
export function dialable(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  return /^998\d{9}$/.test(digits) ? `+${digits}` : null;
}

/** postning oxiri: bo'sh qator va "📞 Tel: +998…, +998…" (raqam yo'q yoki noto'g'ri — hech narsa) */
function phoneTail(phones: string[], t: T): string[] {
  const list = [...new Set(phones.map(dialable).filter((p): p is string => !!p))];
  return list.length ? ["", `📞 ${escapeHtml(t("bot.channel.phone", { value: list.join(", ") }))}`] : [];
}

export function vacancyPost(d: VacancyPostData, t: T, base: string, link: LinkFn = (p) => `${base}${p}`): ChannelPost {
  const salary = formatSalaryWithPeriod(
    { from: d.salaryFrom, to: d.salaryTo, type: d.salaryType, negotiable: d.negotiable },
    "uz",
    salaryLabels(t),
    (type) => t(`enums.salary_type_suffix.${type}`),
  );
  const title = sanitizeLine(d.title) || d.profession || "";
  const months = d.experienceMonths;
  const step = months == null ? null : [60, 36, 24, 12, 6].find((m) => months >= m) ?? (months > 0 ? 6 : 0);
  // ega (2026-11-22): boshida heshteglarsiz oddiy yozuv — "Ish beruvchi ishchi qidiryapti"
  const head = [
    escapeHtml(t("bot.channel.job_tag")),
    "",
    `<b>${escapeHtml(title)}</b>`,
    d.company ? `🏢 ${escapeHtml(sanitizeLine(d.company, 80))}` : null,
    d.remote ? `🌐 ${escapeHtml(t("bot.channel.remote"))}` : d.place ? `📍 ${escapeHtml(d.place)}` : null,
    `💰 ${escapeHtml(salary)}`,
    d.schedule || d.workTime ? `🕘 ${escapeHtml([d.schedule, d.workTime].filter(Boolean).join(" · "))}` : null,
    // jinsi va yoshi — har doim (ega, 2026-11-24: "kanalga jinsi, yoshi kelmayapti"); talab yo'q bo'lsa — "farqi yo'q"
    `👤 ${escapeHtml(t("bot.channel.gender_age", { gender: d.gender ?? t("bot.channel.any"), age: d.age ?? t("bot.channel.any") }))}`,
    step == null ? null : `🧰 ${escapeHtml(step === 0 ? t("bot.channel.no_experience") : t("bot.channel.experience", { value: t(`enums.experience_min_months.${step}`) }))}`,
  ].filter((l) => l !== null);
  const tail = phoneTail(d.phone ? [d.phone] : [], t);
  // tavsif — qolgan joyga sig'guncha (escape kengaytirishi uchun zaxira: belgi soni ~1.2×)
  const used = [...head, ...tail].join("\n").length + 2;
  const room = Math.floor((CAPTION_MAX - used) / 1.2);
  // ✅ bandlar (kasbga xos javoblar, izoh) ham sig'sin — qatorlar soni 14 tagacha
  const desc = room >= 40 ? sanitizeText(d.description, Math.min(room, 600), 14) : "";
  const html = [...head, ...(desc ? ["", escapeHtml(desc)] : []), ...tail].join("\n");
  return {
    html,
    button: { text: t("bot.channel.apply"), url: link(`/jobs/${encodeURIComponent(d.slug)}`) },
    photo: `${base}/api/promo/vacancy/${encodeURIComponent(d.slug)}?f=post`,
    caption: html.length <= CAPTION_MAX ? html : `<b>${escapeHtml(title)}</b>`,
  };
}

export function workerPost(d: WorkerPostData, t: T, base: string, link: LinkFn = (p) => `${base}${p}`): ChannelPost {
  const salary = d.salary
    ? formatSalaryWithPeriod({ from: d.salary, to: null, type: d.salaryType, negotiable: false }, "uz", salaryLabels(t), (type) => t(`enums.salary_type_suffix.${type}`))
    : t("bot.channel.negotiable");
  const headline = sanitizeLine(d.headline, 100);
  // ega (2026-11-22): boshida heshteglarsiz oddiy yozuv — "Ishchi ish qidiryapti"
  const lines = [
    escapeHtml(t("bot.channel.worker_tag")),
    "",
    `<b>${escapeHtml(sanitizeLine(d.profession, 80))}</b>`,
    headline && headline.toLowerCase() !== d.profession.toLowerCase() ? `<i>${escapeHtml(headline)}</i>` : null,
    d.place ? `📍 ${escapeHtml(d.place)}` : null,
    d.experience ? `🧰 ${escapeHtml(t("bot.channel.experience", { value: d.experience }))}` : null,
    `💰 ${escapeHtml(t("bot.channel.salary_expect", { value: salary }))}`,
    d.schedules.length ? `🕘 ${escapeHtml(d.schedules.join(", "))}` : null,
    ...(d.notes?.length ? ["", ...d.notes.map((n) => `✅ ${escapeHtml(n)}`)] : []),
    "",
    `📞 ${escapeHtml(t("bot.channel.contact_on_site"))}`,
  ];
  const html = lines.filter((l) => l !== null).join("\n");
  // Mini App havolasida (t.me/…?startapp=) # bo'lmaydi — e'lon sahifasi; oddiy havolada — to'g'ri raqam ochish bo'limiga
  const url = link(`/listing/${d.id}`);
  return {
    html,
    button: { text: t("bot.channel.contact"), url: url.startsWith(base) ? `${url}#contact` : url },
    // rasm — vakansiyadagidek (ega, 2026-11-17: "e'lon joylandimi — shunaqa rasm bo'lib kelsin"): kasbi, tajriba, joyi, maosh
    photo: `${base}/api/promo/worker/${d.id}`,
    caption: html.length <= CAPTION_MAX ? html : `<b>${escapeHtml(sanitizeLine(d.profession, 80))}</b>`,
  };
}

/**
 * Usta e'loni: turi ("🛠 Usta xizmat taklif qiladi"), kategoriya, sarlavha, xizmatlar, joy, tajriba, narx, tavsif. Ism va
 * telefon YO'Q — ishchi e'lonidagidek (ega, 2026-11-22: raqam saytda ochiladi): "📞 Bog'lanish" — saytdagi e'longa.
 * Rasm — e'lon rasmi (AI) yoki ustaning birinchi ish namunasi; ikkalasi ham yo'q — rasmsiz xabar.
 */
export function masterPost(d: MasterPostData, t: T, base: string, link: LinkFn = (p) => `${base}${p}`): ChannelPost {
  const other = d.categorySlug === "other";
  const title = sanitizeLine(d.title, 100);
  // "Boshqa xizmatlar" — umumiy nom; sarlavha — ustaning o'z yozgani ("Tokar")
  const category = other && title ? title : sanitizeLine(d.category, 80);
  const services = sanitizeLine(d.services.map((x) => x.trim()).filter(Boolean).join(", "), 200);
  const price =
    d.priceFrom || d.priceTo
      ? formatSalaryWithPeriod({ from: d.priceFrom, to: d.priceTo, type: null, negotiable: false }, "uz", salaryLabels(t), () => "")
      : d.negotiable
        ? t("bot.channel.negotiable")
        : null;
  const head = [
    escapeHtml(t("bot.channel.master_tag")),
    "",
    `<b>${escapeHtml(category)}</b>`,
    title && title.toLowerCase() !== category.toLowerCase() ? `<i>${escapeHtml(title)}</i>` : null,
    services && services.toLowerCase() !== category.toLowerCase() ? `🔧 ${escapeHtml(services)}` : null,
    d.place ? `📍 ${escapeHtml(d.place)}` : null,
    d.experienceYears && d.experienceYears > 0 ? `🧰 ${escapeHtml(t("bot.channel.master_experience", { value: d.experienceYears }))}` : null,
    price ? `💰 ${escapeHtml(t("bot.channel.master_price", { value: price }))}` : null,
  ].filter((l) => l !== null);
  const tail = ["", `📞 ${escapeHtml(t("bot.channel.contact_on_site"))}`];
  const used = [...head, ...tail].join("\n").length + 2;
  const room = Math.floor((CAPTION_MAX - used) / 1.2);
  // avtomatik tavsif ("Santexnik: Kran almashtirish. Hudud: …" — usta o'zi yozmagan) — takror, tashlanadi
  const auto = !!d.description && [d.category, category].some((c) => d.description!.trim().toLowerCase().startsWith(`${c.toLowerCase()}:`));
  const desc = room >= 40 && !auto ? sanitizeText(d.description, Math.min(room, 500), 6) : "";
  const html = [...head, ...(desc ? ["", escapeHtml(desc)] : []), ...tail].join("\n");
  const url = link(`/ustalar/${encodeURIComponent(d.slug)}`);
  return {
    html,
    button: { text: t("bot.channel.contact"), url: url.startsWith(base) ? `${url}#contact` : url },
    ...(d.photo ? { photo: d.photo, caption: html.length <= CAPTION_MAX ? html : `<b>${escapeHtml(category)}</b>` } : {}),
  };
}
