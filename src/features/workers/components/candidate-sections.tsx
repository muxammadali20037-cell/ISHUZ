import type { ReactNode } from "react";
import { MapPin, Building2, GraduationCap, Languages, Star, Wallet, CalendarDays, Clock, FileCheck2, Laptop } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { formatDate, formatMoney, formatWorkTime, formatRelative, initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import type { Enums } from "@/types/database.types";
import type { CandidateProfile, CandidateRating, CandidateReview, NamedRow } from "../types";

export function Section({ title, icon: Icon, children, className }: { title: string; icon?: React.ComponentType<{ className?: string }>; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl border border-border/70 bg-card p-4 sm:p-5", className)}>
      <h2 className="mb-3 flex items-center gap-2 text-base font-bold">
        {Icon ? <Icon className="size-4.5 text-primary" /> : null}
        {title}
      </h2>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-2 sm:flex-row sm:items-start sm:gap-4">
      <dt className="shrink-0 text-sm text-muted-foreground sm:w-44">{label}</dt>
      <dd className="text-[15px] font-medium">{children}</dd>
    </div>
  );
}

export async function AboutSection({ about }: { about: string | null }) {
  const { t } = await getT();
  if (!about?.trim()) return null;
  return (
    <Section title={t("workers.candidate.about")}>
      <p className="whitespace-pre-line text-[15px] leading-relaxed">{about}</p>
    </Section>
  );
}

/** Joylashuv: faqat viloyat/tuman + "Ishlay oladi" tumanlari + masofaviy ish. Koordinata yo'q. */
export async function LocationSection({ region, district, workDistricts, remotePreference }: { region: NamedRow | null; district: NamedRow | null; workDistricts: (NamedRow & { id: string })[]; remotePreference: Enums<"remote_preference"> }) {
  const { t, tEnum, name } = await getT();
  const location = [district ? name(district) : null, region ? name(region) : null].filter(Boolean).join(", ");
  if (!location && !workDistricts.length) return null;
  return (
    <Section title={t("workers.candidate.location")} icon={MapPin}>
      {location ? <p className="text-[15px] font-medium">{location}</p> : null}
      {workDistricts.length ? (
        <div className="mt-3">
          <p className="mb-1.5 text-sm text-muted-foreground">{t("workers.candidate.can_work_in")}</p>
          <div className="flex flex-wrap gap-1.5">
            {workDistricts.map((d) => (
              <Badge key={d.id} variant="outline">
                {name(d)}
              </Badge>
            ))}
          </div>
        </div>
      ) : null}
      <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
        <Laptop className="size-4" /> {t("workers.candidate.remote_pref")}: <span className="font-medium text-foreground">{tEnum("remote_preference", remotePreference)}</span>
      </p>
    </Section>
  );
}

export async function ExperienceSection({ items }: { items: CandidateProfile["experience"] }) {
  const { t, locale } = await getT();
  return (
    <Section title={t("workers.candidate.experience")} icon={Building2}>
      {!items.length ? (
        <p className="text-sm text-muted-foreground">{t("workers.candidate.no_experience")}</p>
      ) : (
        <ol className="relative ml-2 space-y-5 border-l border-border pl-5">
          {items.map((e) => (
            <li key={e.id} className="relative">
              <span className={cn("absolute -left-[27px] top-1.5 size-3 rounded-full border-2 border-card", e.is_current ? "bg-success" : "bg-primary")} aria-hidden />
              <p className="text-[15px] font-semibold">{e.position}</p>
              <p className="text-sm text-foreground/80">{e.company_name}</p>
              <p className="mt-0.5 text-xs text-muted-foreground tabular">
                {formatDate(e.started_on, locale, "LLL yyyy")} — {e.is_current || !e.ended_on ? t("workers.candidate.present") : formatDate(e.ended_on, locale, "LLL yyyy")}
              </p>
              {e.responsibilities ? (
                <p className="mt-2 whitespace-pre-line text-sm">
                  <span className="text-muted-foreground">{t("workers.candidate.responsibilities")}: </span>
                  {e.responsibilities}
                </p>
              ) : null}
              {e.achievements ? (
                <p className="mt-1 whitespace-pre-line text-sm">
                  <span className="text-muted-foreground">{t("workers.candidate.achievements")}: </span>
                  {e.achievements}
                </p>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </Section>
  );
}

const skillTone: Record<Enums<"skill_level">, "outline" | "default" | "success" | "primary"> = { beginner: "outline", intermediate: "default", good: "success", professional: "primary" };
const skillRank: Record<Enums<"skill_level">, number> = { professional: 3, good: 2, intermediate: 1, beginner: 0 };

export async function SkillsSection({ skills }: { skills: CandidateProfile["skills"] }) {
  const { t, tEnum, name } = await getT();
  if (!skills.length) return null;
  const sorted = [...skills].sort((a, b) => skillRank[b.level] - skillRank[a.level]);
  return (
    <Section title={t("workers.candidate.skills")} icon={Star}>
      <div className="flex flex-wrap gap-2">
        {sorted.map((s) => (
          <Badge key={s.id} variant={skillTone[s.level]} size="lg">
            {name(s)} <span className="font-normal opacity-80">· {tEnum("skill_level", s.level)}</span>
          </Badge>
        ))}
      </div>
    </Section>
  );
}

export async function LanguagesSection({ languages }: { languages: CandidateProfile["languages"] }) {
  const { t, tEnum } = await getT();
  if (!languages.length) return null;
  return (
    <Section title={t("workers.candidate.languages")} icon={Languages}>
      <ul className="divide-y divide-border">
        {languages.map((l) => (
          <li key={l.code} className="flex items-center justify-between py-2 text-[15px]">
            <span className="font-medium">{tEnum("language_code", l.code)}</span>
            <span className="text-sm text-muted-foreground">{tEnum("language_level", l.level)}</span>
          </li>
        ))}
      </ul>
    </Section>
  );
}

export async function EducationSection({ items }: { items: CandidateProfile["education"] }) {
  const { t, tEnum } = await getT();
  if (!items.length) return null;
  return (
    <Section title={t("workers.candidate.education")} icon={GraduationCap}>
      <ul className="space-y-3">
        {items.map((e) => (
          <li key={e.id}>
            <p className="text-[15px] font-semibold">{tEnum("education_level", e.level)}</p>
            {e.institution || e.field ? <p className="text-sm text-foreground/80">{[e.institution, e.field].filter(Boolean).join(" · ")}</p> : null}
            {e.started_year || e.ended_year ? (
              <p className="text-xs text-muted-foreground tabular">
                {e.started_year ?? ""}
                {e.started_year && e.ended_year ? " — " : ""}
                {e.ended_year ?? ""}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </Section>
  );
}

export async function PreferencesSection({
  preferences,
  workFormat,
  officialTerms,
}: {
  preferences: CandidateProfile["preferences"];
  workFormat: Enums<"work_format">;
  officialTerms: NamedRow[];
}) {
  const { t, tEnum, locale } = await getT();
  const p = preferences;
  const suffix = p && p.salary_type !== "negotiable" ? tEnum("salary_type_suffix", p.salary_type) : "";
  return (
    <Section title={t("workers.candidate.preferences")} icon={Wallet}>
      <dl className="divide-y divide-border">
        {p?.salary_expected ? (
          <Row label={t("workers.candidate.salary_expected")}>
            <span className="tabular">{formatMoney(p.salary_expected, locale)}</span>
            <span className="text-muted-foreground">{suffix}</span>
          </Row>
        ) : null}
        {p?.salary_min ? (
          <Row label={t("workers.candidate.salary_min")}>
            <span className="tabular">{formatMoney(p.salary_min, locale)}</span>
            <span className="text-muted-foreground">{suffix}</span>
          </Row>
        ) : null}
        {!p?.salary_expected && !p?.salary_min ? <Row label={t("workers.candidate.salary_expected")}>{t("common.labels.negotiable")}</Row> : null}
        {p?.employment_types.length ? (
          <Row label={t("workers.candidate.employment")}>
            <span className="flex flex-wrap gap-1.5">
              {p.employment_types.map((e) => (
                <Badge key={e}>{tEnum("employment_type", e)}</Badge>
              ))}
            </span>
          </Row>
        ) : null}
        {p?.schedules.length ? (
          <Row label={t("workers.candidate.schedules")}>
            <span className="flex flex-wrap gap-1.5">
              {p.schedules.map((s) => (
                <Badge key={s}>
                  <CalendarDays /> {tEnum("work_schedule", s)}
                </Badge>
              ))}
            </span>
          </Row>
        ) : null}
        {p?.work_time_from || p?.work_time_to ? (
          <Row label={t("workers.candidate.work_hours")}>
            <span className="inline-flex items-center gap-1 tabular">
              <Clock className="size-4 text-muted-foreground" /> {formatWorkTime(p.work_time_from)} — {formatWorkTime(p.work_time_to)}
            </span>
          </Row>
        ) : null}
        {p ? <Row label={t("workers.candidate.availability")}>{tEnum("availability", p.availability)}</Row> : null}
        <Row label={t("workers.candidate.work_format")}>{tEnum("work_format", workFormat)}</Row>
        {officialTerms.length ? (
          <Row label={t("workers.candidate.official_terms")}>
            <span className="flex flex-wrap gap-1.5">
              {officialTerms.map((b, i) => (
                <Badge key={i} variant="success">
                  <FileCheck2 /> {locale === "ru" ? b.name_ru : b.name_uz}
                </Badge>
              ))}
            </span>
          </Row>
        ) : null}
      </dl>
    </Section>
  );
}

function Stars({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-hidden>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={cn("size-4", i <= Math.round(value) ? "fill-warning text-warning" : "text-border")} />
      ))}
    </span>
  );
}

export async function RatingSection({ rating, reviews }: { rating: CandidateRating; reviews: CandidateReview[] }) {
  const { t, locale } = await getT();
  return (
    <Section title={t("workers.candidate.rating")} icon={Star}>
      {rating.count === 0 || rating.avg === null ? (
        <p className="text-sm text-muted-foreground">{t("workers.candidate.no_reviews")}</p>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <span className="text-3xl font-extrabold tabular">{rating.avg.toFixed(1)}</span>
            <div>
              <Stars value={rating.avg} />
              <p className="text-xs text-muted-foreground">{t("workers.candidate.reviews_count", { count: rating.count })}</p>
            </div>
          </div>
          {reviews.length ? (
            <ul className="mt-4 space-y-3">
              {reviews.map((r) => (
                <li key={r.id} className="rounded-xl bg-secondary/60 p-3">
                  <div className="flex items-center gap-2">
                    <Avatar src={r.author_avatar} fallback={initials(r.author_name)} size="sm" alt="" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{r.author_name}</p>
                      <p className="text-xs text-muted-foreground">{formatRelative(r.created_at, locale)}</p>
                    </div>
                    <Stars value={r.rating} />
                  </div>
                  {r.text ? <p className="mt-2 whitespace-pre-line text-sm">{r.text}</p> : null}
                </li>
              ))}
            </ul>
          ) : null}
        </>
      )}
    </Section>
  );
}
