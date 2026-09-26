"use client";

import { useState } from "react";
import { ListChecks, CalendarClock, Gift, UserCheck, XCircle, type LucideIcon } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { EMPLOYER_NEXT_STATUSES, type ApplicationStatus, type EmployerStatus } from "../types";
import { StatusSheet, type SheetStatus } from "./status-sheet";
import { useStatusChange } from "./use-status-change";

const ICON: Record<EmployerStatus, LucideIcon> = { shortlisted: ListChecks, interview: CalendarClock, offered: Gift, hired: UserCheck, rejected: XCircle };
const LABEL: Record<EmployerStatus, string> = { shortlisted: "shortlist", interview: "interview", offered: "offer", hired: "hire", rejected: "reject" };

/**
 * Detal sahifadagi holat tugmalari (joriy holatga mos, faqat oldinga):
 * shortlisted — darhol; interview / offered / rejected — sheet (izoh); hired — tasdiqlash.
 */
export function StatusActionBar({ applicationId, vacancyId, status }: { applicationId: string; vacancyId: string; status: ApplicationStatus }) {
  const { t } = useT();
  const { pending, run } = useStatusChange({ applicationId, vacancyId });
  const [sheet, setSheet] = useState<SheetStatus | null>(null);
  const [hireOpen, setHireOpen] = useState(false);
  const next = EMPLOYER_NEXT_STATUSES[status];

  if (!next.length) return <p className="text-sm text-muted-foreground">{t("applications.candidate.terminal_hint")}</p>;

  const onClick = (s: EmployerStatus) => {
    if (s === "shortlisted") void run("shortlisted");
    else if (s === "hired") setHireOpen(true);
    else setSheet(s);
  };

  const primary = next.find((s) => s !== "rejected");

  return (
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-2">
        {next.map((s) => {
          const Icon = ICON[s];
          const variant = s === "rejected" ? "destructive-soft" : s === primary ? (s === "hired" ? "success" : "default") : "outline";
          return (
            <Button key={s} type="button" variant={variant} onClick={() => onClick(s)} disabled={pending} className={s === "rejected" && next.length % 2 === 1 ? "sm:col-span-2" : undefined}>
              <Icon className="size-4" />
              {t(`applications.candidate.${LABEL[s]}`)}
            </Button>
          );
        })}
      </div>
      {sheet ? <StatusSheet key={sheet} status={sheet} open onOpenChange={(o) => !o && setSheet(null)} onSubmit={(note) => run(sheet, note)} pending={pending} /> : null}
      <ConfirmDialog
        open={hireOpen}
        onOpenChange={setHireOpen}
        title={t("applications.candidate.hire_title")}
        description={t("applications.candidate.hire_desc")}
        confirmLabel={t("applications.candidate.hire")}
        cancelLabel={t("common.actions.cancel")}
        loading={pending}
        onConfirm={async () => {
          const ok = await run("hired");
          if (ok) setHireOpen(false);
        }}
      />
    </div>
  );
}
