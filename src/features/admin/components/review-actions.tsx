"use client";

import { Check, XCircle } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import type { Enums } from "@/types/database.types";
import { moderateReview } from "../actions/moderation";
import { NoteActionButton } from "./note-dialog";

/** Sharh moderatsiyasi (reviews.moderate) → rpc admin_moderate_review */
export function ReviewActions({ reviewId, status, canModerate }: { reviewId: string; status: Enums<"review_status">; canModerate: boolean }) {
  const { t } = useT();
  if (!canModerate) return null;
  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      {status !== "approved" ? (
        <NoteActionButton
          label={t("admin.reviews.approve")}
          icon={<Check className="size-4" />}
          title={t("admin.reviews.approve_title")}
          confirmLabel={t("admin.reviews.approve")}
          noteLabel={t("admin.vacancies.note_optional")}
          variant="success"
          successMessage={t("admin.reviews.approved_done")}
          action={(note) => moderateReview({ reviewId, status: "approved", note })}
        />
      ) : null}
      {status !== "rejected" ? (
        <NoteActionButton
          label={t("admin.reviews.reject")}
          icon={<XCircle className="size-4" />}
          title={t("admin.reviews.reject_title")}
          description={t("admin.reviews.reject_desc")}
          confirmLabel={t("admin.reviews.reject")}
          noteLabel={t("admin.vacancies.note")}
          noteRequired
          destructive
          variant="destructive-soft"
          successMessage={t("admin.reviews.rejected_done")}
          action={(note) => moderateReview({ reviewId, status: "rejected", note })}
        />
      ) : null}
    </div>
  );
}
