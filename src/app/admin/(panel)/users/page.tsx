import type { Metadata } from "next";
import Link from "next/link";
import { Eye, ExternalLink, Send } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { formatDate, formatDateTime, formatPhone, formatRelative, fullName, initials } from "@/lib/format";
import { getAdminContext } from "@/features/admin/context";
import { getUserDetail, listUsers, parseUserFilters } from "@/features/admin/queries/users";
import { param, type SearchParams } from "@/features/admin/queries/shared";
import { closeHref, viewHref } from "@/features/admin/url";
import { DataTable } from "@/features/admin/components/data-table";
import { Filters, FilterSearch, FilterSelect } from "@/features/admin/components/filters";
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
  return { title: `${t("admin.nav.users")} · ${t("admin.shell.title")}` };
}

const BASE = "/admin/users";

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const ctx = await getAdminContext();
  const { t, tEnum, locale, name } = await getT();
  if (!ctx.can("users.view")) return <Forbidden perm="users.view" />;
  const sp = await searchParams;
  const f = parseUserFilters(sp);
  const canContacts = ctx.can("users.contacts");
  const canBlock = ctx.can("users.block");
  const view = param(sp, "view");
  const [paged, detail] = await Promise.all([listUsers(f), view ? getUserDetail(view) : Promise.resolve(null)]);
  const hasActive = Boolean(f.q || f.role || f.blocked);

  return (
    <div>
      <AdminPageHeader title={t("admin.users.title")} subtitle={t("common.labels.results", { count: paged.total })} />
      <Filters action={BASE} hasActive={hasActive}>
        <FilterSearch name="q" defaultValue={f.q} placeholder={t("admin.users.search_placeholder")} />
        <FilterSelect
          name="role"
          defaultValue={f.role}
          placeholder={t("admin.users.filter_role")}
          options={[
            { value: "worker", label: t("common.role.worker") },
            { value: "employer", label: t("common.role.employer") },
          ]}
        />
        <FilterSelect
          name="blocked"
          defaultValue={f.blocked}
          placeholder={t("admin.users.filter_blocked")}
          options={[
            { value: "yes", label: t("admin.users.blocked_only") },
            { value: "no", label: t("admin.users.active_only") },
          ]}
        />
      </Filters>
      <QueryError message={paged.error} />
      <DataTable
        rows={paged.rows}
        rowKey={(r) => r.id}
        rowMuted={(r) => r.is_blocked}
        empty={<EmptyState title={t("common.empty.no_results_title")} description={t("common.empty.no_results_desc")} />}
        columns={[
          {
            key: "name",
            header: t("admin.users.col_user"),
            render: (r) => (
              <div className="flex items-center gap-2.5">
                <Avatar src={r.avatar_url} fallback={initials(r.first_name, r.last_name)} size="sm" />
                <div className="min-w-0">
                  <p className="truncate font-medium">{fullName(r.first_name, r.last_name) || t("common.labels.not_specified")}</p>
                  <p className="truncate text-xs text-muted-foreground">{r.id.slice(0, 8)}</p>
                </div>
              </div>
            ),
          },
          {
            key: "roles",
            header: t("admin.users.col_roles"),
            render: (r) => (
              <div className="flex flex-wrap gap-1">
                {r.roles.length ? r.roles.map((role) => <Badge key={role} variant={role === "employer" ? "primary" : "default"} size="sm">{t(`common.role.${role}`)}</Badge>) : <span className="text-xs text-muted-foreground">—</span>}
              </div>
            ),
          },
          ...(canContacts
            ? [
                {
                  key: "phone",
                  header: t("common.labels.phone"),
                  render: (r: (typeof paged.rows)[number]) => (
                    <span className="tabular">{r.phone ? formatPhone(r.phone) : <span className="text-muted-foreground">—</span>}</span>
                  ),
                },
              ]
            : []),
          { key: "created", header: t("admin.users.col_created"), render: (r) => <span title={formatDateTime(r.created_at, locale)}>{formatDate(r.created_at, locale, "d MMM yyyy")}</span> },
          { key: "seen", header: t("admin.users.col_last_seen"), render: (r) => (r.last_seen_at ? <span title={formatDateTime(r.last_seen_at, locale)}>{formatRelative(r.last_seen_at, locale)}</span> : <span className="text-muted-foreground">—</span>) },
          {
            key: "blocked",
            header: t("admin.users.col_status"),
            render: (r) => (r.is_blocked ? <Badge variant="destructive" size="sm" title={r.blocked_reason ?? undefined}>{t("admin.users.blocked")}</Badge> : <Badge variant="success" size="sm">{t("admin.users.active")}</Badge>),
          },
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
                <UserBlockButton profileId={r.id} isBlocked={r.is_blocked} name={fullName(r.first_name, r.last_name)} canBlock={canBlock && r.id !== ctx.session.userId} />
              </div>
            ),
          },
        ]}
      />
      <Pagination paged={paged} base={BASE} searchParams={sp} />

      {view ? (
        <UrlSheet
          title={detail ? fullName(detail.first_name, detail.last_name) || t("common.labels.not_specified") : t("common.errors.not_found")}
          description={detail ? detail.id : undefined}
          closeHref={closeHref(BASE, sp)}
          footer={detail ? <UserBlockButton profileId={detail.id} isBlocked={detail.is_blocked} name={fullName(detail.first_name, detail.last_name)} canBlock={canBlock && detail.id !== ctx.session.userId} size="default" fullWidth /> : undefined}
        >
          {detail ? (
            <>
              <div className="flex items-center gap-3">
                <Avatar src={detail.avatar_url} fallback={initials(detail.first_name, detail.last_name)} size="lg" />
                <div className="min-w-0">
                  <div className="flex flex-wrap gap-1">
                    {detail.roles.map((role) => (
                      <Badge key={role} variant="primary" size="sm">
                        {t(`common.role.${role}`)}
                      </Badge>
                    ))}
                    {detail.admin ? <Badge variant="solid" size="sm">{tEnum("admin_role", detail.admin.role)}</Badge> : null}
                    {detail.is_blocked ? <Badge variant="destructive" size="sm">{t("admin.users.blocked")}</Badge> : null}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{t("admin.users.registered_at", { date: formatDateTime(detail.created_at, locale) })}</p>
                </div>
              </div>
              {detail.is_blocked ? (
                <div className="mt-3 rounded-xl bg-destructive-soft p-3 text-sm text-destructive">
                  <p className="font-medium">{t("admin.users.block_reason")}: {detail.blocked_reason || "—"}</p>
                  {detail.blocked_at ? <p className="text-xs opacity-80">{formatDateTime(detail.blocked_at, locale)}</p> : null}
                </div>
              ) : null}
              <DetailSection title={t("common.contact_title")}>
                {canContacts ? (
                  <>
                    <DetailRow label={t("common.labels.phone")}>
                      {detail.phone ? (
                        <a href={`tel:${detail.phone}`} className="tabular text-primary hover:underline">{formatPhone(detail.phone)}</a>
                      ) : "—"}
                      {detail.phone_verified_at ? <Badge variant="success" size="sm" className="ml-1.5">{t("common.labels.verified")}</Badge> : null}
                    </DetailRow>
                    <DetailRow label="Email">{detail.email ?? "—"}</DetailRow>
                    <DetailRow label={t("admin.users.phone_visibility")}>{detail.phone_visibility ? tEnum("phone_visibility", detail.phone_visibility) : "—"}</DetailRow>
                  </>
                ) : (
                  <DetailRow label={t("common.labels.phone")}>
                    <span className="text-muted-foreground">{t("admin.users.contacts_hidden")}</span>
                  </DetailRow>
                )}
                <DetailRow label="Telegram">
                  {detail.telegram?.username || detail.telegram_username ? (
                    <a href={`https://t.me/${(detail.telegram?.username ?? detail.telegram_username ?? "").replace(/^@/, "")}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                      <Send className="size-3.5" />@{(detail.telegram?.username ?? detail.telegram_username ?? "").replace(/^@/, "")}
                    </a>
                  ) : detail.telegram ? (
                    <span>ID {detail.telegram.telegram_user_id}</span>
                  ) : (
                    "—"
                  )}
                  {detail.telegram ? <Badge variant={detail.telegram.bot_started ? "success" : "default"} size="sm" className="ml-1.5">{detail.telegram.bot_started ? t("admin.users.bot_started") : t("admin.users.bot_not_started")}</Badge> : null}
                </DetailRow>
              </DetailSection>
              <DetailSection title={t("admin.users.section_profile")}>
                <DetailRow label={t("admin.users.locale")}>{detail.locale.toUpperCase()}</DetailRow>
                <DetailRow label={t("admin.users.gender")}>{detail.gender ? tEnum("gender", detail.gender) : "—"}</DetailRow>
                <DetailRow label={t("admin.users.birth_date")}>{detail.birth_date ? formatDate(detail.birth_date, locale) : "—"}</DetailRow>
                <DetailRow label={t("admin.users.col_last_seen")}>{detail.last_seen_at ? formatDateTime(detail.last_seen_at, locale) : "—"}</DetailRow>
                <DetailRow label={t("admin.users.reports_against")}>{detail.counts.reports_against}</DetailRow>
              </DetailSection>
              {detail.worker ? (
                <DetailSection title={t("common.role.worker")}>
                  <DetailRow label={t("admin.workers.headline")}>{detail.worker.headline ?? "—"}</DetailRow>
                  <DetailRow label={t("admin.workers.col_status")}><StatusBadge status={detail.worker.status} label={tEnum("worker_status_short", detail.worker.status)} size="sm" /></DetailRow>
                  <DetailRow label={t("admin.workers.category")}>{name(detail.worker.category) || "—"}</DetailRow>
                  <DetailRow label={t("admin.workers.region")}>{name(detail.worker.region) || "—"}</DetailRow>
                  <DetailRow label={t("admin.workers.col_completeness")}>
                    <span className="flex items-center gap-2"><Progress value={detail.worker.completeness} className="w-24" /> {detail.worker.completeness}%</span>
                  </DetailRow>
                  <DetailRow label={t("admin.workers.onboarded")}><BoolBadge value={!!detail.worker.onboarding_completed_at} yes={t("common.labels.yes")} no={t("common.labels.no")} /></DetailRow>
                  <DetailRow label={t("admin.users.applications")}>{detail.counts.applications}</DetailRow>
                  <DetailRow label="">
                    <Link href={`/workers/${detail.worker.id}`} className="inline-flex items-center gap-1 text-primary hover:underline" target="_blank">
                      <ExternalLink className="size-3.5" /> {t("admin.workers.open_public")}
                    </Link>
                  </DetailRow>
                </DetailSection>
              ) : null}
              {detail.employer ? (
                <DetailSection title={t("common.role.employer")}>
                  <DetailRow label={t("admin.employers.col_type")}>{tEnum("employer_type", detail.employer.employer_type)}</DetailRow>
                  <DetailRow label={t("admin.employers.display_name")}>{detail.employer.display_name ?? "—"}</DetailRow>
                  <DetailRow label={t("admin.employers.col_verification")}><StatusBadge status={detail.employer.verification_status} label={tEnum("verification_status", detail.employer.verification_status)} size="sm" /></DetailRow>
                  <DetailRow label={t("admin.employers.company")}>
                    {detail.employer.company ? (
                      <Link href={`/company/${detail.employer.company.slug}`} className="text-primary hover:underline" target="_blank">{detail.employer.company.name}</Link>
                    ) : "—"}
                  </DetailRow>
                  <DetailRow label={t("admin.users.vacancies")}>
                    <Link href={`/admin/vacancies?q=${detail.id}`} className="text-primary hover:underline">{detail.counts.vacancies}</Link>
                  </DetailRow>
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
