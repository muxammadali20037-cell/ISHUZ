import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { getAdminContext } from "@/features/admin/context";
import { listRegionsWithDistricts } from "@/features/admin/queries/reference";
import { RegionManager } from "@/features/admin/components/region-manager";
import { AdminPageHeader, Forbidden, QueryError, UnauditedNote } from "@/features/admin/components/notes";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: `${t("admin.nav.regions")} · ${t("admin.shell.title")}` };
}

export default async function AdminRegionsPage() {
  const ctx = await getAdminContext();
  const { t } = await getT();
  if (!ctx.can("regions.manage")) return <Forbidden perm="regions.manage" />;
  const { rows, error } = await listRegionsWithDistricts();
  const districts = rows.reduce((n, r) => n + r.districts.length, 0);
  return (
    <div>
      <AdminPageHeader title={t("admin.regions.title")} subtitle={t("admin.regions.subtitle", { regions: rows.length, districts })} actions={<UnauditedNote />} />
      <QueryError message={error} />
      <RegionManager regions={rows} canManage={ctx.can("regions.manage")} />
    </div>
  );
}
