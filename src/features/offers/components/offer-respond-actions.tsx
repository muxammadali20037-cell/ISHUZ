"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { actionErrorText } from "@/features/applications/errors";
import { respondToOffer } from "../actions";
import { celebrate } from "@/lib/celebrate";

/** Ishchi: "Qabul qilish" / "Rad etish" (respond_offer) — har biri ConfirmDialog bilan */
export function OfferRespondActions({ offerId, disabled }: { offerId: string; disabled?: boolean }) {
  const { t } = useT();
  const router = useRouter();
  const [dialog, setDialog] = useState<"accept" | "decline" | null>(null);
  const [pending, startTransition] = useTransition();

  const respond = (accept: boolean) => {
    startTransition(async () => {
      const res = await respondToOffer({ offerId, accept });
      if (!res.ok) {
        toast.error(actionErrorText(t, res.error, "offers"));
        setDialog(null);
        router.refresh();
        return;
      }
      if (accept) celebrate();
      if (accept) toast.success(t("offers.detail.accepted_toast"), t("offers.detail.accepted_desc"));
      else toast.info(t("offers.detail.declined_toast"));
      setDialog(null);
      router.refresh();
    });
  };

  return (
    <div className="grid grid-cols-2 gap-2">
      <Button type="button" variant="success" onClick={() => setDialog("accept")} disabled={disabled || pending}>
        <Check className="size-4" strokeWidth={2.75} />
        {t("offers.detail.accept")}
      </Button>
      <Button type="button" variant="destructive-soft" onClick={() => setDialog("decline")} disabled={disabled || pending}>
        <X className="size-4" strokeWidth={2.75} />
        {t("offers.detail.decline")}
      </Button>
      <ConfirmDialog
        open={dialog === "accept"}
        onOpenChange={(o) => !o && setDialog(null)}
        title={t("offers.detail.accept_title")}
        description={t("offers.detail.accept_desc")}
        confirmLabel={t("offers.detail.accept")}
        cancelLabel={t("common.actions.cancel")}
        onConfirm={() => respond(true)}
        loading={pending}
      />
      <ConfirmDialog
        open={dialog === "decline"}
        onOpenChange={(o) => !o && setDialog(null)}
        title={t("offers.detail.decline_title")}
        description={t("offers.detail.decline_desc")}
        confirmLabel={t("offers.detail.decline")}
        cancelLabel={t("common.actions.cancel")}
        onConfirm={() => respond(false)}
        destructive
        loading={pending}
      />
    </div>
  );
}
