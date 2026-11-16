import { formatSalaryWithPeriod } from "@/lib/format";

/**
 * Kanalga avtomatik e'lon matni (sof funksiyalar): vakansiya — "ISH", ishchi e'loni — "ISHCHI" (ega, 2026-11-14:
 * "ish beruvchilar kanaliga — ishchi, ishchilarga — ish"). Faqat saytda hammaga ochiq ma'lumot: telefon, ism, foydalanuvchi
 * rasmi, erkin matn (tavsif, "o'zim haqimda") YO'Q. Vakansiya (ega, 2026-11-16): oddiy rasm — faqat ish nomi, maosh, joylashuv,
 * kompaniya (/api/promo/vacancy/…?f=post), izohda faqat vakansiya nomi, "Ariza qoldirish" tugmasi; sayt nomi va odam
 * chizmasi yo'q. Rasm ketmasa — to'liq matn (html). Sarlavhadagi telefon raqami, @nik, havola va email ham olib tashlanadi —
 * bog'lanish faqat sayt orqali (kontakt maxfiyligi, 0074).
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
}

export interface ChannelPost {
  /** to'liq matn — rasmsiz xabar (yoki rasm ketmasa) */
  html: string;
  button: { text: string; url: string };
  /** rasm manzili (Telegram o'zi yuklab oladi) va uning qisqa izohi */
  photo?: string;
  caption?: string;
}

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

export function vacancyPost(d: VacancyPostData, t: T, base: string): ChannelPost {
  const salary = formatSalaryWithPeriod(
    { from: d.salaryFrom, to: d.salaryTo, type: d.salaryType, negotiable: d.negotiable },
    "uz",
    salaryLabels(t),
    (type) => t(`enums.salary_type_suffix.${type}`),
  );
  const tags = [hashtag(d.profession ?? d.title), hashtag(d.place?.split(",")[0])].filter(Boolean).join(" ");
  const title = sanitizeLine(d.title) || d.profession || "";
  const lines = [
    `${escapeHtml(t("bot.channel.job_tag"))}${tags ? ` · ${escapeHtml(tags)}` : ""}`,
    "",
    `<b>${escapeHtml(title)}</b>`,
    d.company ? `🏢 ${escapeHtml(sanitizeLine(d.company, 80))}` : null,
    d.remote ? `🌐 ${escapeHtml(t("bot.channel.remote"))}` : d.place ? `📍 ${escapeHtml(d.place)}` : null,
    `💰 ${escapeHtml(salary)}`,
    d.schedule ? `🕘 ${escapeHtml(d.schedule)}` : null,
  ];
  return {
    html: lines.filter((l) => l !== null).join("\n"),
    button: { text: t("bot.channel.apply"), url: `${base}/jobs/${encodeURIComponent(d.slug)}` },
    photo: `${base}/api/promo/vacancy/${encodeURIComponent(d.slug)}?f=post`,
    caption: `<b>${escapeHtml(title)}</b>`,
  };
}

export function workerPost(d: WorkerPostData, t: T, base: string): ChannelPost {
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
  ];
  return {
    html: lines.filter((l) => l !== null).join("\n"),
    button: { text: t("bot.channel.open_worker"), url: `${base}/workers/${d.id}` },
  };
}
