import type { Metadata } from "next";
import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { formatDateTime, fullName } from "@/lib/format";
import { getAdminContext } from "@/features/admin/context";
import { AUDIT_ACTION_GROUPS, listAuditLogs, parseAuditFilters } from "@/features/admin/queries/audit";
import type { SearchParams } from "@/features/admin/queries/shared";
import { withParam } from "@/features/admin/url";
import { DataTable } from "@/features/admin/components/data-table";
import { Filters, FilterInput, FilterSelect } from "@/features/admin/components/filters";
import { JsonViewer } from "@/features/admin/components/json-viewer";
import { Pagination } from "@/features/admin/components/pagination";
import { AdminPageHeader, Forbidden, QueryError } from "@/features/admin/components/notes";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/misc";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: `${t("admin.nav.audit")} · ${t("admin.shell.title")}` };
}

const BASE = "/admin/audit";

function targetHref(type: string, id: string | null): string | null {
  if (!id) return null;
  switch (type) {
    case "profile":
      return `/admin/users?q=${id}`;
    case "vacancy":
      return `/admin/vacancies?q=${id}`;
    case "review":
      return `/admin/reviews?q=${id}&status=all`;
    default:
      return null;
  }
}

export default async function AdminAuditPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const ctx = await getAdminContext();
  const { t, locale } = await getT();
  if (!ctx.can("audit.view")) return <Forbidden perm="audit.view" />;
  const sp = await searchParams;
  const f = parseAuditFilters(sp);
  const paged = await listAuditLogs(f);
  const hasActive = Boolean(f.action || f.actor || f.from || f.to);

  return (
    <div>
      <AdminPageHeader title={t("admin.audit.title")} subtitle={t("common.labels.results", { count: paged.total })} />
      <Filters action={BASE} hasActive={hasActive}>
        <FilterSelect name="action" defaultValue={f.action} placeholder={t("admin.audit.col_action")} options={AUDIT_ACTION_GROUPS.map((g) => ({ value: g, label: t(`admin.audit.group_${g.replace(".", "")}`) }))} />
        <FilterInput name="actor" defaultValue={f.actor} placeholder={t("admin.audit.actor_id")} className="sm:w-72" />
        <FilterInput name="from" type="date" label={t("admin.audit.from")} defaultValue={f.from} />
        <FilterInput name="to" type="date" label={t("admin.audit.to")} defaultValue={f.to} />
      </Filters>
      <QueryError message={paged.error} />
      <DataTable
        rows={paged.rows}
        rowKey={(r) => String(r.id)}
        empty={<EmptyState title={t("common.empty.nothing_here")} />}
        columns={[
          { key: "at", header: t("admin.audit.col_time"), render: (r) => <span className="whitespace-nowrap text-xs">{formatDateTime(r.created_at, locale)}</span> },
          {
            key: "actor",
            header: t("admin.audit.col_actor"),
            render: (r) =>
              r.actor ? (
                <Link href={withParam(BASE, sp, "actor", r.actor.id)} className="hover:underline" title={r.actor.id}>{fullName(r.actor.first_name, r.actor.last_name) || r.actor.id.slice(0, 8)}</Link>
              ) : (
                <span className="text-muted-foreground">{t("admin.audit.system")}</span>
              ),
          },
          { key: "action", header: t("admin.audit.col_action"), render: (r) => <Badge variant={/block|reject|hidden|dismissed/.test(r.action) ? "destructive" : /active|verified|resolved|approved|unblock/.test(r.action) ? "success" : "primary"} size="sm"><code>{r.action}</code></Badge> },
          {
            key: "target",
            header: t("admin.audit.col_target"),
            render: (r) => {
              const href = targetHref(r.target_type, r.target_id);
              return (
                <div className="text-xs">
                  <span className="text-muted-foreground">{r.target_type}</span>{" "}
                  {href ? <Link href={href} className="text-primary hover:underline">{r.target_id?.slice(0, 8)}</Link> : <code>{r.target_id?.slice(0, 8) ?? "—"}</code>}
                </div>
              );
            },
          },
          { key: "before", header: t("admin.audit.col_before"), className: "max-w-[260px]", render: (r) => <JsonViewer value={r.before_data} label={t("admin.audit.col_before")} /> },
          { key: "after", header: t("admin.audit.col_after"), className: "max-w-[260px]", render: (r) => <JsonViewer value={r.after_data} label={t("admin.audit.col_after")} /> },
        ]}
      />
      <Pagination paged={paged} base={BASE} searchParams={sp} />
    </div>
  );
}
