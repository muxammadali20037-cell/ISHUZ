import Link from "next/link";
import { AtSign, BadgeCheck, Globe, MapPin, Send, Settings, Star, Users, Phone, Landmark } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { formatPhone, initials } from "@/lib/format";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { VacancyCard } from "@/components/shared/vacancy-card";
import { CategoryIcon } from "@/components/shared/category-icon";
import type { VacancyCardData } from "@/components/shared/vacancy-card";
import { instagramUrl, telegramUrl } from "../../schema";
import type { CompanyPublic, ProfileRating } from "../../types";

/** Ochiq kompaniya sahifasi: /company/[slug] */
export async function CompanyPage({ company, vacancies, rating, canManage }: { company: CompanyPublic; vacancies: VacancyCardData[]; rating: ProfileRating | null; canManage: boolean }) {
  const { t, tEnum, name } = await getT();
  const location = [company.district ? name(company.district) : null, company.region ? name(company.region) : null].filter(Boolean).join(", ");
  const verified = company.verification_status === "verified";
  const tg = telegramUrl(company.telegram);
  const ig = instagramUrl(company.instagram);
  const links = [
    company.website ? { href: company.website, icon: Globe, label: t("employer.company.website") } : null,
    tg ? { href: tg, icon: Send, label: "Telegram" } : null,
    ig ? { href: ig, icon: AtSign, label: "Instagram" } : null,
  ].filter((l): l is NonNullable<typeof l> => l !== null);

  return (
    <div className="container-app py-6">
      {/* Sarlavha kartasi */}
      <section className="rounded-3xl border border-border/70 bg-card p-5 shadow-sm sm:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <Avatar src={company.logo_url} fallback={initials(company.name)} square size="2xl" alt={company.name} className="border border-border/70" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold sm:text-3xl">{company.name}</h1>
              {verified ? (
                <span className="inline-flex items-center gap-1 rounded-lg bg-success-soft px-2 py-0.5 text-xs font-semibold text-success">
                  <BadgeCheck className="size-4" /> {t("employer.company.verified")}
                </span>
              ) : null}
              {verified && company.is_government ? (
                <span className="inline-flex items-center gap-1 rounded-lg bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary">
                  <Landmark className="size-4" /> {t("jobs.government.badge")}
                </span>
              ) : null}
            </div>
            <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-sm text-muted-foreground sm:grid-cols-2">
              {company.industry ? (
                <div className="flex items-center gap-2">
                  <CategoryIcon name={company.industry.icon} className="size-4 shrink-0" />
                  <dt className="sr-only">{t("employer.company.industry")}</dt>
                  <dd>{name(company.industry)}</dd>
                </div>
              ) : null}
              {company.size ? (
                <div className="flex items-center gap-2">
                  <Users className="size-4 shrink-0" />
                  <dt className="sr-only">{t("employer.company.employees")}</dt>
                  <dd>{tEnum("company_size", company.size)}</dd>
                </div>
              ) : null}
              {location || company.address ? (
                <div className="flex items-center gap-2 sm:col-span-2">
                  <MapPin className="size-4 shrink-0" />
                  <dt className="sr-only">{t("employer.company.location")}</dt>
                  <dd>{[company.address, location].filter(Boolean).join(" · ")}</dd>
                </div>
              ) : null}
              {company.phone ? (
                <div className="flex items-center gap-2">
                  <Phone className="size-4 shrink-0" />
                  <dt className="sr-only">{t("employer.form.phone")}</dt>
                  <dd>
                    <a href={`tel:${company.phone}`} className="hover:text-foreground">
                      {formatPhone(company.phone)}
                    </a>
                  </dd>
                </div>
              ) : null}
            </dl>
            {rating ? (
              <p className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-warning-soft px-2.5 py-1 text-sm font-semibold text-warning">
                <Star className="size-4 fill-current" /> {rating.avg_rating.toFixed(1)}
                <span className="font-normal">· {t("employer.company.reviews_count", { count: rating.reviews_count })}</span>
              </p>
            ) : null}
            {links.length || canManage ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {links.map((l) => (
                  <Button key={l.href} asChild variant="outline" size="sm">
                    <a href={l.href} target="_blank" rel="noopener noreferrer nofollow">
                      <l.icon className="size-4" /> {l.label}
                    </a>
                  </Button>
                ))}
                {canManage ? (
                  <Button asChild variant="soft" size="sm">
                    <Link href="/company/settings">
                      <Settings className="size-4" /> {t("employer.company.manage")}
                    </Link>
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section className="lg:order-1">
          <h2 className="mb-3 text-lg font-bold">
            {t("employer.company.active_vacancies")} {vacancies.length ? <span className="text-muted-foreground">({vacancies.length})</span> : null}
          </h2>
          {vacancies.length ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {vacancies.map((v) => (
                <VacancyCard key={v.id} vacancy={v} />
              ))}
            </div>
          ) : (
            <EmptyState title={t("employer.company.no_vacancies")} />
          )}
        </section>
        {company.about ? (
          <section className="lg:order-2">
            <h2 className="mb-3 text-lg font-bold">{t("employer.company.about")}</h2>
            <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
              <p className="whitespace-pre-line text-[15px] leading-relaxed text-foreground/90">{company.about}</p>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
