import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { formatDateTime, fullName } from "@/lib/format";
import { getAdminContext } from "@/features/admin/context";
import { countRecipients } from "@/features/admin/queries/users";
import { listBroadcasts } from "@/features/admin/queries/audit";
import { DataTable } from "@/features/admin/components/data-table";
import { AdminPageHeader, Forbidden, QueryError } from "@/features/admin/components/notes";
import { BroadcastForm } from "@/features/admin/components/broadcast-form";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/misc";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: `${t("admin.nav.notifications")} · ${t("admin.shell.title")}` };
}

export default async function AdminNotificationsPage() {
  const ctx = await getAdminContext();
  const { t, locale } = await getT();
  if (!ctx.can("notifications.broadcast")) return <Forbidden perm="notifications.broadcast" />;
  const [all, worker, employer, broadcasts] = await Promise.all([countRecipients(null), countRecipients("worker"), countRecipients("employer"), listBroadcasts(30)]);

  return (
    <div>
      <AdminPageHeader title={t("admin.notifications.title")} subtitle={t("admin.notifications.subtitle")} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,520px)_1fr]">
        <BroadcastForm recipients={{ all, worker, employer }} />
        <section>
          <h2 className="mb-3 text-base font-semibold">{t("admin.notifications.recent")}</h2>
          {ctx.can("audit.view") ? (
            <>
              <QueryError message={broadcasts.error} />
              <DataTable
                rows={broadcasts.rows}
                rowKey={(r) => String(r.id)}
                empty={<EmptyState title={t("common.empty.nothing_here")} />}
                columns={[
                  { key: "title", header: t("admin.notifications.field_title"), render: (r) => <span className="font-medium">{r.title || "—"}</span> },
                  { key: "role", header: t("admin.notifications.field_role"), render: (r) => <Badge size="sm">{r.role ? t(`common.role.${r.role}`) : t("admin.notifications.role_all")}</Badge> },
                  { key: "count", header: t("admin.notifications.col_recipients"), align: "right", render: (r) => r.count.toLocaleString("ru-RU") },
                  { key: "actor", header: t("admin.audit.col_actor"), render: (r) => (r.actor ? fullName(r.actor.first_name, r.actor.last_name) : "—") },
                  { key: "at", header: t("admin.users.col_created"), render: (r) => formatDateTime(r.created_at, locale) },
                ]}
              />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{t("admin.notifications.history_needs_audit")}</p>
          )}
        </section>
      </div>
    </div>
  );
}
