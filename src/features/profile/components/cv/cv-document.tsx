"use client";

import { useSyncExternalStore } from "react";
import { Download, Link2, Mail, MapPin, Phone, Printer, Send, Share2 } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { formatDate, formatMoney, formatPhone, fullName, initials } from "@/lib/format";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/checkbox";
import { toast } from "@/components/ui/toast";
import { ageFrom, formatExperienceRange, formatYearRange } from "../../pure";
import type { WorkerProfileFull } from "../../queries";

const SHOW_PHONE_KEY = "ishuz_cv_show_phone";
const phoneListeners = new Set<() => void>();
function subscribeShowPhone(cb: () => void) {
  phoneListeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    phoneListeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}
function readShowPhone(): boolean {
  try {
    return localStorage.getItem(SHOW_PHONE_KEY) !== "0";
  } catch {
    return true;
  }
}
function writeShowPhone(v: boolean) {
  try {
    localStorage.setItem(SHOW_PHONE_KEY, v ? "1" : "0");
  } catch {
    /* localStorage yo'q */
  }
  phoneListeners.forEach((l) => l());
}

const PRINT_CSS = `
@media print {
  @page { size: A4; margin: 14mm; }
  html, body { background: #fff !important; }
  header, nav, [data-print-hide] { display: none !important; }
  main { padding: 0 !important; }
  .cv-sheet { box-shadow: none !important; border: 0 !important; margin: 0 !important; padding: 0 !important; max-width: none !important; border-radius: 0 !important; }
  .cv-section { break-inside: avoid; }
  a { text-decoration: none !important; color: inherit !important; }
}
`;

export type CvProfile = { first_name: string; last_name: string; avatar_url: string | null; birth_date: string | null };
export type CvContacts = { phone: string | null; email: string | null; telegram: string | null };

/**
 * Faqat o'z CV'si: A4 ko'rinishidagi oq varaq + chop etish (PDF) + havolani ulashish.
 * Telefon faqat egasiga ko'rinadi; "CVda ko'rsatish" tanlovi localStorage'da.
 */
