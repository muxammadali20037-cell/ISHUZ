"use client";

import { useState, useTransition } from "react";
import { Flag } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { Sheet, Dialog, DialogTrigger } from "@/components/ui/dialog";
import { RadioGroup, RadioItem } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";
import { submitReport, type ReportInput } from "./actions";

const REASONS: ReportInput["reason"][] = ["fraud", "fake_vacancy", "asked_money", "wrong_info", "spam", "abuse", "other"];

/**
 * "Shikoyat qilish" tugmasi + bottom sheet. Har qanday joyda:
 * <ReportDialog targetType="vacancy" targetId={vacancy.id} />
 */
export function ReportDialog({
  targetType,
  targetId,
  variant = "ghost",
  size = "sm",
  iconOnly,
  className,
}: {
  targetType: ReportInput["targetType"];
  targetId: string;
  variant?: "ghost" | "outline" | "link";
  size?: "sm" | "default" | "icon-sm";
  iconOnly?: boolean;
  className?: string;
}) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportInput["reason"] | "">("");
  const [details, setDetails] = useState("");
  const [pending, startTransition] = useTransition();

  const submit = () => {
    if (!reason) return;
    startTransition(async () => {
      const res = await submitReport({ targetType, targetId, reason, details });
      if (!res.ok) {
        toast.error(t(`common.errors.${res.error}`));
        return;
      }
      toast.success(t("common.report_sent"));
      setOpen(false);
      setReason("");
      setDetails("");
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant={variant} size={iconOnly ? "icon-sm" : size} className={className} aria-label={t("common.actions.report")}>
          <Flag className="size-4" />
          {!iconOnly ? t("common.actions.report") : null}
        </Button>
      </DialogTrigger>
      <Sheet
        title={t("common.actions.report")}
        description={t("common.report_desc")}
        footer={
          <Button fullWidth onClick={submit} loading={pending} disabled={!reason}>
            {t("common.actions.send")}
          </Button>
        }
      >
        <RadioGroup value={reason} onValueChange={(v) => setReason(v as ReportInput["reason"])} className="space-y-2">
          {REASONS.map((r) => (
            <RadioItem key={r} value={r} label={t(`enums.report_reason.${r}`)} />
          ))}
        </RadioGroup>
        <Field label={t("common.report_details")} htmlFor="report-details" className="mt-4">
          <Textarea id="report-details" value={details} onChange={(e) => setDetails(e.target.value)} maxLength={2000} className="min-h-[90px]" />
        </Field>
      </Sheet>
    </Dialog>
  );
}
