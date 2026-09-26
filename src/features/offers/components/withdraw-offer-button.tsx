"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Undo2 } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { actionErrorText } from "@/features/applications/errors";
import { withdrawOffer } from "../actions";

/** Ish beruvchi: taklifni qaytarib olish (faqat sent/viewed) */
export function WithdrawOfferButton({ offerId, vacancyId, size = "default", fullWidth, className }: { offerId: string; vacancyId?: string | null; size?: "sm" | "default"; fullWidth?: boolean; className?: string }) {
  const { t } = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const confirm = () => {
    startTransition(async () => {
      const res = await withdrawOffer({ offerId, vacancyId: vacancyId ?? undefined });
      if (!res.ok) {
        toast.error(actionErrorText(t, res.error, "offers"));
        return;
      }
      toast.success(t("offers.detail.withdraw_done"));
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <>
      <Button type="button" variant="destructive-soft" size={size} fullWidth={fullWidth} className={className} onClick={() => setOpen(true)}>
        <Undo2 className="size-4" />
        {t("offers.detail.withdraw")}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={t("offers.detail.withdraw_title")}
        description={t("offers.detail.withdraw_desc")}
        confirmLabel={t("offers.detail.withdraw")}
        cancelLabel={t("common.actions.cancel")}
        onConfirm={confirm}
        destructive
        loading={pending}
      />
    </>
  );
}
