import "server-only";

import { getServerEnv } from "@/lib/env";
import { formatSalaryRange, formatWorkTime } from "@/lib/format";
import type { getT } from "@/lib/i18n/server";
import type { VacancyDetail } from "@/features/jobs/types";
import { promoTheme, type PromoData } from "./card";

type T = Awaited<ReturnType<typeof getT>>;

export function vacancyUrl(slug: string): string {
  return `${getServerEnv().APP_URL.replace(/\/$/, "")}/jobs/${slug}`;
}

/** Vakansiya → reklama kartasi ma'lumotlari (til bo'yicha) */
export function buildPromoData(v: VacancyDetail, { t, tEnum, name, locale }: T): PromoData {
  const salary =
    v.salary_negotiable || (!v.salary_from && !v.salary_to)
      ? t("common.labels.negotiable")
      : `${formatSalaryRange(v.salary_from, v.salary_to, locale, { negotiable: t("common.labels.negotiable"), from: t("common.labels.from"), to: t("common.labels.to") })}${tEnum("salary_type_suffix", v.salary_type)}`;
  const place = v.is_remote ? tEnum("employment_type", "remote") : [name(v.district), name(v.region)].filter(Boolean).join(", ") || null;
  const time = v.work_time_from && v.work_time_to ? `${formatWorkTime(v.work_time_from)}–${formatWorkTime(v.work_time_to)}` : null;
  const schedule = [v.schedule ? tEnum("work_schedule", v.schedule) : null, time].filter(Boolean).join(" · ") || null;
  const tags = [
    v.employment_type ? tEnum("employment_type", v.employment_type) : null,
    v.work_format === "official" ? tEnum("work_format", "official") : null,
    ...v.benefits.map((b) => name(b)),
  ].filter((x): x is string => !!x);

  return {
    title: v.title,
    company: v.company?.name ?? null,
    categorySlug: v.category?.slug ?? null,
    categoryName: v.category ? name(v.category) : null,
    salary,
    place,
    schedule,
    tags,
    isGovernment: v.is_government,
    url: new URL(getServerEnv().APP_URL).host,
    labels: { hiring: t("promo.hiring"), apply: t("promo.apply"), government: t("jobs.government.badge") },
  };
}

/** Telegram/Instagram uchun tayyor e'lon matni (emoji + heshteglar) */
export function buildPromoCaption(v: VacancyDetail, data: PromoData, t: T["t"]): string {
  const theme = promoTheme(data.categorySlug);
  const lines = [
    `🔥 ${t("promo.hiring")}: ${data.title} ${theme.emoji}`,
    data.company ? `🏢 ${data.company}${data.isGovernment ? ` · 🏛️ ${data.labels.government}` : ""}` : null,
    "",
    `💰 ${data.salary}`,
    data.place ? `📍 ${data.place}` : null,
    data.schedule ? `🕘 ${data.schedule}` : null,
    ...data.tags.slice(0, 5).map((tag) => `✅ ${tag}`),
    "",
    `👉 ${t("promo.apply")}: ${vacancyUrl(v.slug)}`,
    "",
    [t("promo.hashtags"), data.categorySlug ? `#${data.categorySlug.replace(/_/g, "")}` : null].filter(Boolean).join(" "),
  ];
  return lines.filter((l): l is string => l !== null).join("\n");
}
