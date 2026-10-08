"use client";

import { useState } from "react";
import { Check, Eye, RefreshCw, XCircle } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { Field } from "@/components/ui/label";
import { decideModeration } from "../actions/panel";
import { MODERATION_REJECT_CATEGORIES } from "../schema";
import { NoteActionButton } from "./note-dialog";

/** Moderatsiya qarori: ruxsat / rad etish (sabab turi + foydalanuvchiga tushunarli izoh) / ko'rib chiqishda qoldirish / qayta tekshirish */
export function ModerationActions({ entity, id, title, state }: { entity: "vacancy" | "worker"; id: string; title: string; state: string }) {
  const { t } = useT();
  const [category, setCategory] = useState<(typeof MODERATION_REJECT_CATEGORIES)[number]>("unrelated");
  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      {state !== "allowed" ? (
        <NoteActionButton
          label={t("admin.moderation.allow")}
          icon={<Check className="size-4" />}
          title={t("admin.moderation.allow_title", { title })}
          description={t("admin.moderation.allow_desc")}
          confirmLabel={t("admin.moderation.allow")}
          noteLabel={t("admin.vacancies.note_optional")}
          variant="success"
          successMessage={t("admin.moderation.done_allow")}
          action={(note) => decideModeration({ entity, id, decision: "allow", message: note || undefined })}
        />
      ) : null}
      {state !== "rejected" ? (
        <NoteActionButton
          label={t("admin.moderation.reject")}
          icon={<XCircle className="size-4" />}
          title={t("admin.moderation.reject_title", { title })}
          description={t("admin.moderation.reject_desc")}
          confirmLabel={t("admin.moderation.reject")}
          noteLabel={t("admin.moderation.user_message")}
          noteRequired
          destructive
          variant="destructive-soft"
          successMessage={t("admin.moderation.done_reject")}
          extra={
            <Field label={t("admin.moderation.category")} htmlFor={`cat-${id}`}>
              <select
                id={`cat-${id}`}
                value={category}
                onChange={(e) => setCategory(e.target.value as typeof category)}
                className="mb-3 h-10 w-full rounded-xl border border-input bg-card px-3 text-sm"
              >
                {MODERATION_REJECT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {t(`admin.moderation.categories.${c}`)}
                  </option>
                ))}
              </select>
            </Field>
          }
          action={(note) => decideModeration({ entity, id, decision: "reject", message: note, category })}
        />
      ) : null}
      {state !== "review" ? (
        <NoteActionButton
          label={t("admin.moderation.review")}
          icon={<Eye className="size-4" />}
          title={t("admin.moderation.review_title", { title })}
          noteLabel={t("admin.vacancies.note_optional")}
          variant="outline"
          successMessage={t("admin.common.done")}
          action={(note) => decideModeration({ entity, id, decision: "review", message: note || undefined })}
        />
      ) : null}
      <NoteActionButton
        label={t("admin.moderation.recheck")}
        icon={<RefreshCw className="size-4" />}
        title={t("admin.moderation.recheck_title", { title })}
        description={t("admin.moderation.recheck_desc")}
        variant="ghost"
        successMessage={t("admin.moderation.done_recheck")}
        action={() => decideModeration({ entity, id, decision: "recheck" })}
      />
    </div>
  );
}
