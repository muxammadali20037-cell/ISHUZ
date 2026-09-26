import type { ReactNode } from "react";
import Link from "next/link";
import { Pencil } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import type { ReferenceData } from "@/lib/reference";
import { ageFromBirthDate, formatMoney, formatPhone, formatWorkTime, fullName, initials } from "@/lib/format";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { WorkerDraft } from "../types";
import { dateToMonth } from "../utils";
import { FinishBar } from "./finish-bar";
import { stepHref } from "./wizard-shell";

/**
 * Yakuniy tekshiruv: barcha qadamlar xulosasi + har biriga "Tahrirlash" havolasi (server komponent).
 */
export async function Review({ draft, reference }: { draft: WorkerDraft; reference: ReferenceData }) {
  const { t, tEnum, locale, name } = await getT();
  const w = draft.worker;
  const p = draft.profile;
  const pr = draft.preferences;
  const none = t("common.labels.not_specified");
  const byId = <T extends { id: string }>(list: T[]) => new Map(list.map((x) => [x.id, x]));
  const categories = byId(reference.categories);
  const subcategories = byId(reference.subcategories);
  const regions = byId(reference.regions);
  const districts = byId(reference.districts);
  const languages = new Map(reference.languages.map((l) => [l.code, l]));
  const benefits = new Map(reference.benefits.map((b) => [b.code, b]));
  const list = (items: string[]) => (items.length ? items.join(", ") : none);
  const age = ageFromBirthDate(p.birth_date);
  const completeness = w?.completeness ?? 0;

  const salary = (() => {
    if (!pr || (pr.salary_min === null && pr.salary_expected === null)) return none;
    const parts: string[] = [];
    if (pr.salary_min !== null) parts.push(`${t("common.labels.from")} ${formatMoney(pr.salary_min, locale)}`);
    if (pr.salary_expected !== null) parts.push(`${t("onboarding.worker.review.expected")} ${formatMoney(pr.salary_expected, locale)}`);
    return `${parts.join(" · ")} ${tEnum("salary_type_suffix", pr.salary_type)}`.trim();
  })();

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-4">
          <Avatar src={p.avatar_url} fallback={initials(p.first_name, p.last_name)} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold">{fullName(p.first_name, p.last_name) || none}</p>
            <p className="truncate text-sm text-muted-foreground">{w?.headline || none}</p>
          </div>
          <span className="tabular text-lg font-bold text-primary">{completeness}%</span>
        </div>
        <Progress value={completeness} className="mt-3" tone={completeness >= 70 ? "success" : "primary"} />
        <p className="mt-1.5 text-xs text-muted-foreground">{t("onboarding.worker.review.completeness_hint")}</p>
      </div>

      <Section step={1} title={t("onboarding.worker.steps.personal.title")} editLabel={t("common.actions.edit")}>
        <Row label={t("onboarding.worker.personal.birth_date")}>{age !== null ? t("onboarding.worker.review.age", { age }) : none}</Row>
        <Row label={t("onboarding.worker.personal.gender")}>{p.gender ? tEnum("gender", p.gender) : none}</Row>
        <Row label={t("common.labels.phone")}>
          {draft.contacts?.phone ? (
            <span className="inline-flex items-center gap-1.5">
              {formatPhone(draft.contacts.phone)}
              {draft.contacts.phone_verified_at ? <Badge variant="success" size="sm">{t("common.labels.verified")}</Badge> : null}
            </span>
          ) : (
            none
          )}
        </Row>
        <Row label={t("onboarding.worker.personal.telegram")}>{draft.contacts?.telegram_username ? `@${draft.contacts.telegram_username}` : none}</Row>
      </Section>

      <Section step={2} title={t("onboarding.worker.steps.location.title")} editLabel={t("common.actions.edit")}>
        <Row label={t("onboarding.worker.location.region")}>
          {[w?.region_id ? name(regions.get(w.region_id)) : "", w?.district_id ? name(districts.get(w.district_id)) : ""].filter(Boolean).join(", ") || none}
          {w?.area_hint ? <span className="text-muted-foreground"> · {w.area_hint}</span> : null}
        </Row>
        <Row label={t("onboarding.worker.location.work_districts")}>{list(draft.locations.map((id) => name(districts.get(id))).filter(Boolean))}</Row>
        <Row label={t("onboarding.worker.location.remote")}>{w ? tEnum("remote_preference", w.remote_preference) : none}</Row>
        <Row label={t("onboarding.worker.location.geo_title")}>{draft.hasGeo ? t("onboarding.worker.location.geo_saved_badge") : none}</Row>
      </Section>

      <Section step={3} title={t("onboarding.worker.steps.profession.title")} editLabel={t("common.actions.edit")}>
        <Row label={t("onboarding.worker.profession.category")}>
          {[w?.category_id ? name(categories.get(w.category_id)) : "", w?.subcategory_id ? name(subcategories.get(w.subcategory_id)) : ""].filter(Boolean).join(" · ") || none}
        </Row>
        <Row label={t("onboarding.worker.profession.headline")}>{w?.headline || none}</Row>
      </Section>

      <Section step={4} title={t("onboarding.worker.steps.experience.title")} editLabel={t("common.actions.edit")}>
        <Row label={t("onboarding.worker.experience.level")}>{w ? tEnum("experience_level", w.experience_level) : none}</Row>
        {draft.experience.map((e) => (
          <Row key={e.id} label={e.company_name}>
            {e.position}
            <span className="text-muted-foreground">
              {" "}
              · {dateToMonth(e.started_on)} – {e.is_current ? t("onboarding.worker.review.present") : (dateToMonth(e.ended_on) ?? "")}
            </span>
          </Row>
        ))}
      </Section>

      <Section step={5} title={t("onboarding.worker.steps.skills.title")} editLabel={t("common.actions.edit")}>
        <Row label={t("onboarding.worker.skills.title")}>
          {draft.skills.length ? (
            <span className="flex flex-wrap gap-1.5">
              {draft.skills.map((s) => (
                <Badge key={s.skill_id} variant="primary">
                  {locale === "ru" ? s.name_ru : s.name_uz}
                  <span className="opacity-70">· {tEnum("skill_level", s.level)}</span>
                </Badge>
              ))}
            </span>
          ) : (
            none
          )}
        </Row>
        <Row label={t("onboarding.worker.skills.languages_title")}>{list(draft.languages.map((l) => `${name(languages.get(l.language_code))} (${tEnum("language_level", l.level)})`))}</Row>
      </Section>

      <Section step={6} title={t("onboarding.worker.steps.education.title")} editLabel={t("common.actions.edit")}>
        <Row label={t("onboarding.worker.education.level")}>{draft.education[0] ? tEnum("education_level", draft.education[0].level) : none}</Row>
        {draft.education
          .filter((e) => e.institution)
          .map((e) => (
            <Row key={e.id} label={e.institution ?? ""}>
              {[e.field, [e.started_year, e.ended_year].filter(Boolean).join("–")].filter(Boolean).join(" · ") || tEnum("education_level", e.level)}
            </Row>
          ))}
      </Section>

      <Section step={7} title={t("onboarding.worker.steps.portfolio.title")} editLabel={t("common.actions.edit")}>
        {draft.portfolio.length ? (
          draft.portfolio.map((item) => (
            <Row key={item.id} label={tEnum("portfolio_type", item.type)}>
              {item.title}
              {item.media_paths.length ? <span className="text-muted-foreground"> · {t("onboarding.worker.review.files", { count: item.media_paths.length })}</span> : null}
            </Row>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">{none}</p>
        )}
      </Section>

      <Section step={8} title={t("onboarding.worker.steps.preferences.title")} editLabel={t("common.actions.edit")}>
        <Row label={t("onboarding.worker.preferences.employment_types")}>{pr?.employment_types.length ? list(pr.employment_types.map((v) => tEnum("employment_type", v))) : t("common.labels.any")}</Row>
        <Row label={t("onboarding.worker.preferences.schedules")}>{pr?.schedules.length ? list(pr.schedules.map((v) => tEnum("work_schedule", v))) : t("common.labels.any")}</Row>
        <Row label={t("onboarding.worker.preferences.work_time")}>{pr?.work_time_from || pr?.work_time_to ? `${formatWorkTime(pr.work_time_from)} – ${formatWorkTime(pr.work_time_to)}` : none}</Row>
        <Row label={t("onboarding.worker.preferences.salary")}>{salary}</Row>
        <Row label={t("onboarding.worker.preferences.availability")}>{pr ? tEnum("availability", pr.availability) : none}</Row>
        <Row label={t("onboarding.worker.preferences.work_format")}>
          {w ? tEnum("work_format", w.work_format) : none}
          {pr?.official_terms.length ? <span className="text-muted-foreground"> · {list(pr.official_terms.map((c) => name(benefits.get(c))).filter(Boolean))}</span> : null}
        </Row>
      </Section>

      <FinishBar />
    </div>
  );
}

function Section({ step, title, editLabel, children }: { step: number; title: string; editLabel: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">
          <span className="mr-2 inline-flex size-5 items-center justify-center rounded-full bg-primary-soft text-[11px] font-bold text-primary">{step}</span>
          {title}
        </h2>
        <Link href={stepHref(step)} className="inline-flex h-9 items-center gap-1 rounded-lg px-2 text-sm font-medium text-primary hover:bg-primary-soft">
          <Pencil className="size-3.5" />
          {editLabel}
        </Link>
      </div>
      <div className="divide-y divide-border/70 px-4">{children}</div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-0.5 py-2.5 text-sm sm:grid-cols-[minmax(0,10rem)_1fr] sm:gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0 break-words">{children}</span>
    </div>
  );
}
