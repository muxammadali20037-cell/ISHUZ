"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Clock3, PhoneCall } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { requestContact } from "./actions";

/** "Telefon raqamini so'rash" — egasi ruxsat bersa raqam shu yerda ochiladi */
export function RequestContactButton({ profileId, initial }: { profileId: string; initial: "none" | "pending" | "declined" }) {
  const { t } = useT();
  const router = useRouter();
  const [status, setStatus] = useState(initial);
  const [pending, startTransition] = useTransition();

  if (status === "pending") {
    return (
      <p className="flex items-center gap-2 text-sm font-medium text-foreground/80">
        <Clock3 className="size-4 shrink-0 text-primary" /> {t("contacts.request.pending")}
      </p>
    );
  }

  const ask = () =>
    startTransition(async () => {
      const res = await requestContact({ profileId });
      if (!res.ok) {
        const key = `contacts.request.errors.${res.error}`;
        const msg = t(key);
        toast.error(msg === key ? t("common.errors.generic") : msg);
        return;
      }
      if (res.data?.status === "allowed") {
        router.refresh();
        return;
      }
      setStatus("pending");
      toast.success(t("contacts.request.sent"), t("contacts.request.sent_desc"));
    });

  return (
    <div className="space-y-1.5">
      <Button type="button" size="sm" variant="soft" onClick={ask} loading={pending}>
        <PhoneCall className="size-4" /> {t("contacts.request.button")}
      </Button>
      {status === "declined" ? <p className="text-xs text-muted-foreground">{t("contacts.request.declined")}</p> : null}
    </div>
  );
}
