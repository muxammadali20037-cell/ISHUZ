import type { Metadata } from "next";
import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { getCategories } from "@/lib/reference";
import { getAdminContext } from "@/features/admin/context";
import { getProfessionTrail } from "@/features/professions/queries";
import { CategoryIcon } from "@/components/shared/category-icon";
import { AdminPageHeader, Forbidden, QueryError } from "@/features/admin/components/notes";
import { ProfessionTreeManager, type AdminNode } from "@/features/admin/components/profession-tree-manager";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: `${t("admin.nav.professions")} · ${t("admin.shell.title")}` };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function AdminProfessionsPage({ searchParams }: { searchParams: Promise<{ category?: string; node?: string }> }) {
  const ctx = await getAdminContext();
  const { t, name } = await getT();
  if (!ctx.can("categories.manage")) return <Forbidden perm="categories.manage" />;
  const sp = await searchParams;
  const categories = await getCategories();
  const category = UUID.test(sp.category ?? "") ? categories.find((c) => c.id === sp.category) : undefined;

  if (!category) {
    return (
      <div>
        <AdminPageHeader title={t("admin.professions.title")} subtitle={t("admin.professions.subtitle")} />
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((c) => (
            <Link key={c.id} href={`/admin/professions?category=${c.id}`} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 font-medium hover:border-primary">
              <CategoryIcon name={c.icon} className="size-5 text-primary" />
              {name(c)}
            </Link>
          ))}
        </div>
      </div>
    );
  }

  const nodeId = UUID.test(sp.node ?? "") ? sp.node! : null;
  const supabase = await createClient();
  let q = supabase
    .from("profession_nodes")
    .select("id, parent_id, category_id, name_uz, name_ru, name_en, icon, aliases, selectable, is_popular, is_active, sort_order")
    .order("sort_order")
    .order("name_uz")
    .limit(2000);
  q = nodeId ? q.eq("parent_id", nodeId) : q.is("parent_id", null).eq("category_id", category.id);
  const [{ data: rows, error }, { data: stats }, trail] = await Promise.all([
    q,
    supabase.rpc("admin_profession_node_stats", nodeId ? { p_parent_id: nodeId } : { p_category_id: category.id }),
    getProfessionTrail(nodeId),
  ]);
  const ids = (rows ?? []).map((r) => r.id);
  const { data: kids } = ids.length ? await supabase.from("profession_nodes").select("parent_id").in("parent_id", ids).limit(10000) : { data: [] };
  const childCount = new Map<string, number>();
  for (const k of kids ?? []) if (k.parent_id) childCount.set(k.parent_id, (childCount.get(k.parent_id) ?? 0) + 1);
  const statMap = new Map((stats ?? []).map((s) => [s.id, s]));
  const nodes: AdminNode[] = (rows ?? []).map((r) => ({
    ...r,
    children: childCount.get(r.id) ?? 0,
    vacancies: Number(statMap.get(r.id)?.vacancies ?? 0),
    profiles: Number(statMap.get(r.id)?.profiles ?? 0),
  }));
  const crumbs = [{ id: "", name: name(category) }, ...trail.map((x) => ({ id: x.id, name: name(x) }))];

  return (
    <div>
      <AdminPageHeader title={t("admin.professions.title")} subtitle={t("admin.professions.subtitle")} />
      <QueryError message={error?.message ?? null} />
      <ProfessionTreeManager
        categoryId={category.id}
        parent={trail.length ? { id: trail.at(-1)!.id, name: name(trail.at(-1)!) } : null}
        trail={crumbs}
        nodes={nodes}
        canManage={ctx.can("categories.manage")}
      />
    </div>
  );
}
