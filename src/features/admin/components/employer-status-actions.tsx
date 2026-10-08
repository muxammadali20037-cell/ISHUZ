"use client";

import { useState } from "react";
import { BadgeCheck, Ban, XCircle } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { setEmployerStatus } from "../actions/panel";
import { EMPLOYER_CHECKS } from "../schema";
import { NoteActionButton } from "./note-dialog";

/**
 * Ish beruvchi holati. Tasdiqlashda admin NIMA tekshirilganini belgilaydi (telefon, nom, hudud, STIR, hujjatlar) —
 * nishon aynan shuni ko'rsatadi. Jismoniy shaxsdan yuridik hujjat talab qilinmaydi. Yakuniy qaror — admin.
 */
export function EmployerStatusActions({ profileId, name, status, employerType, hasDocuments, hasIdentity }: { profileId: string; name: string; status: string; employerType: string; hasDocuments: boolean; hasIdentity: boolean }) {
  const { t } = useT();
  const defaults = (["phone", "name", "region"] as string[]).concat(hasIdentity ? ["identity"] : [], hasDocuments ? ["documents"] : []);
  const [checks, setChecks] = useState<string[]>(defaults);
  const toggle = (c: string) => setChecks((x) => (x.includes(c) ? x.filter((y) => y !== c) : [...x, c]));
  const legal = employerType === "company" || employerType === "government" || employerType === "individual_entrepreneur";
  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      {status !== "verified" ? (
        <NoteActionButton
          label={t("admin.employer_status.verify")}
          icon={<BadgeCheck className="size-4" />}
          title={t("admin.employer_status.verify_title", { name })}
          description={t(legal ? "admin.employer_status.verify_desc_legal" : "admin.employer_status.verify_desc_person")}
          confirmLabel={t("admin.employer_status.verify")}
          noteLabel={t("admin.vacancies.note_optional")}
          variant="success"
          extra={
            <fieldset className="mb-3 space-y-1.5">
              <legend className="mb-1 text-sm font-medium">{t("admin.employer_status.checked")}</legend>
              {EMPLOYER_CHECKS.map((c) => (
                <label key={c} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={checks.includes(c)} onChange={() => toggle(c)} className="size-4" />
                  {t(`admin.employer_status.checks.${c}`)}
                </label>
              ))}
            </fieldset>
          }
          action={(note) => setEmployerStatus({ profileId, status: "verified", checks, note: note || undefined })}
        />
      ) : null}
      {status === "pending" || status === "unverified" ? (
        <NoteActionButton
          label={t("admin.employer_status.reject")}
          icon={<XCircle className="size-4" />}
          title={t("admin.employer_status.reject_title", { name })}
          noteLabel={t("admin.employer_status.reason")}
          noteRequired
          destructive
          variant="destructive-soft"
          action={(note) => setEmployerStatus({ profileId, status: "rejected", note })}
        />
      ) : null}
      {status !== "suspended" ? (
        <NoteActionButton
          label={t("admin.employer_status.suspend")}
          icon={<Ban className="size-4" />}
          title={t("admin.employer_status.suspend_title", { name })}
          description={t("admin.employer_status.suspend_desc")}
          noteLabel={t("admin.employer_status.reason")}
          noteRequired
          destructive
          variant="ghost"
          action={(note) => setEmployerStatus({ profileId, status: "suspended", note })}
        />
      ) : null}
    </div>
  );
}
