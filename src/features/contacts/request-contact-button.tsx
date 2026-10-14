"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Clock3, PhoneCall } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { requestContact } from "./actions";
import { callAction } from "@/lib/action-call";

/** "Telefon raqamini so'rash" — egasi ruxsat bersa raqam shu yerda ochiladi */
/** `size="xl"` — sahifaning asosiy amali (ishchi e'loni sahifasi): katta, to'liq kenglikda */
export function RequestContactButton({ profileId, initial, size = "sm" }: { profileId: string; initial: "none" | "pending" | "declined"; size?: "sm" | "xl" }) {
  const { t } = useT();
  const router = useRouter();
  const [status, setStatus] = useState(initial);
  const [pending, startTransition] = useTransition();

  if (status === "pending") {
    return (
      <p className={size === "xl" ? "flex items-center gap-2 rounded-xl bg-card px-4 py-3 text-base font-semibold" : "flex items-center gap-2 text-sm font-medium text-foreground/80"}>
        <Clock3 className="size-4 shrink-0 text-primary" /> {t("contacts.request.pending")}
      </p>
    );
  }

  const ask = () =>
    startTransition(async () => {
      const res = await callAction(() => requestContact({ profileId }));
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
      {size === "xl" ? (
        <Button type="button" size="xl" className="h-14 w-full text-lg" onClick={ask} loading={pending}>
          <PhoneCall className="size-5" /> {t("contacts.request.button")}
        </Button>
      ) : (
        <Button type="button" size="sm" variant="soft" onClick={ask} loading={pending}>
          <PhoneCall className="size-4" /> {t("contacts.request.button")}
        </Button>
      )}
      {status === "declined" ? <p className="text-xs text-muted-foreground">{t("contacts.request.declined")}</p> : null}
    </div>
  );
}
