/**
 * "Sizga mos yangi ish topildi!" / "Vakansiyangizga mos nomzod topildi!" — Telegram xabari (sof modul, testlanadi).
 * Barcha qiymatlar bazadan (yuborish paytida qayta o'qiladi); telefon va boshqa shaxsiy ma'lumot qo'shilmaydi.
 */
import type { TFunction } from "@/lib/i18n/translate";

export interface MatchReasonLite {
  key: string;
  ok: boolean | string;
}

export interface VacancyMatchItem {
  title: string;
  employer: string;
  place: string;
  salary: string;
  score: number;
  reasons: MatchReasonLite[];
}

export interface WorkerMatchItem {
  name: string;
  profession: string;
  place: string;
  experience: string;
  score: number;
  reasons: MatchReasonLite[];
}

const GROUPS: [string, RegExp][] = [
  ["profession", /^(profession_(exact|specialist|general|related)|category_match)/],
  ["location", /^(district_match|distance_near|distance_ok|region_match|remote_ok)$/],
  ["salary", /^(salary_ok|salary_min_ok)$/],
  ["experience", /^experience_ok$/],
  ["skills", /^skills_matched$/],
  ["schedule", /^schedule_ok$/],
  ["language", /^languages_ok$/],
];

/** "kasb, hudud va tajriba" — faqat haqiqatan mos (ok=true) mezonlar */
export function reasonList(t: TFunction, reasons: MatchReasonLite[]): string {
  const keys: string[] = [];
  for (const [group, re] of GROUPS) {
    if (reasons.some((r) => r.ok === true && re.test(r.key))) keys.push(t(`notifications.match.reasons.${group}`));
  }
  if (keys.length === 0) return "";
  if (keys.length === 1) return keys[0]!;
  return `${keys.slice(0, -1).join(", ")} ${t("notifications.match.and")} ${keys[keys.length - 1]}`;
}

function esc(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);
}

function line(label: string) {
  return label ? `\n${label}` : "";
}

export function workerMatchHtml(t: TFunction, items: VacancyMatchItem[], total: number): string {
  const head = total > 1 ? t("notifications.match.worker_title_many", { count: total }) : t("notifications.match.worker_title");
  const blocks = items.slice(0, 3).map((v) => {
    const reasons = reasonList(t, v.reasons);
    return (
      `<b>${esc(v.title)}</b>${v.employer ? ` — ${esc(v.employer)}` : ""}` +
      line(esc(v.place)) +
      line(v.salary ? esc(t("notifications.match.salary", { salary: v.salary })) : "") +
      line(esc(t("notifications.match.score", { score: v.score }))) +
      line(reasons ? esc(t("notifications.match.reason", { list: reasons })) : "")
    );
  });
  const more = total > 3 ? `\n\n${esc(t("notifications.match.more", { count: total - 3 }))}` : "";
  return `🎯 <b>${esc(head)}</b>\n\n${blocks.join("\n\n")}${more}`;
}

export function employerMatchHtml(t: TFunction, vacancyTitle: string, items: WorkerMatchItem[], total: number): string {
  const head = total > 1 ? t("notifications.match.employer_title_many", { count: total }) : t("notifications.match.employer_title");
  const blocks = items.slice(0, 3).map((w) => {
    const reasons = reasonList(t, w.reasons);
    return (
      `<b>${esc(w.profession || vacancyTitle)}</b>${w.name ? ` — ${esc(w.name)}` : ""}` +
      line(esc(w.place)) +
      line(w.experience ? esc(t("notifications.match.experience", { experience: w.experience })) : "") +
      line(esc(t("notifications.match.score", { score: w.score }))) +
      line(reasons ? esc(t("notifications.match.reason", { list: reasons })) : "")
    );
  });
  const more = total > 3 ? `\n\n${esc(t("notifications.match.more", { count: total - 3 }))}` : "";
  const forVacancy = vacancyTitle ? `\n${esc(t("notifications.match.for_vacancy", { title: vacancyTitle }))}` : "";
  return `🎯 <b>${esc(head)}</b>${forVacancy}\n\n${blocks.join("\n\n")}${more}`;
}
