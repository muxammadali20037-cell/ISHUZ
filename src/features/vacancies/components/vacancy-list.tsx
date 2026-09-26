"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, MoreVertical, Eye, Users, ExternalLink, Settings2, Pencil, Play, Pause, XCircle, Copy, Trash2, Briefcase, CalendarDays, Wifi, Lock } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { ConfirmDialog } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SalaryText } from "@/components/shared/salary-text";
import { STATUS_FILTERS, canClose, canDelete, canPause, canPublish, filterMatches, isEditable, isPublic, publishLabelKey, type StatusFilter } from "../status";
import type { VacancyListItem } from "../types";
import { VacancyStatusBadge } from "./status-badge";
import { useVacancyActions } from "./use-vacancy-actions";

type Confirm = { kind: "delete" | "close" | "pause"; item: VacancyListItem } | null;

export function VacancyList({ items, filter }: { items: VacancyListItem[]; filter: StatusFilter }) {
  const { t } = useT();
  const actions = useVacancyActions();
  const [confirm, setConfirm] = useState<Confirm>(null);

  const counts = useMemo(() => {
    const c: Record<StatusFilter, number> = { all: 0, active: 0, draft: 0, pending_review: 0, paused: 0, closed: 0, expired: 0, hidden: 0 };
    for (const v of items) for (const f of STATUS_FILTERS) if (filterMatches(f, v.status)) c[f] += 1;
    return c;
  }, [items]);
  const visible = items.filter((v) => filterMatches(filter, v.status));

  const onConfirm = () => {
    if (!confirm) return;
    const done = () => setConfirm(null);
    if (confirm.kind === "delete") actions.remove(confirm.item.id, done);
    else if (confirm.kind === "close") actions.close(confirm.item.id, done);
    else actions.pause(confirm.item.id, done);
  };

  return (
    <div>
      <PageHeader
        title={t("vacancies.list.title")}
        subtitle={t("vacancies.list.subtitle", { count: items.length })}
        actions={
          <Button asChild>
            <Link href="/employer/vacancies/new">
              <Plus className="size-4" />
              <span className="hidden sm:inline">{t("vacancies.list.new")}</span>
              <span className="sm:hidden">{t("common.nav.post")}</span>
            </Link>
          </Button>
        }
      />

      {items.length ? (
        <nav className="-mx-4 mb-4 overflow-x-auto px-4 scrollbar-none sm:mx-0 sm:px-0" aria-label={t("common.actions.filter")}>
          <div className="flex w-max gap-1 rounded-xl bg-secondary p-1">
            {STATUS_FILTERS.map((f) => {
              const active = f === filter;
              if (f !== "all" && counts[f] === 0 && !active) return null;
              return (
                <Link
                  key={f}
                  href={f === "all" ? "/employer/vacancies" : `/employer/vacancies?status=${f}`}
                  scroll={false}
                  className={cn(
                    "flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-sm font-medium transition-colors",
                    active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  {t(`vacancies.list.tabs.${f}`)}
                  <span className={cn("tabular rounded-md px-1.5 text-xs", active ? "bg-primary-soft text-primary" : "bg-card/60")}>{counts[f]}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      ) : null}

      {!items.length ? (
        <EmptyState icon={Briefcase} title={t("vacancies.list.empty_title")} description={t("vacancies.list.empty_desc")} action={{ label: t("vacancies.list.empty_cta"), href: "/employer/vacancies/new" }} />
      ) : !visible.length ? (
        <EmptyState icon={Briefcase} title={t("vacancies.list.empty_filtered_title")} description={t("vacancies.list.empty_filtered_desc")} action={{ label: t("vacancies.list.tabs.all"), href: "/employer/vacancies" }} />
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {visible.map((v) => (
            <li key={v.id}>
              <VacancyRow item={v} busy={actions.busyId === v.id} onPublish={() => actions.publish(v.id)} onDuplicate={() => actions.duplicate(v.id)} onConfirm={(kind) => setConfirm({ kind, item: v })} />
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={confirm ? t(`vacancies.confirm.${confirm.kind}_title`) : ""}
        description={confirm ? t(`vacancies.confirm.${confirm.kind}_desc`, { title: confirm.item.title }) : undefined}
        confirmLabel={confirm ? t(`vacancies.actions.${confirm.kind}`) : ""}
        cancelLabel={t("common.actions.cancel")}
        destructive={confirm?.kind === "delete"}
        loading={actions.pending}
        onConfirm={onConfirm}
      />
    </div>
  );
}

function VacancyRow({
  item: v,
  busy,
  onPublish,
  onDuplicate,
  onConfirm,
}: {
  item: VacancyListItem;
  busy: boolean;
  onPublish: () => void;
  onDuplicate: () => void;
  onConfirm: (kind: "delete" | "close" | "pause") => void;
}) {
  const { t, locale, name } = useT();
  const manageHref = `/employer/vacancies/${v.id}`;
  const showPublish = v.can_edit && canPublish(v.status);

  return (
    <article className={cn("relative rounded-2xl border border-border/70 bg-card p-4 shadow-sm transition-shadow hover:shadow-md", busy && "opacity-60")} aria-busy={busy}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <VacancyStatusBadge status={v.status} />
            {v.is_remote ? (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Wifi className="size-3.5" /> {t("vacancies.list.remote")}
              </span>
            ) : null}
            {!v.can_edit ? (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Lock className="size-3.5" /> {t("vacancies.list.view_only")}
              </span>
            ) : null}
          </div>
          <h3 className="mt-2 line-clamp-2 text-base font-semibold leading-snug">
            <Link href={manageHref} className="hover:text-primary">
              {v.title}
            </Link>
          </h3>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">{v.category ? name(v.category) : t("vacancies.list.no_category")}{v.region && !v.is_remote ? ` · ${name(v.region)}` : ""}</p>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={t("vacancies.actions.more")} disabled={busy}>
              <MoreVertical className="size-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[12rem]">
            {isPublic(v.status) ? (
              <DropdownMenuItem asChild>
                <Link href={`/jobs/${v.slug}`} target="_blank" rel="noopener noreferrer">
                  <ExternalLink /> {t("vacancies.actions.view")}
                </Link>
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem asChild>
              <Link href={manageHref}>
                <Settings2 /> {t("vacancies.actions.manage")}
              </Link>
            </DropdownMenuItem>
            {v.can_edit && isEditable(v.status) ? (
              <DropdownMenuItem asChild>
                <Link href={`${manageHref}/edit`}>
                  <Pencil /> {t("vacancies.actions.edit")}
                </Link>
              </DropdownMenuItem>
            ) : null}
            {v.can_edit && (showPublish || canPause(v.status) || canClose(v.status)) ? <DropdownMenuSeparator /> : null}
            {showPublish ? (
              <DropdownMenuItem onSelect={onPublish}>
                <Play /> {t(`vacancies.actions.${publishLabelKey(v.status)}`)}
              </DropdownMenuItem>
            ) : null}
            {v.can_edit && canPause(v.status) ? (
              <DropdownMenuItem onSelect={() => onConfirm("pause")}>
                <Pause /> {t("vacancies.actions.pause")}
              </DropdownMenuItem>
            ) : null}
            {v.can_edit && canClose(v.status) ? (
              <DropdownMenuItem onSelect={() => onConfirm("close")}>
                <XCircle /> {t("vacancies.actions.close")}
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onDuplicate}>
              <Copy /> {t("vacancies.actions.duplicate")}
            </DropdownMenuItem>
            {v.can_edit && canDelete(v.status, v.applications_count) ? (
              <DropdownMenuItem destructive onSelect={() => onConfirm("delete")}>
                <Trash2 /> {t("vacancies.actions.delete")}
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-3">
        <SalaryText from={v.salary_from} to={v.salary_to} type={v.salary_type} negotiable={v.salary_negotiable} className="text-[15px]" />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Eye className="size-4" /> {t("vacancies.list.views", { count: v.views_count })}
        </span>
        <Link href={`${manageHref}/applications`} className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
          <Users className="size-4" /> {t("vacancies.list.applications", { count: v.applications_count })}
        </Link>
        {v.published_at ? (
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="size-4" /> {t("vacancies.list.published")}: {formatDate(v.published_at, locale, "d MMM yyyy")}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="size-4" /> {t("vacancies.list.created")}: {formatDate(v.created_at, locale, "d MMM yyyy")}
          </span>
        )}
        {v.expires_at && (v.status === "active" || v.status === "expired") ? (
          <span>
            {t("vacancies.list.expires")}: {formatDate(v.expires_at, locale, "d MMM yyyy")}
          </span>
        ) : null}
      </div>

      {(v.status === "hidden" || v.status === "rejected") && v.moderation_note ? (
        <p className="mt-3 rounded-xl bg-destructive-soft px-3 py-2 text-sm text-destructive">
          <span className="font-semibold">{t("vacancies.manage.moderation_note")}:</span> {v.moderation_note}
        </p>
      ) : null}

      {showPublish ? (
        <div className="mt-3">
          <Button size="sm" variant="soft" onClick={onPublish} disabled={busy}>
            <Play className="size-4" /> {t(`vacancies.actions.${publishLabelKey(v.status)}`)}
          </Button>
        </div>
      ) : null}
    </article>
  );
}
