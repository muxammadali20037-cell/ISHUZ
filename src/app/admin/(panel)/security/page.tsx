import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { getAdminContext } from "@/features/admin/context";
import { DataTable } from "@/features/admin/components/data-table";
import { AdminPageHeader, Forbidden, QueryError } from "@/features/admin/components/notes";
import { EnforceToggle, LiftRestrictionButton } from "@/features/admin/components/security-actions";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/misc";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: `${t("admin.nav.security")} · ${t("admin.shell.title")}` };
}

interface Overview {
  hours: number;
  enforce: boolean;
  by_type: { event_type: string; severity: string; count: number }[];
  recent: { id: string; created_at: string; event_type: string; severity: string; actor_id: string | null; route: string | null; reason_code: string; action_taken: string; rule_version: string | null }[];
  restrictions: { id: number; scope: string; subject: string; state: string; reason_code: string; rule_version: string; enforced: boolean; created_at: string; expires_at: string }[];
}

const SEVERITY_VARIANT: Record<string, "destructive" | "warning" | "primary" | "default"> = {
  critical: "destructive",
  high: "destructive",
  medium: "warning",
  low: "primary",
  info: "default",
};

/** Xavfsizlik hodisalari va vaqtinchalik cheklovlar (security.view); boshqaruv — security.manage */
export default async function AdminSecurityPage() {
  const ctx = await getAdminContext();
  const { t, locale } = await getT();
  if (!ctx.can("security.view")) return <Forbidden perm="security.view" />;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_security_overview", { p_hours: 24 });
  const o = (data ?? { hours: 24, enforce: false, by_type: [], recent: [], restrictions: [] }) as unknown as Overview;
  const canManage = ctx.can("security.manage");

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={t("admin.security.title")}
        subtitle={t("admin.security.subtitle")}
        actions={canManage ? <EnforceToggle enforce={o.enforce} /> : null}
      />
      <QueryError message={error?.message ?? null} />
      <div className="rounded-2xl border border-border/70 bg-card p-4 text-sm">
        <span className="font-semibold">{t("admin.security.mode")}: </span>
        <Badge variant={o.enforce ? "destructive" : "default"} size="sm">{o.enforce ? t("admin.security.mode_enforce") : t("admin.security.mode_observe")}</Badge>
        <p className="mt-1 text-muted-foreground">{o.enforce ? t("admin.security.enforce_desc") : t("admin.security.observe_desc")}</p>
      </div>

      <section>
        <h2 className="mb-2 text-base font-semibold">{t("admin.security.restrictions")}</h2>
        <DataTable
          rows={o.restrictions}
          rowKey={(r) => String(r.id)}
          empty={<EmptyState title={t("admin.security.no_restrictions")} />}
          columns={[
            { key: "scope", header: t("admin.security.col_scope"), render: (r) => <code className="text-xs">{r.scope}:{r.subject}…</code> },
            { key: "state", header: t("admin.security.col_state"), render: (r) => <Badge variant={r.state === "temporarily_restricted" ? "destructive" : "warning"} size="sm">{t(`admin.security.state_${r.state}`)}</Badge> },
            { key: "reason", header: t("admin.security.col_reason"), render: (r) => <code className="text-xs">{r.reason_code} · {r.rule_version}</code> },
            { key: "enforced", header: t("admin.security.col_enforced"), render: (r) => (r.enforced ? t("admin.security.mode_enforce") : t("admin.security.mode_observe")) },
            { key: "expires", header: t("admin.security.col_expires"), render: (r) => <span className="whitespace-nowrap text-xs">{formatDateTime(r.expires_at, locale)}</span> },
            { key: "act", header: "", render: (r) => (canManage ? <LiftRestrictionButton id={r.id} /> : null) },
          ]}
        />
      </section>

      <section>
        <h2 className="mb-2 text-base font-semibold">{t("admin.security.by_type", { hours: o.hours })}</h2>
        <DataTable
          rows={o.by_type}
          rowKey={(r) => `${r.event_type}:${r.severity}`}
          empty={<EmptyState title={t("admin.security.no_events")} />}
          columns={[
            { key: "type", header: t("admin.security.col_event"), render: (r) => <code className="text-xs">{r.event_type}</code> },
            { key: "sev", header: t("admin.security.col_severity"), render: (r) => <Badge variant={SEVERITY_VARIANT[r.severity] ?? "default"} size="sm">{r.severity}</Badge> },
            { key: "count", header: t("admin.security.col_count"), render: (r) => <span className="tabular">{r.count}</span> },
          ]}
        />
      </section>

      <section>
        <h2 className="mb-2 text-base font-semibold">{t("admin.security.recent")}</h2>
        <DataTable
          rows={o.recent}
          rowKey={(r) => r.id}
          empty={<EmptyState title={t("admin.security.no_events")} />}
          columns={[
            { key: "at", header: t("admin.audit.col_time"), render: (r) => <span className="whitespace-nowrap text-xs">{formatDateTime(r.created_at, locale)}</span> },
            { key: "type", header: t("admin.security.col_event"), render: (r) => <code className="text-xs">{r.event_type}</code> },
            { key: "sev", header: t("admin.security.col_severity"), render: (r) => <Badge variant={SEVERITY_VARIANT[r.severity] ?? "default"} size="sm">{r.severity}</Badge> },
            { key: "reason", header: t("admin.security.col_reason"), render: (r) => <code className="text-xs">{r.reason_code}{r.rule_version ? ` · ${r.rule_version}` : ""}</code> },
            { key: "action", header: t("admin.security.col_action"), render: (r) => <span className="text-xs">{r.action_taken}</span> },
            { key: "route", header: t("admin.security.col_route"), render: (r) => <code className="text-xs text-muted-foreground">{r.route ?? "—"}</code> },
            { key: "actor", header: t("admin.audit.col_actor"), render: (r) => <code className="text-xs">{r.actor_id ? r.actor_id.slice(0, 8) : "—"}</code> },
          ]}
        />
      </section>
    </div>
  );
}