export function CvDocument({ data, profile, contacts, officialTermNames }: { data: WorkerProfileFull; profile: CvProfile; contacts: CvContacts; officialTermNames: Record<string, string> }) {
  const { t, tEnum, name, locale } = useT();
  const showPhone = useSyncExternalStore(subscribeShowPhone, readShowPhone, () => true);
  const togglePhone = (v: boolean) => writeShowPhone(v);

  const share = async () => {
    const url = `${window.location.origin}/workers/${data.worker.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: fullName(profile.first_name, profile.last_name), url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast.success(t("profile.toast.copied"), t("profile.cv.share_hint"));
    } catch {
      toast.error(t("profile.errors.clipboard"), url);
    }
  };

  const w = data.worker;
  const pr = data.preferences;
  const age = ageFrom(profile.birth_date);
  const location = [name(w.region), name(w.district)].filter(Boolean).join(", ");
  const fullTitle = fullName(profile.first_name, profile.last_name);

  return (
    <div className="container-narrow py-4 sm:py-6">
      <style>{PRINT_CSS}</style>

      <div data-print-hide className="mb-4 flex flex-wrap items-center gap-2">
        <Button asChild>
          <a href="/api/cv/pdf" download>
            <Download className="size-4" /> {t("profile.cv.download_pdf")}
          </a>
        </Button>
        <Button type="button" variant="outline" onClick={() => window.print()}>
          <Printer className="size-4" /> {t("profile.cv.print")}
        </Button>
        <Button type="button" variant="outline" onClick={share}>
          <Share2 className="size-4" /> {t("profile.cv.share")}
        </Button>
        {contacts.phone ? (
          <label className="ml-auto flex cursor-pointer items-center gap-2 text-sm">
            <Switch checked={showPhone} onCheckedChange={togglePhone} aria-label={t("profile.cv.show_phone")} />
            {t("profile.cv.show_phone")}
          </label>
        ) : null}
      </div>
      <p data-print-hide className="mb-4 text-xs text-muted-foreground">{t("profile.cv.print_hint")}</p>

      <article className="cv-sheet mx-auto w-full max-w-[210mm] rounded-2xl border border-border bg-white p-6 text-slate-900 shadow-md sm:p-10">
        <header className="flex items-start gap-5">
          <Avatar src={profile.avatar_url} fallback={initials(profile.first_name, profile.last_name)} size="xl" className="bg-slate-100 text-slate-700" />
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">{fullTitle}</h1>
            {w.headline ? <p className="mt-1 text-base font-medium text-blue-700">{w.headline}</p> : null}
            <p className="mt-1 text-sm text-slate-600">
              {[name(w.category), name(w.subcategory), age ? t("profile.cv.age", { age }) : null, tEnum("experience_level", w.experience_level)].filter(Boolean).join(" · ")}
            </p>
          </div>
        </header>

        <section className="cv-section mt-6 grid gap-1.5 rounded-xl bg-slate-50 p-4 text-sm text-slate-700 sm:grid-cols-2">
          {location ? (
            <p className="inline-flex items-center gap-2">
              <MapPin className="size-4 text-slate-400" /> {location}
            </p>
          ) : null}
          {contacts.phone && showPhone ? (
            <p className="inline-flex items-center gap-2">
              <Phone className="size-4 text-slate-400" /> {formatPhone(contacts.phone)}
            </p>
          ) : null}
          {contacts.email ? (
            <p className="inline-flex items-center gap-2">
              <Mail className="size-4 text-slate-400" /> {contacts.email}
            </p>
          ) : null}
          {contacts.telegram ? (
            <p className="inline-flex items-center gap-2">
              <Send className="size-4 text-slate-400" /> @{contacts.telegram}
            </p>
          ) : null}
        </section>

        {w.about ? (
          <CvSection title={t("profile.cv.summary")}>
            <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">{w.about}</p>
          </CvSection>
        ) : null}

        {data.experience.length ? (
          <CvSection title={t("profile.cv.experience")}>
            <ol className="space-y-4">
              {data.experience.map((e) => (
                <li key={e.id} className="grid gap-1 sm:grid-cols-[150px_1fr] sm:gap-4">
                  <p className="text-xs font-medium text-slate-500 sm:pt-0.5">{formatExperienceRange(e.started_on, e.ended_on, e.is_current, locale, t("profile.labels.present"))}</p>
                  <div>
                    <p className="font-semibold text-slate-900">{e.position}</p>
                    <p className="text-sm text-slate-600">{e.company_name}</p>
                    {e.responsibilities ? <p className="mt-1 whitespace-pre-line text-sm text-slate-700">{e.responsibilities}</p> : null}
                    {e.achievements ? <p className="mt-1 whitespace-pre-line text-sm text-emerald-700">{e.achievements}</p> : null}
                  </div>
                </li>
              ))}
            </ol>
          </CvSection>
        ) : null}

        {data.skills.length ? (
          <CvSection title={t("profile.cv.skills")}>
            <ul className="flex flex-wrap gap-1.5">
              {data.skills.map((s) => (
                <li key={s.skill_id} className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-800">
                  {name(s.skill)} <span className="text-slate-500">· {tEnum("skill_level", s.level)}</span>
                </li>
              ))}
            </ul>
          </CvSection>
        ) : null}

        {data.languages.length ? (
          <CvSection title={t("profile.cv.languages")}>
            <ul className="grid gap-1 text-sm text-slate-700 sm:grid-cols-2">
              {data.languages.map((l) => (
                <li key={l.language_code}>
                  <span className="font-medium text-slate-900">{name(l.language) || l.language_code}</span> — {tEnum("language_level", l.level)}
                </li>
              ))}
            </ul>
          </CvSection>
        ) : null}

        {data.education.length ? (
          <CvSection title={t("profile.cv.education")}>
            <ul className="space-y-2">
              {data.education.map((e) => (
                <li key={e.id} className="grid gap-0.5 sm:grid-cols-[150px_1fr] sm:gap-4">
                  <p className="text-xs font-medium text-slate-500 sm:pt-0.5">{formatYearRange(e.started_year, e.ended_year)}</p>
                  <div>
                    <p className="font-semibold text-slate-900">{e.institution || tEnum("education_level", e.level)}</p>
                    <p className="text-sm text-slate-600">{[tEnum("education_level", e.level), e.field].filter(Boolean).join(" · ")}</p>
                  </div>
                </li>
              ))}
            </ul>
          </CvSection>
        ) : null}

        {data.portfolio.length ? (
          <CvSection title={t("profile.cv.portfolio")}>
            <ul className="space-y-1 text-sm">
              {data.portfolio.map((p) => {
                const href = p.link_url ?? p.media[0]?.url;
                return (
                  <li key={p.id} className="flex items-start gap-2">
                    <Link2 className="mt-0.5 size-4 shrink-0 text-slate-400" />
                    <span>
                      {href ? (
                        <a href={href} target="_blank" rel="noopener noreferrer" className="font-medium text-blue-700 hover:underline">
                          {p.title}
                        </a>
                      ) : (
                        <span className="font-medium">{p.title}</span>
                      )}
                      <span className="text-slate-500"> · {tEnum("portfolio_type", p.type)}</span>
                      {href ? <span className="block break-all text-xs text-slate-500">{href}</span> : null}
                    </span>
                  </li>
                );
              })}
            </ul>
          </CvSection>
        ) : null}

        {pr ? (
          <CvSection title={t("profile.cv.preferences")}>
            <dl className="grid gap-x-6 gap-y-1.5 text-sm text-slate-700 sm:grid-cols-2">
              <div>
                <dt className="text-xs text-slate-500">{t("profile.cv.salary")}</dt>
                <dd className="font-medium text-slate-900">
                  {pr.salary_expected !== null ? `${formatMoney(pr.salary_expected, locale)}${tEnum("salary_type_suffix", pr.salary_type)}` : t("common.labels.negotiable")}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">{t("profile.labels.availability")}</dt>
                <dd className="font-medium text-slate-900">{tEnum("availability", pr.availability)}</dd>
              </div>
              {pr.employment_types.length ? (
                <div>
                  <dt className="text-xs text-slate-500">{t("profile.labels.employment_types")}</dt>
                  <dd>{pr.employment_types.map((v) => tEnum("employment_type", v)).join(", ")}</dd>
                </div>
              ) : null}
              {pr.schedules.length ? (
                <div>
                  <dt className="text-xs text-slate-500">{t("profile.labels.schedules")}</dt>
                  <dd>{pr.schedules.map((v) => tEnum("work_schedule", v)).join(", ")}</dd>
                </div>
              ) : null}
              <div>
                <dt className="text-xs text-slate-500">{t("profile.labels.work_format")}</dt>
                <dd>{tEnum("work_format", w.work_format)}</dd>
              </div>
              {pr.official_terms.length ? (
                <div>
                  <dt className="text-xs text-slate-500">{t("profile.labels.official_terms")}</dt>
                  <dd>{pr.official_terms.map((c) => officialTermNames[c] ?? c).join(", ")}</dd>
                </div>
              ) : null}
            </dl>
          </CvSection>
        ) : null}

        <footer className="mt-8 border-t border-slate-200 pt-3 text-[11px] text-slate-400">{t("profile.cv.generated", { date: formatDate(new Date(), locale) })}</footer>
      </article>
    </div>
  );
}

function CvSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="cv-section mt-6">
      <h2 className="mb-2 border-b border-slate-200 pb-1 text-xs font-bold uppercase tracking-[0.12em] text-blue-700">{title}</h2>
      {children}
    </section>
  );
}
