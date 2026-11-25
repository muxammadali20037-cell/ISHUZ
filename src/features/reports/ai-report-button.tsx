"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Flag } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, Dialog, DialogTrigger } from "@/components/ui/dialog";
import { RadioGroup, RadioItem } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";
import { callAction } from "@/lib/action-call";
import { reportAiContent, type AiReportInput } from "./actions";

const REASONS: AiReportInput["reason"][] = ["abuse", "wrong_info", "other"];

/**
 * "AI natijasi haqida xabar berish" (ega, 2026-11-25: Play Market'ga chiqish). Google Play talabi: AI rasm yoki matn
 * yaratadigan ilovada foydalanuvchi haqoratli natija haqida ilovadan chiqmasdan xabar bera olsin. Shikoyat admin →
 * Shikoyatlar navbatiga tushadi (0092, target "ai_content"). Kirmagan bo'lsa — kirish sahifasiga (shu sahifaga qaytadi).
 */
export function AiReportButton({ kind, content, className }: { kind: AiReportInput["kind"]; content: string; className?: string }) {
  const { t } = useT();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<AiReportInput["reason"] | "">("");
  const [details, setDetails] = useState("");
  const [pending, startTransition] = useTransition();

  const submit = () => {
    if (!reason) return;
    startTransition(async () => {
      const res = await callAction(() => reportAiContent({ kind, content, reason, details }));
      if (!res.ok) {
        if (res.error === "not_authenticated") {
          router.push(`/auth?next=${encodeURIComponent(pathname)}`);
          return;
        }
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
        <Button type="button" variant="ghost" size="sm" className={cn("h-11 px-2 text-sm text-muted-foreground", className)} data-ai-report>
          <Flag className="size-4" aria-hidden />
          {t("common.ai_report.button")}
        </Button>
      </DialogTrigger>
      <Sheet
        title={t("common.ai_report.title")}
        description={t("common.ai_report.desc")}
        footer={
          <Button fullWidth onClick={submit} loading={pending} disabled={!reason} data-ai-report-send>
            {t("common.actions.send")}
          </Button>
        }
      >
        <RadioGroup value={reason} onValueChange={(v) => setReason(v as AiReportInput["reason"])} className="space-y-2">
          {REASONS.map((r) => (
            <RadioItem key={r} value={r} label={t(`common.ai_report.reason_${r}`)} />
          ))}
        </RadioGroup>
        <Field label={t("common.report_details")} htmlFor="ai-report-details" className="mt-4">
          <Textarea id="ai-report-details" value={details} onChange={(e) => setDetails(e.target.value)} maxLength={500} className="min-h-[90px]" />
        </Field>
      </Sheet>
    </Dialog>
  );
}
