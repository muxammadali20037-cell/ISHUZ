import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { formatDate, fullName } from "@/lib/format";
import { getAdminContext } from "@/features/admin/context";
import { categoryOptions, listSkills, parseSkillFilters } from "@/features/admin/queries/reference";
import type { SearchParams } from "@/features/admin/queries/shared";
import { DataTable } from "@/features/admin/components/data-table";
import { Filters, FilterSearch, FilterSelect } from "@/features/admin/components/filters";
import { LinkTabs } from "@/features/admin/components/link-tabs";
import { Pagination } from "@/features/admin/components/pagination";
import { AdminPageHeader, Forbidden, QueryError, UnauditedNote } from "@/features/admin/components/notes";
import { SkillActions } from "@/features/admin/components/skill-actions";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/misc";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: `${t("admin.nav.skills")} · ${t("admin.shell.title")}` };
}

const BASE = "/admin/skills";

export default async function AdminSkillsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const ctx = await getAdminContext();
  const { t, name, locale } = await getT();
  if (!ctx.can("skills.manage")) return <Forbidden perm="skills.manage" />;
  const sp = await searchParams;
  const f = parseSkillFilters(sp);
  const [paged, categories] = await Promise.all([listSkills(f), categoryOptions()]);
  const hasActive = Boolean(f.q || f.custom || f.approved || f.category);

  return (
    <div>
      <AdminPageHeader title={t("admin.skills.title")} subtitle={t("common.labels.results", { count: paged.total })} actions={<UnauditedNote />} />
      <LinkTabs
        tabs={[
          { href: BASE, label: t("admin.vacancies.all"), active: !f.approved && !f.custom },
          { href: `${BASE}?approved=no`, label: t("admin.skills.pending"), count: paged.pendingCount, active: f.approved === "no" },
          { href: `${BASE}?custom=yes`, label: t("admin.skills.custom"), active: f.custom === "yes" && !f.approved },
        ]}
      />
      <Filters action={BASE} hasActive={hasActive}>
        <FilterSearch name="q" defaultValue={f.q} placeholder={t("admin.skills.search_placeholder")} />
        <FilterSelect name="category" defaultValue={f.category} placeholder={t("admin.workers.category")} options={categories.map((c) => ({ value: c.id, label: name(c) }))} />
        <FilterSelect name="custom" defaultValue={f.custom} placeholder={t("admin.skills.col_custom")} options={[{ value: "yes", label: t("common.labels.yes") }, { value: "no", label: t("common.labels.no") }]} className="sm:w-36" />
        <FilterSelect name="approved" defaultValue={f.approved} placeholder={t("admin.skills.col_approved")} options={[{ value: "yes", label: t("common.labels.yes") }, { value: "no", label: t("common.labels.no") }]} className="sm:w-36" />
      </Filters>
      <QueryError message={paged.error} />
      <DataTable
        rows={paged.rows}
        rowKey={(r) => r.id}
        rowMuted={(r) => !r.is_approved}
        empty={<EmptyState title={t("common.empty.no_results_title")} />}
        columns={[
          {
            key: "name",
            header: t("admin.skills.col_name"),
            render: (r) => (
              <div>
                <p className="font-medium">{r.name_uz}</p>
                <p className="text-xs text-muted-foreground">{r.name_ru} · <code>{r.slug}</code></p>
              </div>
            ),
          },
          { key: "category", header: t("admin.workers.category"), render: (r) => name(r.categories) || <span className="text-muted-foreground">—</span> },
          { key: "usage", header: t("admin.skills.col_usage"), align: "right", render: (r) => r.usage_count },
          {
            key: "flags",
            header: t("admin.vacancies.col_status"),
            render: (r) => (
              <div className="flex flex-wrap gap-1">
                {r.is_approved ? <Badge variant="success" size="sm">{t("admin.skills.approved")}</Badge> : <Badge variant="warning" size="sm">{t("admin.skills.pending")}</Badge>}
                {r.is_custom ? <Badge variant="outline" size="sm">{t("admin.skills.custom")}</Badge> : null}
              </div>
            ),
          },
          {
            key: "created",
            header: t("admin.users.col_created"),
            render: (r) => (
              <div className="text-xs">
                <p>{formatDate(r.created_at, locale, "d MMM yyyy")}</p>
                {r.profiles ? <p className="text-muted-foreground">{fullName(r.profiles.first_name, r.profiles.last_name)}</p> : null}
              </div>
            ),
          },
          { key: "actions", header: "", align: "right", className: "min-w-[220px]", render: (r) => <SkillActions skill={r} categories={categories} canManage={ctx.can("skills.manage")} /> },
        ]}
      />
      <Pagination paged={paged} base={BASE} searchParams={sp} />
    </div>
  );
}
