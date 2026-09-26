import type { Metadata } from "next";
import Link from "next/link";
import { Eye, ExternalLink } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { formatDate, formatDateTime, formatMoney, formatRelative, fullName, initials } from "@/lib/format";
import { getAdminContext } from "@/features/admin/context";
import { getWorkerDetail, listWorkers, parseWorkerFilters } from "@/features/admin/queries/workers";
import { categoryOptions, regionOptions } from "@/features/admin/queries/reference";
import { param, type SearchParams } from "@/features/admin/queries/shared";
import { closeHref, viewHref } from "@/features/admin/url";
import { DataTable } from "@/features/admin/components/data-table";
import { Filters, FilterInput, FilterSearch, FilterSelect } from "@/features/admin/components/filters";
import { Pagination } from "@/features/admin/components/pagination";
import { AdminPageHeader, Forbidden, QueryError } from "@/features/admin/components/notes";
import { StatusBadge, BoolBadge } from "@/features/admin/components/status-badge";
import { UrlSheet } from "@/features/admin/components/url-sheet";
import { DetailRow, DetailSection } from "@/features/admin/components/detail-sheet";
import { UserBlockButton } from "@/features/admin/components/user-actions";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui/misc";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: `${t("admin.nav.workers")} · ${t("admin.shell.title")}` };
}

const BASE = "/admin/workers";

