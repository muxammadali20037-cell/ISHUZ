"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/client";
import { requestAppeal } from "@/features/post/actions";
import type { ListingStateInfo } from "@/features/post/types";

/** Kabinetdagi e'lon ostida: rad etilgan bo'lsa sabab + "O'zgartirish" + "Qayta ko'rib chiqishni so'rash"; tasdiqlash kutilsa — havola */
export function ModerationNotice({ entity, id, info, editHref }: { entity: "vacancy" | "worker"; id: string; info: ListingStateInfo; editHref: string }) {
  const { t } = useT();
  const [state, setState] = useState(info);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (state.state === "verification_pending") {
    return (
      <div className="rounded-2xl bg-primary-soft/60 p-3 text-base">
        <p className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden /> {t("easy.moderation.verification_desc")}
        </p>
        <Button asChild variant="outline" className="mt-2 min-h-12 text-base">
          <Link href="/cabinet/verification">{t("easy.moderation.verify_cta")}</Link>
        </Button>
      </div>
    );
  }
  if (state.state !== "rejected") return null;
  return (
    <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-3 text-base" role="status">
      <p className="flex items-start gap-2 font-semibold text-destructive">
        <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden /> {t("easy.moderation.rejected_desc")}
      </p>
      {state.message ? <p className="mt-2">{state.message}</p> : null}
      {error ? <p className="mt-2 font-semibold text-destructive" role="alert">{error}</p> : null}
      <div className="mt-2 flex flex-wrap gap-2">
        <Button asChild className="min-h-12 text-base">
          <Link href={editHref}>{t("easy.moderation.edit")}</Link>
        </Button>
        {state.canAppeal ? (
          <Button
            variant="outline"
            className="min-h-12 text-base"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await requestAppeal({ entity, id });
                if (!res.ok || !res.data) {
                  const key = `easy.errors.${res.ok ? "generic" : res.error}`;
                  const msg = t(key);
                  setError(msg === key ? t("easy.errors.generic") : msg);
                  return;
                }
                setState(res.data);
              })
            }
          >
            {t("easy.moderation.appeal")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
