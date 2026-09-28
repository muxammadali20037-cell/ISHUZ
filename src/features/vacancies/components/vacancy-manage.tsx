"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, Users, ExternalLink, Pencil, Play, Pause, XCircle, Copy, Trash2, MoreVertical, CalendarDays, ShieldAlert, Lock, UserSearch } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { formatDate } from "@/lib/format";
import type { Benefit } from "@/lib/reference";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader, SectionHeader } from "@/components/ui/misc";
import { ConfirmDialog } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { WorkerCard, type WorkerCardData } from "@/components/shared/worker-card";
import type { VacancyAccess } from "../queries";
import { canClose, canDelete, canPause, canPublish, isEditable, isPublic, publishLabelKey } from "../status";
import type { ApplicationStats, ApplicationStatus, VacancyFull } from "../types";
import { VacancyStatusBadge } from "./status-badge";
import { VacancyPreview } from "./vacancy-preview";
import { useVacancyActions } from "./use-vacancy-actions";

const APP_STATUSES: ApplicationStatus[] = ["sent", "viewed", "shortlisted", "interview", "offered", "hired", "rejected", "withdrawn"];

type Confirm = "delete" | "close" | "pause" | null;

export function VacancyManage({
  vacancy: v,
  access,
  stats,
  workers,
  benefits,
}: {
  vacancy: VacancyFull;
  access: VacancyAccess;
  stats: ApplicationStats;
  workers: WorkerCardData[];
  benefits: Benefit[];
}) {
  const { t, locale } = useT();
  const router = useRouter();
  const actions = useVacancyActions();
  const [confirm, setConfirm] = useState<Confirm>(null);
  const busy = actions.busyId === v.id;
  const canEdit = access.canEdit;
  const applicationsHref = `/employer/vacancies/${v.id}/applications`;
  const workersHref = `/workers?vacancy=${v.id}`;

  const onConfirm = () => {
    const done = () => setConfirm(null);
    if (confirm === "delete") actions.remove(v.id, () => router.push("/employer/vacancies"));
    else if (confirm === "close") actions.close(v.id, done);
    else if (confirm === "pause") actions.pause(v.id, done);
  };

  return (
    <div>
      <PageHeader title={v.title} subtitle={t(`vacancies.manage.status_hint.${v.status}`)} backHref="/employer/vacancies" />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
        <VacancyStatusBadge status={v.status} size="lg" />
        {v.published_at ? (
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="size-4" /> {t("vacancies.manage.published_at")}: {formatDate(v.published_at, locale)}
          </span>
        ) : null}
        {v.expires_at && (v.status === "active" || v.status === "expired") ? (
          <span>
            {t("vacancies.manage.expires_at")}: {formatDate(v.expires_at, locale)}
          </span>
        ) : null}
        <span>
          {t("vacancies.manage.updated_at")}: {formatDate(v.updated_at, locale)}
        </span>
      </div>

      {v.status === "hidden" || v.status === "rejected" ? (
        <div className="mt-4 rounded-2xl border border-destructive/30 bg-destructive-soft p-4">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 size-5 shrink-0 text-destructive" />
            <div className="min-w-0">
              <h2 className="font-semibold text-destructive">{t(v.status === "hidden" ? "vacancies.manage.hidden_title" : "vacancies.manage.rejected_title")}</h2>
              <p className="mt-1 text-sm text-foreground/80">{t(v.status === "hidden" ? "vacancies.manage.hidden_desc" : "vacancies.manage.rejected_desc")}</p>
              {v.moderation_note ? (
                <p className="mt-2 rounded-lg bg-card/70 px-3 py-2 text-sm">
                  <span className="font-semibold">{t("vacancies.manage.moderation_note")}:</span> {v.moderation_note}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {!canEdit ? (
        <p className="mt-4 flex items-center gap-2 rounded-xl bg-secondary px-3 py-2 text-sm text-muted-foreground">
          <Lock className="size-4" /> {t("vacancies.manage.viewer_hint")}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {canEdit && canPublish(v.status) ? (
          <Button onClick={() => actions.publish(v.id)} loading={busy}>
            <Play className="size-4" /> {t(`vacancies.actions.${publishLabelKey(v.status)}`)}
          </Button>
        ) : null}
        {canEdit && canPause(v.status) ? (
          <Button variant="outline" onClick={() => setConfirm("pause")} disabled={busy}>
            <Pause className="size-4" /> {t("vacancies.actions.pause")}
          </Button>
        ) : null}
        {canEdit && isEditable(v.status) ? (
          <Button asChild variant={canPublish(v.status) || canPause(v.status) ? "outline" : "default"}>
            <Link href={`/employer/vacancies/${v.id}/edit`}>
              <Pencil className="size-4" /> {t("vacancies.actions.edit")}
            </Link>
          </Button>
        ) : null}
        {isPublic(v.status) ? (
          <Button asChild variant="ghost">
            <Link href={`/jobs/${v.slug}`} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="size-4" /> {t("vacancies.actions.view")}
            </Link>
          </Button>
        ) : null}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={t("vacancies.actions.more")} disabled={busy}>
              <MoreVertical className="size-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[12rem]">
            {canEdit && canClose(v.status) ? (
              <DropdownMenuItem onSelect={() => setConfirm("close")}>
                <XCircle /> {t("vacancies.actions.close")}
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem onSelect={() => actions.duplicate(v.id)}>
              <Copy /> {t("vacancies.actions.duplicate")}
            </DropdownMenuItem>
            {canEdit && canDelete(v.status, v.applications_count) ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem destructive onSelect={() => setConfirm("delete")}>
                  <Trash2 /> {t("vacancies.actions.delete")}
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <section className="mt-8">
        <SectionHeader title={t("vacancies.manage.stats_title")} href={applicationsHref} linkLabel={t("vacancies.manage.all_applications")} />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile icon={Eye} label={t("vacancies.manage.views")} value={v.views_count} />
          <Link href={applicationsHref} className="block">
            <StatTile icon={Users} label={t("vacancies.manage.applications")} value={stats.total} interactive />
          </Link>
          <StatTile icon={Users} label={t("vacancies.manage.new_applications")} value={stats.by_status.sent ?? 0} />
          <StatTile icon={UserSearch} label={t("enums.application_status.interview")} value={stats.by_status.interview ?? 0} />
        </div>
        {stats.total ? (
          <div className="mt-3">
            <div className="mb-1.5 text-xs font-medium text-muted-foreground">{t("vacancies.manage.by_status")}</div>
            <div className="flex flex-wrap gap-1.5">
              {APP_STATUSES.filter((s) => stats.by_status[s]).map((s) => (
                <Link key={s} href={`${applicationsHref}?status=${s}`} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-sm hover:bg-secondary">
                  {t(`enums.application_status.${s}`)}
                  <span className="tabular font-semibold text-primary">{stats.by_status[s]}</span>
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <section id="matching" className="mt-8">
        <SectionHeader title={t("vacancies.manage.matching_title")} href={workersHref} linkLabel={t("vacancies.actions.all_workers")} />
        <p className="-mt-2 mb-3 text-sm text-muted-foreground">{t("vacancies.manage.matching_desc")}</p>
        {workers.length ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {workers.map((w) => (
              <WorkerCard key={w.id} worker={w} href={`/workers/${w.id}?vacancy=${v.id}`} />
            ))}
          </div>
        ) : (
          <EmptyState icon={UserSearch} title={t("vacancies.manage.matching_empty_title")} description={t("vacancies.manage.matching_empty_desc")} action={{ label: t("vacancies.actions.find_workers"), href: workersHref }} />
        )}
      </section>

      <section className="mt-8">
        <SectionHeader title={t("vacancies.manage.preview_title")} />
        <p className="-mt-2 mb-3 text-sm text-muted-foreground">{t("vacancies.manage.preview_desc")}</p>
        <VacancyPreview vacancy={v} benefits={benefits} />
      </section>

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={confirm ? t(`vacancies.confirm.${confirm}_title`) : ""}
        description={confirm ? t(`vacancies.confirm.${confirm}_desc`, { title: v.title }) : undefined}
        confirmLabel={confirm ? t(`vacancies.actions.${confirm}`) : ""}
        cancelLabel={t("common.actions.cancel")}
        destructive={confirm === "delete"}
        loading={actions.pending}
        onConfirm={onConfirm}
      />
    </div>
  );
}

function StatTile({ icon: Icon, label, value, interactive }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number; interactive?: boolean }) {
  return (
    <div className={["rounded-2xl border border-border/70 bg-card p-4 shadow-sm", interactive ? "transition-shadow hover:shadow-md" : ""].join(" ")}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="size-4" /> {label}
      </div>
      <div className="mt-1 text-2xl font-extrabold tabular">{value}</div>
    </div>
  );
}
