"use client";

import { Check, Clock, FileSearch, ShieldAlert, ShieldCheck, ShieldX, type LucideIcon } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { VerificationForm } from "@/features/verification/components/verification-form";
import type { VerificationRequestRow, VerificationStatus } from "../../types";
import { VerificationBadge } from "../dashboard/status-badge";

/** Holat vaqt chizig'i: unverified → pending → verified | rejected */
function Timeline({ status, reviewNote }: { status: VerificationStatus; reviewNote: string | null }) {
  const { t } = useT();
  const final = status === "rejected" ? "rejected" : "verified";
  const steps: { key: string; icon: LucideIcon; label: string; state: "done" | "active" | "todo" | "error" }[] = [
    { key: "sent", icon: Check, label: t("employer.verification.timeline_unverified"), state: status === "unverified" ? "active" : "done" },
    { key: "pending", icon: Clock, label: t("employer.verification.timeline_pending"), state: status === "pending" ? "active" : status === "unverified" ? "todo" : "done" },
    {
      key: final,
      icon: final === "rejected" ? ShieldX : ShieldCheck,
      label: final === "rejected" ? t("employer.verification.timeline_rejected") : t("employer.verification.timeline_verified"),
      state: status === "verified" ? "done" : status === "rejected" ? "error" : "todo",
    },
  ];
  return (
    <ol className="grid gap-3 sm:grid-cols-3">
      {steps.map((s, i) => (
        <li key={s.key} className="flex items-center gap-3 sm:flex-col sm:items-start">
          <span
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-full border-2",
              s.state === "done" && "border-success bg-success text-success-foreground",
              s.state === "active" && "border-primary bg-primary-soft text-primary-ink",
              s.state === "todo" && "border-border text-muted-foreground",
              s.state === "error" && "border-destructive bg-destructive-soft text-destructive",
            )}
          >
            <s.icon className="size-4" />
          </span>
          <div className="min-w-0">
            <p className={cn("text-sm font-medium", s.state === "todo" && "text-muted-foreground")}>
              {i + 1}. {s.label}
            </p>
            {s.state === "error" && reviewNote ? <p className="mt-0.5 text-xs text-destructive">{reviewNote}</p> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

/**
 * Tasdiqlash bo'limi: holat, so'rovlar ro'yxati, yangi so'rov formasi.
 * So'rov faqat xavfsiz RPC orqali (`submit_employer_verification`, 0049): u holatni "kutilmoqda" ga o'tkazadi, eski kutilayotgan
 * so'rovni almashtiradi va kompaniyani o'zi biriktiradi. To'g'ridan-to'g'ri `verification_requests` ga yozish 0056 dan beri
 * taqiqlangan (oldingi forma shu sabab "ruxsat yo'q" xatosini berardi — 2026-10-31 auditi).
 * Tashkilot/davlat uchun STIR (yoki JShShIR) majburiy — kompaniya ma'lumotlaridagi STIR oldindan to'ldiriladi.
 */
export function VerificationTab({
  userId,
  isCompany,
  status,
  requests,
  canSubmit,
  needsId,
  initialId,
}: {
  userId: string;
  isCompany: boolean;
  status: VerificationStatus;
  requests: VerificationRequestRow[];
  canSubmit: boolean;
  needsId: boolean;
  initialId: string | null;
}) {
  const { t, tEnum, locale } = useT();
  const latest = requests[0] ?? null;
  const reviewNote = latest?.status === "rejected" ? latest.review_note : null;
  const hasPending = requests.some((r) => r.status === "pending") || status === "pending";
  const showForm = !hasPending && status !== "verified" && status !== "suspended";

  return (
    <div className="space-y-6" id="verification">
      <section className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold">{t("employer.verification.title")}</h2>
          <VerificationBadge status={status} label={tEnum("verification_status", status)} />
        </div>
        <p className="mb-5 text-sm text-muted-foreground">{isCompany ? t("employer.verification.desc_company") : t("employer.verification.desc_person")}</p>
        <Timeline status={status} reviewNote={reviewNote} />
        {status === "pending" ? <p className="mt-4 rounded-xl bg-warning-soft p-3 text-sm text-warning">{t("employer.verification.pending_notice")}</p> : null}
        {status === "verified" ? <p className="mt-4 rounded-xl bg-success-soft p-3 text-sm text-success">{t("employer.verification.verified_notice")}</p> : null}
        {status === "suspended" ? (
          <p className="mt-4 flex gap-2 rounded-xl bg-destructive-soft p-3 text-sm text-destructive">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            {t("employer.verification.suspended_notice")}
          </p>
        ) : null}
      </section>

      {showForm ? (
        canSubmit ? (
          <section>
            <h3 className="mb-3 text-base font-semibold">{t("employer.verification.new_request")}</h3>
            <VerificationForm userId={userId} needsId={needsId} initialId={initialId} />
          </section>
        ) : (
          <p className="rounded-xl bg-secondary p-3 text-sm text-muted-foreground">{t("employer.verification.admin_only")}</p>
        )
      ) : null}

      <section>
        <h3 className="mb-3 text-base font-semibold">{t("employer.verification.requests_title")}</h3>
        {requests.length ? (
          <ul className="divide-y divide-border rounded-2xl border border-border/70 bg-card shadow-sm">
            {requests.map((r) => (
              <li key={r.id} className="p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <FileSearch className="size-4 text-muted-foreground" />
                  <span className="font-medium">{tEnum("verification_type", r.type)}</span>
                  <VerificationBadge status={r.status} label={tEnum("verification_status", r.status)} size="sm" />
                  <span className="ml-auto text-xs text-muted-foreground">
                    {t("employer.verification.sent_at")}: {formatDateTime(r.created_at, locale)}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("employer.verification.doc_count", { count: r.document_paths.length })}
                  {r.note ? ` · ${r.note}` : ""}
                </p>
                {r.review_note ? (
                  <p className={cn("mt-2 rounded-lg p-2.5 text-sm", r.status === "rejected" ? "bg-destructive-soft text-destructive" : "bg-secondary text-foreground")}>
                    <span className="font-medium">{t("employer.verification.review_note")}:</span> {r.review_note}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">{t("employer.verification.no_requests")}</p>
        )}
      </section>
    </div>
  );
}
