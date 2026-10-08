import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { getAdminContext } from "@/features/admin/context";
import { listAdminUsers, listSettings } from "@/features/admin/queries/settings";
import { SettingsEditor } from "@/features/admin/components/settings-editor";
import { AdminsManager } from "@/features/admin/components/admins-manager";
import { AdminPageHeader, QueryError } from "@/features/admin/components/notes";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/misc";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: `${t("admin.nav.settings")} · ${t("admin.shell.title")}` };
}

export default async function AdminSettingsPage() {
  const ctx = await getAdminContext();
  const { t, tEnum } = await getT();
  const canSettings = ctx.can("settings.manage");
  const canAdmins = ctx.can("admins.manage");
  const [settings, admins] = await Promise.all([listSettings(), listAdminUsers()]);

  return (
    <div>
      <AdminPageHeader title={t("admin.settings.title")} subtitle={t("admin.settings.subtitle")} />
      <section id="settings">
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-base font-semibold">{t("admin.settings.app_settings")}</h2>
          {!canSettings ? <Badge size="sm">{t("admin.settings.read_only")}</Badge> : null}
        </div>
        <QueryError message={settings.error} />
        {settings.rows.length ? <SettingsEditor settings={settings.rows} canManage={canSettings} /> : <EmptyState title={t("common.empty.nothing_here")} />}
      </section>
      <section id="admins" className="mt-8 scroll-mt-20">
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-base font-semibold">{t("admin.admins.title")}</h2>
          <Badge variant="primary" size="sm">{t("admin.admins.your_role", { role: tEnum("admin_role", ctx.role) })}</Badge>
          {!canAdmins ? <Badge size="sm">{t("admin.settings.read_only")}</Badge> : null}
        </div>
        <p className="mb-3 text-sm text-muted-foreground">{t("admin.admins.subtitle")}</p>
        <QueryError message={admins.error} />
        <AdminsManager admins={admins.rows} canManage={canAdmins} selfId={ctx.session.userId} />
      </section>
    </div>
  );
}
