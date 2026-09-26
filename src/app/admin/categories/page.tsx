import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { getAdminContext } from "@/features/admin/context";
import { listCategoriesWithSubs } from "@/features/admin/queries/reference";
import { CategoryManager } from "@/features/admin/components/category-manager";
import { AdminPageHeader, Forbidden, QueryError } from "@/features/admin/components/notes";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: `${t("admin.nav.categories")} · ${t("admin.shell.title")}` };
}

export default async function AdminCategoriesPage() {
  const ctx = await getAdminContext();
  const { t } = await getT();
  if (!ctx.can("categories.manage")) return <Forbidden perm="categories.manage" />;
  const { rows, error } = await listCategoriesWithSubs();
  return (
    <div>
      <AdminPageHeader title={t("admin.categories.title")} subtitle={t("admin.categories.subtitle", { count: rows.length })} />
      <QueryError message={error} />
      <CategoryManager categories={rows} canManage={ctx.can("categories.manage")} />
    </div>
  );
}
