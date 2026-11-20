import { formatSalaryWithPeriod } from "@/lib/format";

/**
 * Kanalga avtomatik e'lon matni (sof funksiyalar): vakansiya — "VAKANSIYA · ishchi kerak", ishchi e'loni — "ISHCHI · ish
 * qidiryapti" (ega, 2026-11-14: "ish beruvchilar kanaliga — ishchi, ishchilarga — ish"). Rasm (/api/promo/…) — ish nomi, maosh,
 * joylashuv, kompaniya; vakansiya ko'k, ishchi yashil, tepasida turi yozilgan (ega, 2026-11-18: "ishchimi u ish beruvchimi
 * bilib bo'lmadi").
 *
 * Rasm ostida — TO'LIQ matn (ega, 2026-11-18: "rasm tagiga to'liq yozilsin, nomerlar bilan to'liq vakansiya"):
 *  · vakansiya: turi, nomi, kompaniya, joy, maosh, ish vaqti, tajriba, tavsif va telefon.
 *  · ishchi: turi, kasbi, sarlavha, joy, tajriba, maosh, ish vaqti va telefon(lar). Ism va shaxsiy rasm YO'Q.
 * Telefon — faqat egasi kanal uchun rozi bo'lgani (qaysi raqam — chaqiruvchi, autopost.ts, tanlaydi). Ega (2026-11-20:
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
  /** E.164 raqam(lar); faqat kanalga rozilik bo'lsa beriladi (chaqiruvchi tekshiradi) */
  phones?: string[];
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

/** "Sotuvchi-kassir" → "#sotuvchi_kassir"; harfsiz — null. Telegram heshtegi: harf, raqam, _ */
export function hashtag(s: string | null | undefined): string | null {
  if (!s) return null;
  const tag = s
    .toLowerCase()
    .replace(/[ʻʼ'’`‘]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 30)
    .replace(/_+$/, "");
  return tag && /\p{L}/u.test(tag) ? `#${tag}` : null;
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
  const tags = [hashtag(d.profession ?? d.title), hashtag(d.place?.split(",")[0])].filter(Boolean).join(" ");
  const title = sanitizeLine(d.title) || d.profession || "";
  const months = d.experienceMonths;
  const step = months == null ? null : [60, 36, 24, 12, 6].find((m) => months >= m) ?? (months > 0 ? 6 : 0);
  const head = [
    `${escapeHtml(t("bot.channel.job_tag"))}${tags ? ` · ${escapeHtml(tags)}` : ""}`,
    "",
    `<b>${escapeHtml(title)}</b>`,
    d.company ? `🏢 ${escapeHtml(sanitizeLine(d.company, 80))}` : null,
    d.remote ? `🌐 ${escapeHtml(t("bot.channel.remote"))}` : d.place ? `📍 ${escapeHtml(d.place)}` : null,
    `💰 ${escapeHtml(salary)}`,
    d.schedule ? `🕘 ${escapeHtml(d.schedule)}` : null,
    step == null ? null : `🧰 ${escapeHtml(step === 0 ? t("bot.channel.no_experience") : t("bot.channel.experience", { value: t(`enums.experience_min_months.${step}`) }))}`,
  ].filter((l) => l !== null);
  const tail = phoneTail(d.phone ? [d.phone] : [], t);
  // tavsif — qolgan joyga sig'guncha (escape kengaytirishi uchun zaxira: belgi soni ~1.2×)
  const used = [...head, ...tail].join("\n").length + 2;
  const room = Math.floor((CAPTION_MAX - used) / 1.2);
  const desc = room >= 40 ? sanitizeText(d.description, Math.min(room, 600)) : "";
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
  const tags = [hashtag(d.profession), hashtag(d.place?.split(",")[0])].filter(Boolean).join(" ");
  const headline = sanitizeLine(d.headline, 100);
  const lines = [
    `${escapeHtml(t("bot.channel.worker_tag"))}${tags ? ` · ${escapeHtml(tags)}` : ""}`,
    "",
    `<b>${escapeHtml(sanitizeLine(d.profession, 80))}</b>`,
    headline && headline.toLowerCase() !== d.profession.toLowerCase() ? `<i>${escapeHtml(headline)}</i>` : null,
    d.place ? `📍 ${escapeHtml(d.place)}` : null,
    d.experience ? `🧰 ${escapeHtml(t("bot.channel.experience", { value: d.experience }))}` : null,
    `💰 ${escapeHtml(t("bot.channel.salary_expect", { value: salary }))}`,
    d.schedules.length ? `🕘 ${escapeHtml(d.schedules.join(", "))}` : null,
    ...phoneTail(d.phones ?? [], t),
  ];
  const html = lines.filter((l) => l !== null).join("\n");
  return {
    html,
    button: { text: t("bot.channel.open_worker"), url: link(`/workers/${d.id}`) },
    // rasm — vakansiyadagidek (ega, 2026-11-17: "e'lon joylandimi — shunaqa rasm bo'lib kelsin"): kasbi, tajriba, joyi, maosh
    photo: `${base}/api/promo/worker/${d.id}`,
    caption: html.length <= CAPTION_MAX ? html : `<b>${escapeHtml(sanitizeLine(d.profession, 80))}</b>`,
  };
}
