"use client";

import { useState, useTransition } from "react";
import { Check, XCircle, FileText, ExternalLink } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { getDocumentUrl, reviewVerification } from "../actions/moderation";
import { NoteActionButton, errorText } from "./note-dialog";

/** Tasdiqlash / rad etish (employers.verify) → rpc admin_review_verification */
export function VerificationActions({ requestId, canVerify, stacked }: { requestId: string; canVerify: boolean; stacked?: boolean }) {
  const { t } = useT();
  if (!canVerify) return null;
  const size = stacked ? "default" : "sm";
  const cls = stacked ? "w-full" : undefined;
  return (
    <div className={stacked ? "grid grid-cols-2 gap-2" : "flex flex-wrap items-center justify-end gap-1.5"}>
      <NoteActionButton
        label={t("admin.verifications.approve")}
        icon={<Check className="size-4" />}
        title={t("admin.verifications.approve_title")}
        description={t("admin.verifications.approve_desc")}
        confirmLabel={t("admin.verifications.approve")}
        noteLabel={t("admin.vacancies.note_optional")}
        variant="success"
        size={size}
        className={cls}
        successMessage={t("admin.verifications.approved_done")}
        action={(note) => reviewVerification({ requestId, status: "verified", note })}
      />
      <NoteActionButton
        label={t("admin.verifications.reject")}
        icon={<XCircle className="size-4" />}
        title={t("admin.verifications.reject_title")}
        description={t("admin.verifications.reject_desc")}
        confirmLabel={t("admin.verifications.reject")}
        noteLabel={t("admin.vacancies.note")}
        noteRequired
        destructive
        variant="destructive-soft"
        size={size}
        className={cls}
        successMessage={t("admin.verifications.rejected_done")}
        action={(note) => reviewVerification({ requestId, status: "rejected", note })}
      />
    </div>
  );
}

/** Hujjatlar ro'yxati: bosilganda imzolangan URL olinadi va yangi oynada ochiladi */
export function DocumentLinks({ paths }: { paths: string[] }) {
  const { t } = useT();
  const [pending, startTransition] = useTransition();
  const [loading, setLoading] = useState<string | null>(null);
  if (!paths.length) return <span className="text-xs text-muted-foreground">{t("admin.verifications.no_documents")}</span>;
  const open = (path: string) => {
    setLoading(path);
    startTransition(async () => {
      const res = await getDocumentUrl({ path });
      setLoading(null);
      if (!res.ok || !res.data) {
        toast.error(errorText(t, res.ok ? "not_found" : res.error));
        return;
      }
      window.open(res.data.url, "_blank", "noopener,noreferrer");
    });
  };
  return (
    <ul className="flex flex-wrap gap-1.5">
      {paths.map((p, i) => (
        <li key={p}>
          <Button type="button" variant="outline" size="sm" onClick={() => open(p)} loading={pending && loading === p} disabled={pending && loading !== p}>
            <FileText className="size-4" />
            {t("admin.verifications.document_n", { n: i + 1 })}
            <ExternalLink className="size-3.5 opacity-60" />
          </Button>
        </li>
      ))}
    </ul>
  );
}
