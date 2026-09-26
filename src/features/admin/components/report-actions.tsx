"use client";

import { Search, Check, XCircle, Ban, EyeOff } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import type { Enums } from "@/types/database.types";
import { resolveReport } from "../actions/moderation";
import { setUserBlock } from "../actions/users";
import { setVacancyStatus } from "../actions/vacancies";
import { NoteActionButton } from "./note-dialog";

/** Shikoyat amallari (reports.resolve) + tezkor amallar (users.block / vacancies.moderate) */
export function ReportActions({
  reportId,
  status,
  canResolve,
  canBlock,
  canModerate,
  target,
  stacked,
}: {
  reportId: string;
  status: Enums<"report_status">;
  canResolve: boolean;
  canBlock: boolean;
  canModerate: boolean;
  target: { type: Enums<"report_target">; id: string; profileId: string | null; profileBlocked: boolean; vacancyStatus: Enums<"vacancy_status"> | null; label: string | null };
  stacked?: boolean;
}) {
  const { t } = useT();
  const open = status === "open" || status === "in_review";
  const size = stacked ? "default" : "sm";
  const cls = stacked ? "w-full" : undefined;
  return (
    <div className={stacked ? "grid grid-cols-2 gap-2" : "flex flex-wrap items-center justify-end gap-1.5"}>
      {canResolve && status === "open" ? (
        <NoteActionButton
          label={t("admin.reports.take")}
          icon={<Search className="size-4" />}
          title={t("admin.reports.take_title")}
          confirmLabel={t("admin.reports.take")}
          variant="soft"
          size={size}
          className={cls}
          successMessage={t("admin.reports.taken")}
          action={() => resolveReport({ reportId, status: "in_review" })}
        />
      ) : null}
      {canResolve && open ? (
        <NoteActionButton
          label={t("admin.reports.resolve")}
          icon={<Check className="size-4" />}
          title={t("admin.reports.resolve_title")}
          description={t("admin.reports.resolve_desc")}
          confirmLabel={t("admin.reports.resolve")}
          noteLabel={t("admin.reports.resolution_note")}
          noteRequired
          variant="success"
          size={size}
          className={cls}
          successMessage={t("admin.reports.resolved_done")}
          action={(note) => resolveReport({ reportId, status: "resolved", note })}
        />
      ) : null}
      {canResolve && open ? (
        <NoteActionButton
          label={t("admin.reports.dismiss")}
          icon={<XCircle className="size-4" />}
          title={t("admin.reports.dismiss_title")}
          description={t("admin.reports.dismiss_desc")}
          confirmLabel={t("admin.reports.dismiss")}
          noteLabel={t("admin.reports.resolution_note")}
          variant="outline"
          size={size}
          className={cls}
          successMessage={t("admin.reports.dismissed_done")}
          action={(note) => resolveReport({ reportId, status: "dismissed", note })}
        />
      ) : null}
      {canBlock && target.profileId && !target.profileBlocked ? (
        <NoteActionButton
          label={t("admin.reports.block_target")}
          icon={<Ban className="size-4" />}
          title={t("admin.users.block_title", { name: target.label ?? target.profileId.slice(0, 8) })}
          description={t("admin.users.block_desc")}
          confirmLabel={t("common.actions.block")}
          noteLabel={t("admin.users.block_reason")}
          noteRequired
          destructive
          variant="destructive-soft"
          size={size}
          className={cls}
          successMessage={t("admin.users.blocked")}
          action={(note) => setUserBlock({ profileId: target.profileId, block: true, reason: note })}
        />
      ) : null}
      {canModerate && target.type === "vacancy" && target.vacancyStatus && target.vacancyStatus !== "hidden" && target.vacancyStatus !== "rejected" ? (
        <NoteActionButton
          label={t("admin.reports.hide_vacancy")}
          icon={<EyeOff className="size-4" />}
          title={t("admin.vacancies.hide_title", { title: target.label ?? "" })}
          description={t("admin.vacancies.hide_desc")}
          confirmLabel={t("admin.vacancies.hide")}
          noteLabel={t("admin.vacancies.note")}
          noteRequired
          variant="outline"
          size={size}
          className={cls}
          successMessage={t("admin.vacancies.hidden_done")}
          action={(note) => setVacancyStatus({ vacancyId: target.id, status: "hidden", note })}
        />
      ) : null}
    </div>
  );
}
