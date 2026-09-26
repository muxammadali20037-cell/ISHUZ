"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserCheck } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { actionErrorText } from "@/features/applications/errors";
import { markOfferHired } from "../actions";

/** Ish beruvchi: qabul qilingan taklif bo'yicha nomzod ishga olindi (mark_offer_hired) */
export function MarkHiredButton({ offerId, vacancyId, fullWidth }: { offerId: string; vacancyId?: string | null; fullWidth?: boolean }) {
  const { t } = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const confirm = () => {
    startTransition(async () => {
      const res = await markOfferHired({ offerId, vacancyId: vacancyId ?? undefined });
      if (!res.ok) {
        toast.error(actionErrorText(t, res.error, "offers"));
        return;
      }
      toast.success(t("offers.detail.hired_done"));
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <>
      <Button type="button" variant="success" fullWidth={fullWidth} onClick={() => setOpen(true)}>
        <UserCheck className="size-4" />
        {t("offers.detail.mark_hired")}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={t("offers.detail.mark_hired_title")}
        description={t("offers.detail.mark_hired_desc")}
        confirmLabel={t("offers.detail.mark_hired")}
        cancelLabel={t("common.actions.cancel")}
        onConfirm={confirm}
        loading={pending}
      />
    </>
  );
}
