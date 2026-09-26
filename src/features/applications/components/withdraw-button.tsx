"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Undo2 } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { withdrawApplication } from "../actions";
import { actionErrorText } from "../errors";

/** "Arizani qaytarib olish" → ConfirmDialog → set_application_status('withdrawn') */
export function WithdrawButton({ applicationId, fullWidth }: { applicationId: string; fullWidth?: boolean }) {
  const { t } = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const confirm = () => {
    startTransition(async () => {
      const res = await withdrawApplication({ applicationId });
      if (!res.ok) {
        toast.error(actionErrorText(t, res.error));
        return;
      }
      toast.success(t("applications.detail.withdraw_done"));
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <>
      <Button type="button" variant="destructive-soft" fullWidth={fullWidth} onClick={() => setOpen(true)}>
        <Undo2 className="size-4" />
        {t("applications.detail.withdraw")}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={t("applications.detail.withdraw_title")}
        description={t("applications.detail.withdraw_desc")}
        confirmLabel={t("applications.detail.withdraw")}
        cancelLabel={t("common.actions.cancel")}
        onConfirm={confirm}
        destructive
        loading={pending}
      />
    </>
  );
}
