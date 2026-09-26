import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { formatDateTime, formatRelative, fullName, initials } from "@/lib/format";
import { getAdminContext } from "@/features/admin/context";
import { listVerifications, parseVerificationFilters } from "@/features/admin/queries/moderation";
import type { SearchParams } from "@/features/admin/queries/shared";
import { DataTable } from "@/features/admin/components/data-table";
import { LinkTabs } from "@/features/admin/components/link-tabs";
import { Pagination } from "@/features/admin/components/pagination";
import { AdminPageHeader, Forbidden, QueryError } from "@/features/admin/components/notes";
import { StatusBadge } from "@/features/admin/components/status-badge";
import { DocumentLinks, VerificationActions } from "@/features/admin/components/verification-actions";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/misc";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: `${t("admin.nav.verifications")} · ${t("admin.shell.title")}` };
}

const BASE = "/admin/verifications";

export default async function AdminVerificationsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const ctx = await getAdminContext();
  const { t, tEnum, locale } = await getT();
  if (!ctx.can("employers.verify")) return <Forbidden perm="employers.verify" />;
  const sp = await searchParams;
  const f = parseVerificationFilters(sp);
  const paged = await listVerifications(f);

  return (
    <div>
      <AdminPageHeader title={t("admin.verifications.title")} subtitle={t("admin.verifications.subtitle")} />
      <LinkTabs
        tabs={[
          { href: BASE, label: t("admin.verifications.tab_pending"), count: paged.pendingCount, active: f.tab === "pending" },
          { href: `${BASE}?tab=history`, label: t("admin.verifications.tab_history"), active: f.tab === "history" },
        ]}
      />
      <QueryError message={paged.error} />
      <DataTable
        rows={paged.rows}
        rowKey={(r) => r.id}
        empty={<EmptyState title={f.tab === "pending" ? t("admin.verifications.empty") : t("common.empty.nothing_here")} />}
        columns={[
          {
            key: "who",
            header: t("admin.verifications.col_applicant"),
            render: (r) => (
              <div className="flex items-center gap-2.5">
                <Avatar src={r.profile?.avatar_url} fallback={initials(r.profile?.first_name, r.profile?.last_name)} size="sm" />
                <div className="min-w-0">
                  <Link href={`/admin/users?q=${r.profile_id}`} className="block truncate font-medium hover:underline">{fullName(r.profile?.first_name, r.profile?.last_name) || r.profile_id.slice(0, 8)}</Link>
                  <p className="truncate text-xs text-muted-foreground">
                    {r.employer ? `${tEnum("employer_type", r.employer.employer_type)}${r.employer.display_name ? ` · ${r.employer.display_name}` : ""}` : "—"}
                  </p>
                  {r.profile?.is_blocked ? <Badge variant="destructive" size="sm">{t("admin.users.blocked")}</Badge> : null}
                </div>
              </div>
            ),
          },
          {
            key: "company",
            header: t("admin.employers.company"),
            render: (r) =>
              r.companies ? (
                <div className="min-w-0">
                  <Link href={`/company/${r.companies.slug}`} target="_blank" className="inline-flex items-center gap-1 font-medium hover:underline">
                    {r.companies.name} <ExternalLink className="size-3" />
                  </Link>
                  <p className="text-xs text-muted-foreground">{t("admin.employers.tin")}: {r.companies.tin ?? "—"}</p>
                  <StatusBadge status={r.companies.verification_status} label={tEnum("verification_status", r.companies.verification_status)} size="sm" />
                </div>
              ) : (
                <span className="text-muted-foreground">—</span>
              ),
          },
          {
            key: "type",
            header: t("admin.verifications.col_type"),
            render: (r) => (
              <div className="max-w-[240px]">
                <Badge variant="primary" size="sm">{tEnum("verification_type", r.type)}</Badge>
                {r.note ? <p className="mt-1 whitespace-pre-line text-xs text-muted-foreground line-clamp-3" title={r.note}>{r.note}</p> : null}
                {r.review_note ? <p className="mt-1 text-xs"><span className="font-medium">{t("admin.vacancies.note")}:</span> {r.review_note}</p> : null}
              </div>
            ),
          },
          { key: "docs", header: t("admin.verifications.col_documents"), render: (r) => <DocumentLinks paths={r.document_paths} /> },
          {
            key: "created",
            header: t("admin.users.col_created"),
            render: (r) => (
              <div className="text-xs">
                <p title={formatDateTime(r.created_at, locale)}>{formatRelative(r.created_at, locale)}</p>
                {r.reviewer ? <p className="text-muted-foreground">{t("admin.reports.by", { name: fullName(r.reviewer.first_name, r.reviewer.last_name) })} · {r.reviewed_at ? formatRelative(r.reviewed_at, locale) : ""}</p> : null}
              </div>
            ),
          },
          { key: "status", header: t("admin.vacancies.col_status"), render: (r) => <StatusBadge status={r.status} label={tEnum("verification_status", r.status)} size="sm" /> },
          ...(f.tab === "pending"
            ? [{ key: "actions", header: "", align: "right" as const, className: "min-w-[220px]", render: (r: (typeof paged.rows)[number]) => <VerificationActions requestId={r.id} canVerify /> }]
            : []),
        ]}
      />
      <Pagination paged={paged} base={BASE} searchParams={sp} />
    </div>
  );
}