export default async function AdminWorkersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const ctx = await getAdminContext();
  const { t, tEnum, locale, name } = await getT();
  if (!ctx.can("workers.view")) return <Forbidden perm="workers.view" />;
  const sp = await searchParams;
  const f = parseWorkerFilters(sp);
  const view = param(sp, "view");
  const [paged, categories, regions, detail] = await Promise.all([listWorkers(f), categoryOptions(), regionOptions(), view ? getWorkerDetail(view) : Promise.resolve(null)]);
  const hasActive = Boolean(f.q || f.status || f.category || f.region || f.cmin !== undefined || f.cmax !== undefined);
  const canBlock = ctx.can("users.block");

  return (
    <div>
      <AdminPageHeader title={t("admin.workers.title")} subtitle={t("common.labels.results", { count: paged.total })} />
      <Filters action={BASE} hasActive={hasActive}>
        <FilterSearch name="q" defaultValue={f.q} placeholder={t("admin.workers.search_placeholder")} />
        <FilterSelect
          name="status"
          defaultValue={f.status}
          placeholder={t("admin.workers.col_status")}
          options={(["active", "open", "not_looking"] as const).map((s) => ({ value: s, label: tEnum("worker_status_short", s) }))}
        />
        <FilterSelect name="category" defaultValue={f.category} placeholder={t("admin.workers.category")} options={categories.map((c) => ({ value: c.id, label: name(c) }))} />
        <FilterSelect name="region" defaultValue={f.region} placeholder={t("admin.workers.region")} options={regions.map((r) => ({ value: r.id, label: name(r) }))} />
        <FilterInput name="cmin" type="number" min={0} max={100} defaultValue={f.cmin?.toString()} placeholder={t("admin.workers.completeness_min")} className="sm:w-28" />
        <FilterInput name="cmax" type="number" min={0} max={100} defaultValue={f.cmax?.toString()} placeholder={t("admin.workers.completeness_max")} className="sm:w-28" />
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
                  <p className="truncate text-xs text-muted-foreground">{r.headline ?? "—"}</p>
                </div>
              </div>
            ),
          },
          { key: "category", header: t("admin.workers.category"), render: (r) => name(r.categories) || <span className="text-muted-foreground">—</span> },
          { key: "region", header: t("admin.workers.region"), render: (r) => name(r.regions) || <span className="text-muted-foreground">—</span> },
          { key: "status", header: t("admin.workers.col_status"), render: (r) => <StatusBadge status={r.status} label={tEnum("worker_status_short", r.status)} size="sm" /> },
          {
            key: "completeness",
            header: t("admin.workers.col_completeness"),
            render: (r) => (
              <span className="flex items-center gap-2">
                <Progress value={r.completeness} className="w-16" tone={r.completeness >= 70 ? "success" : r.completeness >= 40 ? "primary" : "warning"} />
                <span className="tabular text-xs">{r.completeness}%</span>
              </span>
            ),
          },
          {
            key: "flags",
            header: t("admin.workers.col_flags"),
            render: (r) => (
              <div className="flex flex-wrap gap-1">
                {!r.onboarding_completed_at ? <Badge variant="warning" size="sm">{t("admin.workers.not_onboarded")}</Badge> : null}
                {!r.is_public ? <Badge size="sm">{t("admin.workers.hidden")}</Badge> : null}
                {r.profiles.is_blocked ? <Badge variant="destructive" size="sm">{t("admin.users.blocked")}</Badge> : null}
              </div>
            ),
          },
          { key: "active", header: t("admin.workers.col_last_active"), render: (r) => <span title={formatDateTime(r.last_active_at, locale)}>{formatRelative(r.last_active_at, locale)}</span> },
          {
            key: "actions",
            header: "",
            align: "right",
            render: (r) => (
              <div className="flex items-center justify-end gap-1.5">
                <Button asChild variant="ghost" size="sm">
                  <Link href={viewHref(BASE, sp, r.id)} scroll={false}>
                    <Eye className="size-4" />
                    {t("common.actions.view")}
                  </Link>
                </Button>
                <Button asChild variant="ghost" size="icon-sm" aria-label={t("admin.workers.open_public")}>
                  <Link href={`/workers/${r.id}`} target="_blank">
                    <ExternalLink className="size-4" />
                  </Link>
                </Button>
              </div>
            ),
          },
        ]}
      />
      <Pagination paged={paged} base={BASE} searchParams={sp} />

      {view ? (
        <UrlSheet
          title={detail ? fullName(detail.profiles.first_name, detail.profiles.last_name) || t("common.labels.not_specified") : t("common.errors.not_found")}
          description={detail?.headline ?? undefined}
          closeHref={closeHref(BASE, sp)}
          footer={
            detail ? (
              <div className="flex gap-2">
                <Button asChild variant="outline" className="flex-1">
                  <Link href={`/workers/${detail.id}`} target="_blank">
                    <ExternalLink className="size-4" /> {t("admin.workers.open_public")}
                  </Link>
                </Button>
                <UserBlockButton profileId={detail.profile_id} isBlocked={detail.profiles.is_blocked} name={fullName(detail.profiles.first_name, detail.profiles.last_name)} canBlock={canBlock} size="default" />
              </div>
            ) : undefined
          }
        >
          {detail ? (
            <>
              <DetailSection title={t("admin.users.section_profile")}>
                <DetailRow label={t("admin.workers.col_status")}><StatusBadge status={detail.status} label={tEnum("worker_status_short", detail.status)} size="sm" /></DetailRow>
                <DetailRow label={t("admin.workers.category")}>{[name(detail.categories), name(detail.subcategories)].filter(Boolean).join(" · ") || "—"}</DetailRow>
                <DetailRow label={t("admin.workers.region")}>{[name(detail.regions), name(detail.districts)].filter(Boolean).join(", ") || "—"}{detail.area_hint ? ` (${detail.area_hint})` : ""}</DetailRow>
                <DetailRow label={t("admin.workers.experience")}>{tEnum("experience_level", detail.experience_level)}</DetailRow>
                <DetailRow label={t("admin.workers.work_format")}>{tEnum("work_format", detail.work_format)} · {t("admin.workers.remote")}: {tEnum("remote_preference", detail.remote_preference)}</DetailRow>
                <DetailRow label={t("admin.workers.col_completeness")}><span className="flex items-center gap-2"><Progress value={detail.completeness} className="w-24" /> {detail.completeness}%</span></DetailRow>
                <DetailRow label={t("admin.workers.is_public")}><BoolBadge value={detail.is_public} yes={t("common.labels.yes")} no={t("common.labels.no")} /></DetailRow>
                <DetailRow label={t("admin.workers.onboarded")}><BoolBadge value={!!detail.onboarding_completed_at} yes={t("common.labels.yes")} no={t("common.labels.no")} /></DetailRow>
                <DetailRow label={t("common.labels.views", { count: detail.views_count })}>{formatDate(detail.created_at, locale)}</DetailRow>
                <DetailRow label="ID"><code className="text-xs">{detail.id}</code></DetailRow>
              </DetailSection>
              {detail.about ? <p className="mt-3 whitespace-pre-line rounded-xl bg-secondary/60 p-3 text-sm">{detail.about}</p> : null}
              <DetailSection title={t("admin.workers.skills")}>
                <div className="flex flex-wrap gap-1.5 py-2">
                  {detail.worker_skills.length ? detail.worker_skills.map((s, i) => (
                    <Badge key={i} variant="outline">{name(s.skills)} · {tEnum("skill_level", s.level)}</Badge>
                  )) : <span className="text-sm text-muted-foreground">—</span>}
                </div>
              </DetailSection>
              <DetailSection title={t("admin.workers.languages")}>
                <div className="flex flex-wrap gap-1.5 py-2">
                  {detail.worker_languages.length ? detail.worker_languages.map((l, i) => (
                    <Badge key={i} variant="outline">{name(l.languages)} · {tEnum("language_level", l.level)}</Badge>
                  )) : <span className="text-sm text-muted-foreground">—</span>}
                </div>
              </DetailSection>
              {detail.worker_preferences ? (
                <DetailSection title={t("admin.workers.preferences")}>
                  <DetailRow label={t("admin.workers.salary")}>
                    {detail.worker_preferences.salary_expected ? formatMoney(detail.worker_preferences.salary_expected, locale) : detail.worker_preferences.salary_min ? `${t("common.labels.from")} ${formatMoney(detail.worker_preferences.salary_min, locale)}` : t("common.labels.negotiable")}
                    {" "}{tEnum("salary_type_suffix", detail.worker_preferences.salary_type)}
                  </DetailRow>
                  <DetailRow label={t("admin.workers.employment")}>{detail.worker_preferences.employment_types.map((e) => tEnum("employment_type", e)).join(", ") || "—"}</DetailRow>
                  <DetailRow label={t("admin.workers.schedule")}>{detail.worker_preferences.schedules.map((s) => tEnum("work_schedule", s)).join(", ") || "—"}</DetailRow>
                  <DetailRow label={t("admin.workers.availability")}>{tEnum("availability", detail.worker_preferences.availability)}</DetailRow>
                </DetailSection>
              ) : null}
              {detail.worker_experience.length ? (
                <DetailSection title={t("admin.workers.experience")}>
                  {detail.worker_experience.map((e, i) => (
                    <div key={i} className="py-2 text-sm">
                      <p className="font-medium">{e.position} — {e.company_name}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(e.started_on, locale, "MMM yyyy")} – {e.is_current ? t("admin.workers.current") : e.ended_on ? formatDate(e.ended_on, locale, "MMM yyyy") : "—"}</p>
                    </div>
                  ))}
                </DetailSection>
              ) : null}
              {detail.worker_education.length ? (
                <DetailSection title={t("admin.workers.education")}>
                  {detail.worker_education.map((e, i) => (
                    <div key={i} className="py-2 text-sm">
                      <p className="font-medium">{tEnum("education_level", e.level)}</p>
                      <p className="text-xs text-muted-foreground">{[e.institution, e.field].filter(Boolean).join(" · ") || "—"}</p>
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
