"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, CreditCard } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { InAppNote, requestPayment } from "@/features/billing/components/payment-dialog";
import { useAndroidApp } from "@/lib/use-android-app";
import { celebrate } from "@/lib/celebrate";
import { markFoundJob, markFoundWorker } from "@/features/post/actions";
import { callAction } from "@/lib/action-call";

/**
 * "Ishga joylashdim" / "Ishchi topdim" — tasdiqlash bilan; e'lon qidiruvdan chiqadi.
 * Yopuvchi amal — kartaning eng yorqin tugmasi emas (outline); natija rangi faqat belgida.
 */
export function FoundButton({ kind, vacancyId }: { kind: "job" | "worker"; vacancyId?: string }) {
  const { t } = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const confirm = () =>
    start(async () => {
      const res = kind === "job" ? await callAction(() => markFoundJob()) : await callAction(() => markFoundWorker({ vacancyId }));
      setOpen(false);
      if (!res.ok) {
        const key = `easy.errors.${res.error}`;
        const msg = t(key);
        toast.error(msg === key ? t("easy.errors.generic") : msg);
        return;
      }
      celebrate();
      toast.success(kind === "job" ? t("easy.cabinet.done_found_job") : t("easy.cabinet.done_found_worker"));
      router.refresh();
    });
  return (
    <>
      <Button type="button" variant="outline" className="h-auto min-h-12 max-w-full whitespace-normal px-4 py-2 text-base" onClick={() => setOpen(true)}>
        <CheckCircle2 className="size-5 text-success" aria-hidden /> {kind === "job" ? t("easy.cabinet.found_job") : t("easy.cabinet.found_worker")}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={kind === "job" ? t("easy.cabinet.found_job_confirm_title") : t("easy.cabinet.found_worker_confirm_title")}
        description={kind === "job" ? t("easy.cabinet.found_job_confirm_desc") : t("easy.cabinet.found_worker_confirm_desc")}
        confirmLabel={t("easy.cabinet.confirm_yes")}
        cancelLabel={t("easy.cabinet.confirm_no")}
        onConfirm={confirm}
        loading={pending}
      />
    </>
  );
}

/** To'lov kutilayotgan e'lon: to'lash (Android ilovada — neytral izoh) */
export function PayButton({ purpose, targetId }: { purpose: "worker_listing" | "vacancy_publish"; targetId: string }) {
  const { t } = useT();
  const inApp = useAndroidApp();
  if (inApp) return <InAppNote />;
  return (
    <Button type="button" className="h-auto min-h-12 max-w-full whitespace-normal px-4 py-2 text-base" onClick={() => requestPayment({ purpose, targetId })}>
      <CreditCard className="size-5" aria-hidden /> {t("easy.cabinet.pay")}
    </Button>
  );
}
