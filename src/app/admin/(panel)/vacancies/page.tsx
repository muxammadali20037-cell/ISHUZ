import type { Metadata } from "next";
import Link from "next/link";
import { Eye, ExternalLink, Flag } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { formatDate, formatDateTime, formatSalaryRange, formatWorkTime, fullName } from "@/lib/format";
import { getAdminContext } from "@/features/admin/context";
import { getVacancyDetail, listVacancies, parseVacancyFilters, vacancyStatusCounts, VACANCY_STATUSES } from "@/features/admin/queries/vacancies";
import { categoryOptions } from "@/features/admin/queries/reference";
import { param, type SearchParams } from "@/features/admin/queries/shared";
import { closeHref, viewHref, withParam } from "@/features/admin/url";
import { DataTable } from "@/features/admin/components/data-table";
import { Filters, FilterHidden, FilterSearch, FilterSelect } from "@/features/admin/components/filters";
import { LinkTabs } from "@/features/admin/components/link-tabs";
import { Pagination } from "@/features/admin/components/pagination";
import { AdminPageHeader, Forbidden, QueryError } from "@/features/admin/components/notes";
import { StatusBadge } from "@/features/admin/components/status-badge";
import { UrlSheet } from "@/features/admin/components/url-sheet";
import { DetailRow, DetailSection } from "@/features/admin/components/detail-sheet";
import { VacancyActions } from "@/features/admin/components/vacancy-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: `${t("admin.nav.vacancies")} · ${t("admin.shell.title")}` };
}

const BASE = "/admin/vacancies";

