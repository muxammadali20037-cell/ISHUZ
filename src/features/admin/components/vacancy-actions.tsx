"use client";

import { Check, EyeOff, XCircle, Lock } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import type { Enums } from "@/types/database.types";
import { setVacancyStatus } from "../actions/vacancies";
import { NoteActionButton } from "./note-dialog";

/** Vakansiya moderatsiyasi tugmalari (vacancies.moderate) → rpc admin_set_vacancy_status */
export function VacancyActions({ vacancyId, status, title, canModerate, size = "sm", stacked }: { vacancyId: string; status: Enums<"vacancy_status">; title: string; canModerate: boolean; size?: "sm" | "default"; stacked?: boolean }) {
  const { t } = useT();
  if (!canModerate) return null;
  const canApprove = status !== "active";
  const canHide = status !== "hidden" && status !== "draft";
  const canReject = status === "pending_review" || status === "active" || status === "paused" || status === "hidden";
  const canClose = status === "active" || status === "paused" || status === "pending_review";
  const wrap = stacked ? "grid grid-cols-2 gap-2" : "flex flex-wrap items-center justify-end gap-1.5";
  const cls = stacked ? "w-full" : undefined;
  return (
    <div className={wrap}>
      {canApprove ? (
        <NoteActionButton
          label={t("admin.vacancies.approve")}
          icon={<Check className="size-4" />}
          title={t("admin.vacancies.approve_title", { title })}
          description={t("admin.vacancies.approve_desc")}
          confirmLabel={t("admin.vacancies.approve")}
          noteLabel={t("admin.vacancies.note_optional")}
          variant="success"
          size={size}
          className={cls}
          successMessage={t("admin.vacancies.approved")}
          action={(note) => setVacancyStatus({ vacancyId, status: "active", note })}
        />
      ) : null}
      {canHide ? (
        <NoteActionButton
          label={t("admin.vacancies.hide")}
          icon={<EyeOff className="size-4" />}
          title={t("admin.vacancies.hide_title", { title })}
          description={t("admin.vacancies.hide_desc")}
          confirmLabel={t("admin.vacancies.hide")}
          noteLabel={t("admin.vacancies.note")}
          noteRequired
          variant="outline"
          size={size}
          className={cls}
          successMessage={t("admin.vacancies.hidden_done")}
          action={(note) => setVacancyStatus({ vacancyId, status: "hidden", note })}
        />
      ) : null}
      {canReject ? (
        <NoteActionButton
          label={t("admin.vacancies.reject")}
          icon={<XCircle className="size-4" />}
          title={t("admin.vacancies.reject_title", { title })}
          description={t("admin.vacancies.reject_desc")}
          confirmLabel={t("admin.vacancies.reject")}
          noteLabel={t("admin.vacancies.note")}
          noteRequired
          destructive
          variant="destructive-soft"
          size={size}
          className={cls}
          successMessage={t("admin.vacancies.rejected_done")}
          action={(note) => setVacancyStatus({ vacancyId, status: "rejected", note })}
        />
      ) : null}
      {canClose ? (
        <NoteActionButton
          label={t("admin.vacancies.close")}
          icon={<Lock className="size-4" />}
          title={t("admin.vacancies.close_title", { title })}
          description={t("admin.vacancies.close_desc")}
          confirmLabel={t("admin.vacancies.close")}
          noteLabel={t("admin.vacancies.note_optional")}
          variant="ghost"
          size={size}
          className={cls}
          successMessage={t("admin.vacancies.closed_done")}
          action={(note) => setVacancyStatus({ vacancyId, status: "closed", note })}
        />
      ) : null}
    </div>
  );
}
