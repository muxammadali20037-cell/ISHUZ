import type { Metadata } from "next";
import Link from "next/link";
import { Eye, ExternalLink, BadgeCheck } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { formatDate, formatDateTime, formatPhone, fullName, initials } from "@/lib/format";
import { getAdminContext } from "@/features/admin/context";
import { getEmployerDetail, listEmployers, parseEmployerFilters } from "@/features/admin/queries/employers";
import { param, type SearchParams } from "@/features/admin/queries/shared";
import { closeHref, viewHref } from "@/features/admin/url";
import { DataTable } from "@/features/admin/components/data-table";
import { Filters, FilterSearch, FilterSelect } from "@/features/admin/components/filters";
import { Pagination } from "@/features/admin/components/pagination";
import { AdminPageHeader, Forbidden, QueryError } from "@/features/admin/components/notes";
import { StatusBadge, BoolBadge } from "@/features/admin/components/status-badge";
import { UrlSheet } from "@/features/admin/components/url-sheet";
import { DetailRow, DetailSection } from "@/features/admin/components/detail-sheet";
import { UserBlockButton } from "@/features/admin/components/user-actions";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: `${t("admin.nav.employers")} · ${t("admin.shell.title")}` };
}

const BASE = "/admin/employers";

export default async function AdminEmployersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const ctx = await getAdminContext();
  const { t, tEnum, locale, name } = await getT();
  if (!ctx.can("employers.view")) return <Forbidden perm="employers.view" />;
  const sp = await searchParams;
  const f = parseEmployerFilters(sp);
  const view = param(sp, "view");
  const [paged, detail] = await Promise.all([listEmployers(f), view ? getEmployerDetail(view) : Promise.resolve(null)]);
  const hasActive = Boolean(f.q || f.verification || f.type);
  const canBlock = ctx.can("users.block");

  return (
    <div>
      <AdminPageHeader
        title={t("admin.employers.title")}
        subtitle={t("common.labels.results", { count: paged.total })}
        actions={
          ctx.can("employers.verify") ? (
            <Button asChild variant="soft" size="sm">
              <Link href="/admin/verifications">
                <BadgeCheck className="size-4" /> {t("admin.employers.verification_requests")}
              </Link>
            </Button>
          ) : null
        }
      />
      <Filters action={BASE} hasActive={hasActive}>
        <FilterSearch name="q" defaultValue={f.q} placeholder={t("admin.employers.search_placeholder")} />
        <FilterSelect
          name="verification"
          defaultValue={f.verification}
          placeholder={t("admin.employers.col_verification")}
          options={(["unverified", "pending", "verified", "rejected"] as const).map((s) => ({ value: s, label: tEnum("verification_status", s) }))}
        />
        <FilterSelect
          name="type"
          defaultValue={f.type}
          placeholder={t("admin.employers.col_type")}
          options={(["company", "government", "individual_entrepreneur", "person"] as const).map((s) => ({ value: s, label: tEnum("employer_type", s) }))}
        />
      </Filters>
      <QueryError message={paged.error} />
      <DataTable
        rows={paged.rows}
        rowKey={(r) => r.id}
        rowMuted={(r) => r.profiles.is_blocked}
        empty={<EmptyState title={t("common.empty.no_results_title")} description={t("common.empty.no_results_desc")} />}
        columns={[
          {
            key: "name",
            header: t("admin.users.col_user"),
            render: (r) => (
              <div className="flex items-center gap-2.5">
                <Avatar src={r.profiles.avatar_url} fallback={initials(r.profiles.first_name, r.profiles.last_name)} size="sm" />
                <div className="min-w-0">
                  <p className="truncate font-medium">{fullName(r.profiles.first_name, r.profiles.last_name) || t("common.labels.not_specified")}</p>
                  <p className="truncate text-xs text-muted-foreground">{r.display_name ?? "—"}</p>
                </div>
              </div>
            ),
          },
          { key: "type", header: t("admin.employers.col_type"), render: (r) => <Badge size="sm">{tEnum("employer_type", r.employer_type)}</Badge> },
          {
            key: "company",
            header: t("admin.employers.company"),
            render: (r) =>
              r.companies ? (
                <div className="flex items-center gap-2">
                  <Avatar src={r.companies.logo_url} fallback={initials(r.companies.name)} size="sm" square />
                  <div className="min-w-0">
                    <Link href={`/company/${r.companies.slug}`} target="_blank" className="block truncate font-medium hover:underline">{r.companies.name}</Link>
                    <StatusBadge status={r.companies.verification_status} label={tEnum("verification_status", r.companies.verification_status)} size="sm" />
                  </div>
                </div>
              ) : (
                <span className="text-muted-foreground">—</span>
              ),
          },
          { key: "verification", header: t("admin.employers.col_verification"), render: (r) => <StatusBadge status={r.verification_status} label={tEnum("verification_status", r.verification_status)} size="sm" /> },
          { key: "region", header: t("admin.workers.region"), render: (r) => name(r.regions) || <span className="text-muted-foreground">—</span> },
          {
            key: "flags",
            header: t("admin.workers.col_flags"),
            render: (r) => (
              <div className="flex flex-wrap gap-1">
                {!r.onboarding_completed_at ? <Badge variant="warning" size="sm">{t("admin.workers.not_onboarded")}</Badge> : null}
                {r.profiles.is_blocked ? <Badge variant="destructive" size="sm">{t("admin.users.blocked")}</Badge> : null}
                {r.companies?.is_blocked ? <Badge variant="destructive" size="sm">{t("admin.employers.company_blocked")}</Badge> : null}
              </div>
            ),
          },
          { key: "created", header: t("admin.users.col_created"), render: (r) => <span title={formatDateTime(r.created_at, locale)}>{formatDate(r.created_at, locale, "d MMM yyyy")}</span> },
          {
            key: "actions",
            header: "",
            align: "right",
            render: (r) => (
              <Button asChild variant="ghost" size="sm">
                <Link href={viewHref(BASE, sp, r.id)} scroll={false}>
                  <Eye className="size-4" />
                  {t("common.actions.view")}
                </Link>
              </Button>
            ),
          },
        ]}
      />
      <Pagination paged={paged} base={BASE} searchParams={sp} />

      {view ? (
        <UrlSheet
          title={detail ? fullName(detail.profiles.first_name, detail.profiles.last_name) || t("common.labels.not_specified") : t("common.errors.not_found")}
          description={detail ? tEnum("employer_type", detail.employer_type) : undefined}
          closeHref={closeHref(BASE, sp)}
          footer={
            detail ? (
              <div className="flex gap-2">
                <Button asChild variant="outline" className="flex-1">
                  <Link href={`/admin/vacancies?q=${detail.profile_id}`}>{t("admin.users.vacancies")}: {detail.counts.vacancies}</Link>
                </Button>
                <UserBlockButton profileId={detail.profile_id} isBlocked={detail.profiles.is_blocked} name={fullName(detail.profiles.first_name, detail.profiles.last_name)} canBlock={canBlock} size="default" />
              </div>
            ) : undefined
          }
        >
          {detail ? (
            <>
              <DetailSection title={t("admin.users.section_profile")}>
                <DetailRow label={t("admin.employers.display_name")}>{detail.display_name ?? "—"}</DetailRow>
                <DetailRow label={t("admin.employers.col_verification")}><StatusBadge status={detail.verification_status} label={tEnum("verification_status", detail.verification_status)} size="sm" /></DetailRow>
                <DetailRow label={t("admin.employers.contact_phone")}>{detail.contact_phone ? formatPhone(detail.contact_phone) : "—"}</DetailRow>
                <DetailRow label={t("admin.workers.region")}>{[name(detail.regions), name(detail.districts)].filter(Boolean).join(", ") || "—"}</DetailRow>
                <DetailRow label={t("admin.workers.onboarded")}><BoolBadge value={!!detail.onboarding_completed_at} yes={t("common.labels.yes")} no={t("common.labels.no")} /></DetailRow>
                <DetailRow label={t("admin.users.vacancies")}>{detail.counts.vacancies} ({t("admin.vacancies.active_count", { count: detail.counts.active })})</DetailRow>
                <DetailRow label="ID"><code className="text-xs">{detail.profile_id}</code></DetailRow>
              </DetailSection>
              {detail.about ? <p className="mt-3 whitespace-pre-line rounded-xl bg-secondary/60 p-3 text-sm">{detail.about}</p> : null}
              {detail.companies ? (
                <DetailSection title={t("admin.employers.company")}>
                  <DetailRow label={t("admin.employers.company")}>
                    <Link href={`/company/${detail.companies.slug}`} target="_blank" className="inline-flex items-center gap-1 text-primary hover:underline">
                      {detail.companies.name} <ExternalLink className="size-3.5" />
                    </Link>
                  </DetailRow>
                  <DetailRow label={t("admin.employers.col_verification")}><StatusBadge status={detail.companies.verification_status} label={tEnum("verification_status", detail.companies.verification_status)} size="sm" /></DetailRow>
                  <DetailRow label={t("admin.employers.tin")}>{detail.companies.tin ?? "—"}</DetailRow>
                  <DetailRow label={t("common.labels.phone")}>{detail.companies.phone ? formatPhone(detail.companies.phone) : "—"}</DetailRow>
                  <DetailRow label="Telegram">{detail.companies.telegram ?? "—"}</DetailRow>
                  <DetailRow label={t("admin.employers.website")}>{detail.companies.website ? <a href={detail.companies.website} target="_blank" rel="noreferrer" className="text-primary hover:underline">{detail.companies.website}</a> : "—"}</DetailRow>
                  <DetailRow label={t("admin.employers.address")}>{detail.companies.address ?? "—"}</DetailRow>
                  <DetailRow label={t("admin.employers.size")}>{detail.companies.size ? tEnum("company_size", detail.companies.size) : "—"}</DetailRow>
                  <DetailRow label={t("admin.employers.members")}>
                    {detail.companies.company_members.length ? detail.companies.company_members.map((m, i) => (
                      <span key={i} className="block">{fullName(m.profiles?.first_name, m.profiles?.last_name) || m.profiles?.id?.slice(0, 8)} · {tEnum("company_member_role", m.role)}</span>
                    )) : "—"}
                  </DetailRow>
                  {detail.companies.is_blocked ? <DetailRow label={t("admin.workers.col_flags")}><Badge variant="destructive" size="sm">{t("admin.employers.company_blocked")}</Badge></DetailRow> : null}
                </DetailSection>
              ) : null}
              {detail.verifications.length ? (
                <DetailSection title={t("admin.employers.verification_requests")}>
                  {detail.verifications.map((v) => (
                    <div key={v.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                      <span>{tEnum("verification_type", v.type)} · <span className="text-xs text-muted-foreground">{formatDate(v.created_at, locale, "d MMM yyyy")}</span></span>
                      <StatusBadge status={v.status} label={tEnum("verification_status", v.status)} size="sm" />
                    </div>
                  ))}
                </DetailSection>
              ) : null}
            </>
          ) : (
            <EmptyState title={t("common.errors.not_found")} />
          )}
        </UrlSheet>
      ) : null}
    </div>
  );
}