export default async function AdminVacanciesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const ctx = await getAdminContext();
  const { t, tEnum, locale, name } = await getT();
  if (!ctx.can("vacancies.view")) return <Forbidden perm="vacancies.view" />;
  const sp = await searchParams;
  const f = parseVacancyFilters(sp);
  const view = param(sp, "view");
  const canModerate = ctx.can("vacancies.moderate");
  const [paged, counts, categories, detail] = await Promise.all([listVacancies(f), vacancyStatusCounts(), categoryOptions(), view ? getVacancyDetail(view) : Promise.resolve(null)]);
  const hasActive = Boolean(f.q || f.category);
  const salaryLabels = { negotiable: t("common.labels.negotiable"), from: t("common.labels.from"), to: t("common.labels.to") };

  const tabs = [
    { href: withParam(BASE, { q: f.q, category: f.category }, "status", null), label: t("admin.vacancies.all"), active: !f.status },
    ...VACANCY_STATUSES.map((s) => ({ href: withParam(BASE, { q: f.q, category: f.category }, "status", s), label: tEnum("vacancy_status", s), count: counts[s], active: f.status === s })),
  ];
  // Moderatsiya navbati birinchi
  const pendingIdx = tabs.findIndex((x) => x.href.includes("status=pending_review"));
  if (pendingIdx > 0) tabs.splice(1, 0, ...tabs.splice(pendingIdx, 1));

  const ownerLabel = (r: { companies: { name: string; slug: string } | null; profiles: { first_name: string; last_name: string } | null; owner_profile_id: string | null }) =>
    r.companies ? (
      <Link href={`/company/${r.companies.slug}`} target="_blank" className="hover:underline">{r.companies.name}</Link>
    ) : r.profiles ? (
      <Link href={`/admin/users?q=${r.owner_profile_id ?? ""}`} className="hover:underline">{fullName(r.profiles.first_name, r.profiles.last_name)}</Link>
    ) : (
      <span className="text-muted-foreground">—</span>
    );

  return (
    <div>
      <AdminPageHeader title={t("admin.vacancies.title")} subtitle={t("common.labels.results", { count: paged.total })} />
      <LinkTabs tabs={tabs} />
      <Filters action={BASE} hasActive={hasActive}>
        <FilterHidden name="status" value={f.status ?? ""} />
        <FilterSearch name="q" defaultValue={f.q} placeholder={t("admin.vacancies.search_placeholder")} />
        <FilterSelect name="category" defaultValue={f.category} placeholder={t("admin.workers.category")} options={categories.map((c) => ({ value: c.id, label: name(c) }))} />
      </Filters>
      <QueryError message={paged.error} />
      <DataTable
        rows={paged.rows}
        rowKey={(r) => r.id}
        empty={<EmptyState title={f.status === "pending_review" ? t("admin.vacancies.queue_empty") : t("common.empty.no_results_title")} description={f.status === "pending_review" ? undefined : t("common.empty.no_results_desc")} />}
        columns={[
          {
            key: "title",
            header: t("admin.vacancies.col_title"),
            render: (r) => (
              <div className="min-w-0 max-w-[320px]">
                <p className="truncate font-medium">{r.title}</p>
                <p className="truncate text-xs text-muted-foreground">{[name(r.categories), name(r.regions)].filter(Boolean).join(" · ") || r.slug}</p>
                <div className="mt-0.5 flex flex-wrap gap-1">
                  {r.requires_review ? <Badge variant="warning" size="sm">{t("admin.vacancies.requires_review")}</Badge> : null}
                  {r.profiles?.is_blocked ? <Badge variant="destructive" size="sm">{t("admin.vacancies.owner_blocked")}</Badge> : null}
                </div>
              </div>
            ),
          },
          { key: "owner", header: t("admin.vacancies.col_owner"), render: (r) => ownerLabel(r) },
          {
            key: "status",
            header: t("admin.vacancies.col_status"),
            render: (r) => (
              <div>
                <StatusBadge status={r.status} label={tEnum("vacancy_status", r.status)} size="sm" />
                {r.moderation_note ? <p className="mt-0.5 max-w-[200px] truncate text-xs text-muted-foreground" title={r.moderation_note}>{r.moderation_note}</p> : null}
              </div>
            ),
          },
          { key: "published", header: t("admin.vacancies.col_published"), render: (r) => (r.published_at ? <span title={formatDateTime(r.published_at, locale)}>{formatDate(r.published_at, locale, "d MMM yyyy")}</span> : <span className="text-muted-foreground" title={formatDateTime(r.created_at, locale)}>{t("admin.vacancies.created")} {formatDate(r.created_at, locale, "d MMM")}</span>) },
          { key: "apps", header: t("admin.vacancies.col_applications"), align: "right", render: (r) => r.applications_count },
          {
            key: "reports",
            header: t("admin.vacancies.col_reports"),
            align: "right",
            render: (r) =>
              r.reports_count ? (
                <Link href={`/admin/reports?status=open`} className="inline-flex items-center gap-1 font-semibold text-destructive hover:underline">
                  <Flag className="size-3.5" /> {r.reports_count}
                </Link>
              ) : (
                <span className="text-muted-foreground">0</span>
              ),
          },
          {
            key: "actions",
            header: "",
            align: "right",
            className: "min-w-[280px]",
            render: (r) => (
              <div className="flex flex-wrap items-center justify-end gap-1.5">
                {r.status === "active" ? (
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/jobs/${r.slug}`} target="_blank">
                      <ExternalLink className="size-4" /> {t("common.actions.view")}
                    </Link>
                  </Button>
                ) : (
                  <Button asChild variant="ghost" size="sm">
                    <Link href={viewHref(BASE, sp, r.id)} scroll={false}>
                      <Eye className="size-4" /> {t("common.actions.view")}
                    </Link>
                  </Button>
                )}
                <VacancyActions vacancyId={r.id} status={r.status} title={r.title} canModerate={canModerate} />
              </div>
            ),
          },
        ]}
      />
      <Pagination paged={paged} base={BASE} searchParams={sp} />

      {view ? (
        <UrlSheet
          title={detail?.title ?? t("common.errors.not_found")}
          description={detail ? `${tEnum("vacancy_status", detail.status)} · ${formatDateTime(detail.updated_at, locale)}` : undefined}
          closeHref={closeHref(BASE, sp)}
          wide
          footer={detail ? <VacancyActions vacancyId={detail.id} status={detail.status} title={detail.title} canModerate={canModerate} size="default" stacked /> : undefined}
        >
          {detail ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={detail.status} label={tEnum("vacancy_status", detail.status)} />
                {detail.requires_review ? <Badge variant="warning">{t("admin.vacancies.requires_review")}</Badge> : null}
                {detail.status === "active" ? (
                  <Link href={`/jobs/${detail.slug}`} target="_blank" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
                    <ExternalLink className="size-3.5" /> /jobs/{detail.slug}
                  </Link>
                ) : null}
              </div>
              {detail.moderation_note ? (
                <div className="mt-3 rounded-xl bg-warning-soft p-3 text-sm text-warning">
                  <span className="font-medium">{t("admin.vacancies.note")}:</span> {detail.moderation_note}
                </div>
              ) : null}
              <DetailSection title={t("admin.vacancies.section_main")}>
                <DetailRow label={t("admin.vacancies.col_owner")}>{ownerLabel(detail)}</DetailRow>
                <DetailRow label={t("admin.workers.category")}>{[name(detail.categories), name(detail.subcategories)].filter(Boolean).join(" · ") || "—"}</DetailRow>
                <DetailRow label={t("admin.workers.region")}>{detail.is_remote ? tEnum("employment_type", "remote") : [name(detail.regions), name(detail.districts), detail.address].filter(Boolean).join(", ") || "—"}</DetailRow>
                <DetailRow label={t("admin.workers.salary")}>{formatSalaryRange(detail.salary_from, detail.salary_to, locale, salaryLabels)} {tEnum("salary_type_suffix", detail.salary_type)}</DetailRow>
                <DetailRow label={t("admin.workers.employment")}>{tEnum("employment_type", detail.employment_type)} · {tEnum("work_schedule", detail.schedule)}{detail.work_time_from ? ` · ${formatWorkTime(detail.work_time_from)}–${formatWorkTime(detail.work_time_to)}` : ""}</DetailRow>
                <DetailRow label={t("admin.workers.work_format")}>{tEnum("work_format", detail.work_format)}</DetailRow>
                <DetailRow label={t("admin.workers.experience")}>{tEnum("experience_min_months", String(detail.experience_min_months))}</DetailRow>
                <DetailRow label={t("admin.vacancies.requirements")}>
                  {[detail.education_min ? tEnum("education_level", detail.education_min) : null, detail.gender ? tEnum("gender", detail.gender) : null, detail.age_min || detail.age_max ? `${detail.age_min ?? "…"}–${detail.age_max ?? "…"}` : null].filter(Boolean).join(" · ") || "—"}
                </DetailRow>
                <DetailRow label={t("admin.vacancies.col_published")}>{detail.published_at ? formatDateTime(detail.published_at, locale) : "—"}{detail.expires_at ? ` → ${formatDate(detail.expires_at, locale)}` : ""}</DetailRow>
                <DetailRow label={t("admin.vacancies.col_applications")}>{detail.applications_count} · {t("common.labels.views", { count: detail.views_count })}</DetailRow>
                <DetailRow label="ID"><code className="text-xs">{detail.id}</code></DetailRow>
              </DetailSection>
              {detail.vacancy_skills.length ? (
                <DetailSection title={t("admin.workers.skills")}>
                  <div className="flex flex-wrap gap-1.5 py-2">
                    {detail.vacancy_skills.map((s, i) => (
                      <Badge key={i} variant={s.is_required ? "primary" : "outline"}>{name(s.skills)}</Badge>
                    ))}
                  </div>
                </DetailSection>
              ) : null}
              {detail.vacancy_languages.length ? (
                <DetailSection title={t("admin.workers.languages")}>
                  <div className="flex flex-wrap gap-1.5 py-2">
                    {detail.vacancy_languages.map((l, i) => (
                      <Badge key={i} variant="outline">{name(l.languages)} · {tEnum("language_level", l.min_level)}</Badge>
                    ))}
                  </div>
                </DetailSection>
              ) : null}
              {detail.vacancy_benefits.length ? (
                <DetailSection title={t("admin.vacancies.benefits")}>
                  <div className="flex flex-wrap gap-1.5 py-2">
                    {detail.vacancy_benefits.map((b, i) => (
                      <Badge key={i}>{name(b.benefits)}</Badge>
                    ))}
                  </div>
                </DetailSection>
              ) : null}
              <DetailSection title={t("admin.vacancies.description")}>
                <div className="whitespace-pre-line py-2 text-sm leading-relaxed">{detail.description || <span className="text-muted-foreground">—</span>}</div>
              </DetailSection>
            </>
          ) : (
            <EmptyState title={t("common.errors.not_found")} />
          )}
        </UrlSheet>
      ) : null}
    </div>
  );
}
